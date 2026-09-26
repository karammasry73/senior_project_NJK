"""Gmail API integration: OAuth flow, fetching messages, sending replies.

Requires a Google Cloud OAuth client (type: Web application, Gmail API
enabled) - client ID/secret go in backend/.env as SME_GOOGLE_CLIENT_ID /
SME_GOOGLE_CLIENT_SECRET. The redirect URI registered on that client must
match settings.google_redirect_uri exactly.

Tokens are stored in the generic `settings` table (key "gmail_oauth_token")
rather than a dedicated table - it's a single-user local app, so one row is
enough, and it reuses infrastructure that already exists.
"""

import base64
import json
from datetime import datetime, timezone
from email.mime.text import MIMEText

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.config import settings
from app.database import db_session

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    # Needed for mark read/unread and trash/untrash (labels.modify + trash
    # aren't covered by readonly/send). Adding this scope after a token was
    # already issued means the old token won't carry it - reconnect Gmail
    # once for mark/delete to start working.
    "https://www.googleapis.com/auth/gmail.modify",
]

# Gmail's own CATEGORY_* labels, mapped to a short tag - distinct from our
# Ollama-classified `category` field (urgent/action/etc), used only for the
# "hide promotions" style filtering the reference project has.
_GMAIL_CATEGORY_LABELS = {
    "CATEGORY_PERSONAL": "primary",
    "CATEGORY_SOCIAL": "social",
    "CATEGORY_PROMOTIONS": "promotions",
    "CATEGORY_UPDATES": "updates",
    "CATEGORY_FORUMS": "updates",
    "SPAM": "spam",
}

_TOKEN_KEY = "gmail_oauth_token"
_CODE_VERIFIER_KEY = "gmail_oauth_code_verifier"
_ACCOUNT_EMAIL_KEY = "gmail_account_email"


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def get_auth_url() -> str:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=settings.google_redirect_uri)
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    # authorization_url() auto-generates a PKCE code_verifier that only lives on
    # this Flow instance - it must be reused (not regenerated) in exchange_code(),
    # which runs in a separate request against a fresh Flow object. Persist it the
    # same way the token itself is persisted, and it's single-use / short-lived.
    with db_session() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (_CODE_VERIFIER_KEY, flow.code_verifier),
        )
    return auth_url


def exchange_code(code: str) -> None:
    with db_session() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (_CODE_VERIFIER_KEY,)).fetchone()
    code_verifier = row["value"] if row else None

    flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, redirect_uri=settings.google_redirect_uri, code_verifier=code_verifier
    )
    flow.fetch_token(code=code)
    _save_token(flow.credentials)

    with db_session() as conn:
        conn.execute("DELETE FROM settings WHERE key = ?", (_CODE_VERIFIER_KEY,))


def _save_token(creds: Credentials) -> None:
    with db_session() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (_TOKEN_KEY, creds.to_json()),
        )


def _load_credentials() -> Credentials | None:
    with db_session() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (_TOKEN_KEY,)).fetchone()
    if row is None:
        return None
    creds = Credentials.from_authorized_user_info(json.loads(row["value"]), SCOPES)
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except RefreshError:
            # Most likely cause: SCOPES gained a new entry (e.g. gmail.modify)
            # since this token was issued, and Google refuses to silently
            # grant it on refresh - the old token simply can't cover it
            # anymore. Treat this the same as "never connected" instead of
            # raising a 500 everywhere is_connected() gets called: the UI
            # already has a full "Connect Gmail" flow for exactly this case.
            return None
        _save_token(creds)
    return creds


def is_connected() -> bool:
    return _load_credentials() is not None


def get_account_email() -> str:
    """The connected account's own address (what outgoing mail is sent from).

    Cached in the settings table so it only hits the Gmail API once - the
    frontend shows it as the real "From" for outgoing rows instead of a
    "You" placeholder."""
    with db_session() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (_ACCOUNT_EMAIL_KEY,)).fetchone()
    if row:
        return row["value"]
    service = _service()
    profile = service.users().getProfile(userId="me").execute()
    email = profile.get("emailAddress", "") or ""
    if email:
        with db_session() as conn:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (_ACCOUNT_EMAIL_KEY, email),
            )
    return email


