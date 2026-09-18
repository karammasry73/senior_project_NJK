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
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.config import settings
from app.database import db_session

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
]

_TOKEN_KEY = "gmail_oauth_token"
_CODE_VERIFIER_KEY = "gmail_oauth_code_verifier"


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
        creds.refresh(Request())
        _save_token(creds)
    return creds


def is_connected() -> bool:
    return _load_credentials() is not None


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


def fetch_recent_messages(max_results: int = 20) -> list[dict]:
    service = _service()
    resp = service.users().messages().list(userId="me", maxResults=max_results, labelIds=["INBOX"]).execute()
    results = []
    for msg_ref in resp.get("messages", []):
        msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="full").execute()
        headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
        results.append(
            {
                "gmail_message_id": msg["id"],
                "thread_id": msg["threadId"],
                "subject": headers.get("Subject", "(no subject)"),
                "sender": headers.get("From", ""),
                "recipient": headers.get("To", ""),
                "received_date": headers.get("Date", ""),
                "body": _decode_body(msg["payload"]),
            }
        )
    return results


def send_reply(thread_id: str, to: str, subject: str, body: str) -> None:
    service = _service()
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw, "threadId": thread_id}).execute()
