from email.utils import parseaddr

from fastapi import APIRouter, HTTPException, Response

from app.database import db_session
from app.models.schemas import (
    AttachmentOut,
    EmailAuthStatus,
    EmailAuthUrl,
    EmailDetail,
    EmailOut,
    MarkReadRequest,
    NameSenderRequest,
    PositionRequest,
    RestoreEmailRequest,
    SendReplyRequest,
)
from app.services import email_ai, gmail_client

router = APIRouter(prefix="/api/emails", tags=["emails"])


def _bare_address(header_value: str | None) -> str:
    """"Name <addr@x.com>" -> "addr@x.com" (also handles a bare address with no name)."""
    return parseaddr(header_value or "")[1].lower()


def _build_out(row, custom_name: str | None, attachments: list[AttachmentOut]) -> EmailOut:
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
        thread_id=row["thread_id"],
        direction=row["direction"],
        is_read=bool(row["is_read"]),
        pos_x=row["pos_x"],
        pos_y=row["pos_y"],
        gmail_category=row["gmail_category"],
        custom_name=custom_name,
        attachments=attachments,
    )


def _row_to_out(conn, row) -> EmailOut:
    """Single-row path (classify/summarize/draft/etc. all touch exactly one email) - two
    small lookups here are negligible. List endpoints use _rows_to_out instead, which
    batches both lookups across every row rather than re-querying per email."""
    custom = conn.execute(
        "SELECT custom_name FROM sender_names WHERE sender_email = ?", (_bare_address(row["sender"]),)
    ).fetchone()
    atts = conn.execute(
        "SELECT id, filename, mime_type, size FROM attachments WHERE email_id = ?", (row["id"],)
    ).fetchall()
    attachments = [AttachmentOut(id=a["id"], filename=a["filename"], mime_type=a["mime_type"], size=a["size"]) for a in atts]
    return _build_out(row, custom["custom_name"] if custom else None, attachments)


def _rows_to_out(conn, rows) -> list[EmailOut]:
    """Same shape as _row_to_out, but for a whole page of emails at once: one query for
    every sender's custom name and one for every attachment, instead of two per row."""
    if not rows:
        return []

    names_by_address = {
        r["sender_email"]: r["custom_name"] for r in conn.execute("SELECT sender_email, custom_name FROM sender_names")
    }

    ids = [row["id"] for row in rows]
    placeholders = ",".join("?" * len(ids))
    attachments_by_email: dict[int, list[AttachmentOut]] = {}
    for a in conn.execute(
        f"SELECT id, email_id, filename, mime_type, size FROM attachments WHERE email_id IN ({placeholders})", ids
    ):
        attachments_by_email.setdefault(a["email_id"], []).append(
            AttachmentOut(id=a["id"], filename=a["filename"], mime_type=a["mime_type"], size=a["size"])
        )

    return [
        _build_out(row, names_by_address.get(_bare_address(row["sender"])), attachments_by_email.get(row["id"], []))
        for row in rows
    ]


def _detail(conn, row) -> EmailDetail:
    return EmailDetail(**_row_to_out(conn, row).model_dump(), body=row["body"])


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
async def sync_emails(max_results: int = 20, after: int | None = None, before: int | None = None) -> list[EmailOut]:
    """`after`/`before` are unix epoch seconds - the history-range presets (30/60/90 days, custom
    dates) on the frontend convert to this before calling. Omit both for Gmail's normal recency order."""
    if not gmail_client.is_connected():
        raise HTTPException(status_code=400, detail="Gmail is not connected yet")
    try:
        messages = gmail_client.fetch_recent_messages(max_results=max_results, after=after, before=before)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gmail sync failed: {exc}") from exc

    with db_session() as conn:
        for msg in messages:
            conn.execute(
                """
                INSERT INTO emails
                    (gmail_message_id, thread_id, subject, sender, recipient, body, received_date, is_read, gmail_category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(gmail_message_id) DO UPDATE SET
                    is_read = excluded.is_read,
                    gmail_category = excluded.gmail_category
                """,
                (
                    msg["gmail_message_id"],
                    msg["thread_id"],
                    msg["subject"],
                    msg["sender"],
                    msg["recipient"],
                    msg["body"],
                    msg["received_date"],
                    int(msg["is_read"]),
                    msg["gmail_category"],
                ),
            )
            row = conn.execute(
                "SELECT id FROM emails WHERE gmail_message_id = ?", (msg["gmail_message_id"],)
            ).fetchone()
            conn.execute("DELETE FROM attachments WHERE email_id = ?", (row["id"],))
            for att in msg["attachments"]:
                conn.execute(
                    "INSERT INTO attachments (id, email_id, filename, mime_type, size) VALUES (?, ?, ?, ?, ?) "
                    "ON CONFLICT(id) DO NOTHING",
                    (att["id"], row["id"], att["filename"], att["mime_type"], att["size"]),
                )
        rows = conn.execute("SELECT * FROM emails ORDER BY id DESC").fetchall()
        return _rows_to_out(conn, rows)


@router.get("", response_model=list[EmailOut])
async def list_emails() -> list[EmailOut]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM emails ORDER BY id DESC").fetchall()
        return _rows_to_out(conn, rows)