def _service():
    creds = _load_credentials()
    if creds is None:
        raise RuntimeError("Gmail is not connected - complete the OAuth flow first")
    return build("gmail", "v1", credentials=creds)


def _decode_body(payload: dict) -> str:
    """Extract plain-text body from a Gmail message payload, walking multipart parts."""
    if payload.get("mimeType") == "text/plain" and "data" in payload.get("body", {}):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    for part in payload.get("parts", []) or []:
        text = _decode_body(part)
        if text:
            return text
    return ""


def _extract_attachments(payload: dict) -> list[dict]:
    """Walk the MIME tree collecting real attachments (parts with a filename and a Gmail attachmentId)."""
    found = []
    if payload.get("filename") and payload.get("body", {}).get("attachmentId"):
        found.append(
            {
                "id": payload["body"]["attachmentId"],
                "filename": payload["filename"],
                "mime_type": payload.get("mimeType"),
                "size": payload.get("body", {}).get("size", 0),
            }
        )
    for part in payload.get("parts", []) or []:
        found.extend(_extract_attachments(part))
    return found


def fetch_recent_messages(max_results: int = 20, after: int | None = None, before: int | None = None) -> list[dict]:
    """Fetch inbox messages, optionally scoped to a date window.

    `after`/`before` are unix epoch seconds, matching Gmail's own
    `after:N`/`before:N` search-query operators - the same ones the history
    range presets (30/60/90 days, custom dates) build on the frontend.
    """
    service = _service()
    query_parts = []
    if after is not None:
        query_parts.append(f"after:{after}")
    if before is not None:
        query_parts.append(f"before:{before}")
    query = " ".join(query_parts) or None

    list_kwargs = {"userId": "me", "maxResults": max_results, "labelIds": ["INBOX"]}
    if query:
        list_kwargs["q"] = query
    resp = service.users().messages().list(**list_kwargs).execute()

    results = []
    for msg_ref in resp.get("messages", []):
        msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="full").execute()
        headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
        # internalDate (epoch ms, set by Gmail on receipt) sorts correctly as
        # a string once converted to ISO 8601 - the human-readable Date
        # header doesn't (day-of-month isn't zero-padded), which breaks
        # chronological ordering of a thread's back-and-forth.
        internal_date = msg.get("internalDate")
        received_date = (
            datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc).isoformat()
            if internal_date
            else headers.get("Date", "")
        )
        label_ids = set(msg.get("labelIds", []))
        gmail_category = next((tag for label, tag in _GMAIL_CATEGORY_LABELS.items() if label in label_ids), "primary")
        results.append(
            {
                "gmail_message_id": msg["id"],
                "thread_id": msg["threadId"],
                "subject": headers.get("Subject", "(no subject)"),
                "sender": headers.get("From", ""),
                "recipient": headers.get("To", ""),
                "received_date": received_date,
                "body": _decode_body(msg["payload"]),
                "is_read": "UNREAD" not in label_ids,
                "gmail_category": gmail_category,
                "attachments": _extract_attachments(msg["payload"]),
            }
        )
    return results


def mark_read(message_id: str, read: bool) -> None:
    service = _service()
    body = {"removeLabelIds": ["UNREAD"]} if read else {"addLabelIds": ["UNREAD"]}
    service.users().messages().modify(userId="me", id=message_id, body=body).execute()


def trash_email(message_id: str) -> None:
    service = _service()
    service.users().messages().trash(userId="me", id=message_id).execute()


def untrash_email(message_id: str) -> None:
    service = _service()
    service.users().messages().untrash(userId="me", id=message_id).execute()


def get_attachment_data(message_id: str, attachment_id: str) -> bytes:
    service = _service()
    att = service.users().messages().attachments().get(userId="me", messageId=message_id, id=attachment_id).execute()
    return base64.urlsafe_b64decode(att["data"])


def send_reply(thread_id: str, to: str, subject: str, body: str) -> dict:
    service = _service()
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    sent = service.users().messages().send(userId="me", body={"raw": raw, "threadId": thread_id}).execute()
    return {
        "gmail_message_id": sent["id"],
        "thread_id": sent.get("threadId", thread_id),
        "received_date": datetime.now(timezone.utc).isoformat(),
    }
