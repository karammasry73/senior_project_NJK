from fastapi import APIRouter, HTTPException

from app.database import db_session
from app.models.schemas import (
    EmailAuthStatus,
    EmailAuthUrl,
    EmailDetail,
    EmailOut,
    SendReplyRequest,
)
from app.services import email_ai, gmail_client

router = APIRouter(prefix="/api/emails", tags=["emails"])


def _row_to_out(row) -> EmailOut:
    return EmailOut(
        id=row["id"],
        subject=row["subject"],
        sender=row["sender"],
        recipient=row["recipient"],
        received_date=row["received_date"],
        category=row["category"],
        summary=row["summary"],
        drafted_reply=row["drafted_reply"],
        sent=bool(row["sent"]),
        processed_date=row["processed_date"],
    )


@router.get("/auth/status", response_model=EmailAuthStatus)
async def auth_status() -> EmailAuthStatus:
    return EmailAuthStatus(configured=gmail_client.is_configured(), connected=gmail_client.is_connected())


@router.get("/auth/url", response_model=EmailAuthUrl)
async def auth_url() -> EmailAuthUrl:
    if not gmail_client.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Gmail OAuth client not configured - set SME_GOOGLE_CLIENT_ID / SME_GOOGLE_CLIENT_SECRET",
        )
    return EmailAuthUrl(url=gmail_client.get_auth_url())


@router.post("/sync", response_model=list[EmailOut])
async def sync_emails(max_results: int = 20) -> list[EmailOut]:
    if not gmail_client.is_connected():
        raise HTTPException(status_code=400, detail="Gmail is not connected yet")
    try:
        messages = gmail_client.fetch_recent_messages(max_results=max_results)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gmail sync failed: {exc}") from exc

    with db_session() as conn:
        for msg in messages:
            conn.execute(
                """
                INSERT INTO emails (gmail_message_id, thread_id, subject, sender, recipient, body, received_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(gmail_message_id) DO NOTHING
                """,
                (
                    msg["gmail_message_id"],
                    msg["thread_id"],
                    msg["subject"],
                    msg["sender"],
                    msg["recipient"],
                    msg["body"],
                    msg["received_date"],
                ),
            )
        rows = conn.execute("SELECT * FROM emails ORDER BY id DESC").fetchall()
    return [_row_to_out(r) for r in rows]


@router.get("", response_model=list[EmailOut])
async def list_emails() -> list[EmailOut]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM emails ORDER BY id DESC").fetchall()
    return [_row_to_out(r) for r in rows]


def _get_email_row(conn, email_id: int):
    row = conn.execute("SELECT * FROM emails WHERE id = ?", (email_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Email not found")
    return row


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(email_id: int) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    return EmailDetail(**_row_to_out(row).model_dump(), body=row["body"], thread_id=row["thread_id"])


@router.post("/{email_id}/classify", response_model=EmailDetail)
async def classify_email(email_id: int) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    try:
        category = await email_ai.classify(row["subject"] or "", row["body"] or "")
    except Exception as exc:  # noqa: BLE001 - most likely Ollama isn't reachable
        raise HTTPException(status_code=502, detail=f"Ollama classify failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET category = ? WHERE id = ?", (category, email_id))
        row = _get_email_row(conn, email_id)
    return EmailDetail(**_row_to_out(row).model_dump(), body=row["body"], thread_id=row["thread_id"])


@router.post("/{email_id}/summarize", response_model=EmailDetail)
async def summarize_email(email_id: int) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    try:
        summary = await email_ai.summarize(row["subject"] or "", row["body"] or "")
    except Exception as exc:  # noqa: BLE001 - most likely Ollama isn't reachable
        raise HTTPException(status_code=502, detail=f"Ollama summarize failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET summary = ? WHERE id = ?", (summary, email_id))
        row = _get_email_row(conn, email_id)
    return EmailDetail(**_row_to_out(row).model_dump(), body=row["body"], thread_id=row["thread_id"])


@router.post("/{email_id}/draft", response_model=EmailDetail)
async def draft_email(email_id: int) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    try:
        reply = await email_ai.draft_reply(row["subject"] or "", row["body"] or "", row["sender"] or "")
    except Exception as exc:  # noqa: BLE001 - most likely Ollama isn't reachable
        raise HTTPException(status_code=502, detail=f"Ollama draft failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET drafted_reply = ? WHERE id = ?", (reply, email_id))
        row = _get_email_row(conn, email_id)
    return EmailDetail(**_row_to_out(row).model_dump(), body=row["body"], thread_id=row["thread_id"])


@router.post("/{email_id}/send", response_model=EmailDetail)
async def send_email(email_id: int, request: SendReplyRequest) -> EmailDetail:
    """Sends the (possibly hand-edited) reply. This is the approval gate:
    nothing goes out via /draft alone - only an explicit call here, with
    whatever text the user actually reviewed, triggers a real send."""
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    try:
        gmail_client.send_reply(
            thread_id=row["thread_id"],
            to=row["sender"] or "",
            subject=row["subject"] or "",
            body=request.body,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Send failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET sent = 1, drafted_reply = ? WHERE id = ?", (request.body, email_id))
        row = _get_email_row(conn, email_id)
    return EmailDetail(**_row_to_out(row).model_dump(), body=row["body"], thread_id=row["thread_id"])