def _get_email_row(conn, email_id: int):
    row = conn.execute("SELECT * FROM emails WHERE id = ?", (email_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Email not found")
    return row


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(email_id: int) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
        return _detail(conn, row)


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
        return _detail(conn, row)


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
        return _detail(conn, row)


@router.post("/{email_id}/draft", response_model=EmailDetail)
async def draft_email(email_id: int, instructions: str | None = None) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    try:
        reply = await email_ai.draft_reply(row["subject"] or "", row["body"] or "", row["sender"] or "", instructions)
    except Exception as exc:  # noqa: BLE001 - most likely Ollama isn't reachable
        raise HTTPException(status_code=502, detail=f"Ollama draft failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET drafted_reply = ? WHERE id = ?", (reply, email_id))
        row = _get_email_row(conn, email_id)
        return _detail(conn, row)


@router.post("/{email_id}/send", response_model=EmailDetail)
async def send_email(email_id: int, request: SendReplyRequest) -> EmailDetail:
    """Sends the (possibly hand-edited) reply. This is the approval gate:
    nothing goes out via /draft alone - only an explicit call here, with
    whatever text the user actually reviewed, triggers a real send.

    The outgoing reply is also inserted as its own row (direction='out') in
    the same thread, so a real back-and-forth exchange shows up as an actual
    multi-node branch instead of just a "Replied" badge on the original."""
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    try:
        sent = gmail_client.send_reply(
            thread_id=row["thread_id"],
            to=row["sender"] or "",
            subject=row["subject"] or "",
            body=request.body,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Send failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET sent = 1, drafted_reply = ? WHERE id = ?", (request.body, email_id))
        conn.execute(
            """
            INSERT INTO emails
                (gmail_message_id, thread_id, subject, sender, recipient, body, received_date, category, sent, direction, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'out', 1)
            ON CONFLICT(gmail_message_id) DO NOTHING
            """,
            (
                sent["gmail_message_id"],
                sent["thread_id"],
                row["subject"],
                "You",
                row["sender"],
                request.body,
                sent["received_date"],
                row["category"],
            ),
        )
        row = _get_email_row(conn, email_id)
        return _detail(conn, row)


@router.post("/{email_id}/mark", response_model=EmailDetail)
async def mark_email(email_id: int, request: MarkReadRequest) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    if row["gmail_message_id"]:
        try:
            gmail_client.mark_read(row["gmail_message_id"], request.read)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Gmail mark failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("UPDATE emails SET is_read = ? WHERE id = ?", (int(request.read), email_id))
        row = _get_email_row(conn, email_id)
        return _detail(conn, row)


@router.post("/{email_id}/position", response_model=EmailDetail)
async def set_position(email_id: int, request: PositionRequest) -> EmailDetail:
    with db_session() as conn:
        _get_email_row(conn, email_id)
        conn.execute("UPDATE emails SET pos_x = ?, pos_y = ? WHERE id = ?", (request.x, request.y, email_id))
        row = _get_email_row(conn, email_id)
        return _detail(conn, row)


@router.post("/{email_id}/name-sender", response_model=EmailDetail)
async def name_sender(email_id: int, request: NameSenderRequest) -> EmailDetail:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
        conn.execute(
            "INSERT INTO sender_names (sender_email, custom_name) VALUES (?, ?) "
            "ON CONFLICT(sender_email) DO UPDATE SET custom_name = excluded.custom_name",
            (_bare_address(row["sender"]), request.name),
        )
        row = _get_email_row(conn, email_id)
        return _detail(conn, row)


@router.delete("/{email_id}", status_code=204)
async def delete_email(email_id: int) -> None:
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
    if row["gmail_message_id"]:
        try:
            gmail_client.trash_email(row["gmail_message_id"])
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Gmail trash failed: {exc}") from exc
    with db_session() as conn:
        conn.execute("DELETE FROM emails WHERE id = ?", (email_id,))


@router.post("/restore", response_model=EmailDetail)
async def restore_email(request: RestoreEmailRequest) -> EmailDetail:
    """Undo for delete - re-inserts the row the frontend still had cached (the list view's
    copy, so no message body) and best-effort untrashes it on Gmail's side too."""
    e = request.email
    gmail_message_id = e.get("gmail_message_id")
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO emails
                (gmail_message_id, thread_id, subject, sender, recipient, body, received_date,
                 category, summary, drafted_reply, sent, direction, is_read, gmail_category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(gmail_message_id) DO NOTHING
            """,
            (
                gmail_message_id,
                e.get("thread_id"),
                e.get("subject"),
                e.get("sender"),
                e.get("recipient"),
                e.get("body"),
                e.get("received_date"),
                e.get("category"),
                e.get("summary"),
                e.get("drafted_reply"),
                int(bool(e.get("sent"))),
                e.get("direction", "in"),
                int(bool(e.get("is_read", True))),
                e.get("gmail_category"),
            ),
        )
    if gmail_message_id:
        try:
            gmail_client.untrash_email(gmail_message_id)
        except Exception:  # noqa: BLE001 - best-effort, like the reference implementation
            pass
    with db_session() as conn:
        row = conn.execute("SELECT * FROM emails WHERE gmail_message_id = ?", (gmail_message_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=409, detail="Restore failed - no matching email")
        return _detail(conn, row)


@router.get("/{email_id}/attachments/{attachment_id}")
async def get_attachment(email_id: int, attachment_id: str):
    with db_session() as conn:
        row = _get_email_row(conn, email_id)
        att = conn.execute(
            "SELECT * FROM attachments WHERE id = ? AND email_id = ?", (attachment_id, email_id)
        ).fetchone()
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    try:
        data = gmail_client.get_attachment_data(row["gmail_message_id"], attachment_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to fetch attachment: {exc}") from exc
    return Response(
        content=data,
        media_type=att["mime_type"] or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{att["filename"] or "attachment"}"'},
    )
