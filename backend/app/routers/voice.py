from fastapi import APIRouter, HTTPException

from app.database import db_session
from app.models.schemas import ChatMessageRequest, ChatMessageResponse, VoiceCommandRequest, VoiceCommandResponse
from app.services import ollama_client

router = APIRouter(prefix="/api/voice", tags=["voice"])

_SYSTEM_PROMPT = (
    "You are the AI Assistant for a small business automation tool (document/invoice "
    "extraction via YOLO+PaddleOCR, and an email manager via Gmail+Ollama). Answer the "
    "user's question concisely and helpfully. You are given real current counts from the "
    "system below - use them when relevant, and say so plainly when something isn't "
    "possible yet (e.g. you cannot upload or open a specific file yourself; direct the "
    "user to the Documents/Invoices/Email Manager pages for that). Do not invent numbers "
    "beyond what's given. Respond in plain text, no markdown."
)


def _grounding_context() -> str:
    """Real current counts, injected into every chat prompt so the assistant's answers
    reflect actual system state instead of guessing or hallucinating numbers."""
    with db_session() as conn:
        doc_rows = conn.execute("SELECT status, COUNT(*) AS n FROM documents GROUP BY status").fetchall()
        doc_counts = {r["status"]: r["n"] for r in doc_rows}
        invoices_needing_review = conn.execute(
            "SELECT COUNT(*) AS n FROM invoices WHERE needs_review = 1"
        ).fetchone()["n"]
        invoices_total = conn.execute("SELECT COUNT(*) AS n FROM invoices").fetchone()["n"]
        emails_unread = conn.execute(
            "SELECT COUNT(*) AS n FROM emails WHERE is_read = 0 AND direction = 'in'"
        ).fetchone()["n"]
        emails_total = conn.execute("SELECT COUNT(*) AS n FROM emails").fetchone()["n"]

    return (
        f"Documents: {sum(doc_counts.values())} total "
        f"({doc_counts.get('processed', 0)} processed, {doc_counts.get('pending', 0)} pending, "
        f"{doc_counts.get('processing', 0)} processing, {doc_counts.get('failed', 0)} failed).\n"
        f"Invoices: {invoices_total} total, {invoices_needing_review} flagged for review.\n"
        f"Emails: {emails_total} total, {emails_unread} unread."
    )


@router.post("/chat", response_model=ChatMessageResponse)
async def chat(request: ChatMessageRequest) -> ChatMessageResponse:
    if not request.message.strip():
        raise HTTPException(status_code=422, detail="Message can't be empty")
    prompt = f"Current system state:\n{_grounding_context()}\n\nUser: {request.message}"
    try:
        reply = await ollama_client.generate(prompt, system=_SYSTEM_PROMPT)
    except Exception as exc:  # noqa: BLE001 - most likely Ollama isn't reachable
        raise HTTPException(status_code=502, detail=f"Ollama chat failed: {exc}") from exc
    return ChatMessageResponse(reply=reply.strip())


@router.post("/command", response_model=VoiceCommandResponse)
async def run_voice_command(body: VoiceCommandRequest) -> VoiceCommandResponse:
    raise HTTPException(
        status_code=501,
        detail="Voice command routing (mic -> VoxType transcription -> action) isn't wired up yet - "
        "use POST /api/voice/chat to talk to the assistant by text in the meantime.",
    )
