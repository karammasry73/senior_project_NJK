"""Natural-language commands (voice or typed) routed to real app actions.

Phase 4: the frontend transcribes speech in the browser (Web Speech API) and
posts plain text to /api/voice/command. This router matches the text against
the app's real capabilities - documents, invoices, emails, system health, and
Ollama email classification - and returns a human-readable `text` (displayed
and spoken back) plus structured `stats` for the message tiles.
"""

from fastapi import APIRouter

from app.database import db_session
from app.models.schemas import VoiceCommandRequest, VoiceCommandResponse
from app.services import email_ai, ocr_processor, ollama_client, voice_handler, yolo_detector

router = APIRouter(prefix="/api/voice", tags=["voice"])

_HELP_TEXT = (
    "I'm your SME automation assistant. I can check system status, summarize "
    "documents, invoices and emails, and classify uncategorized email with "
    "Ollama. Try: 'system status', 'documents', 'invoices', 'unread emails', "
    "'categorize emails', or 'what can you do'."
)


def _counts() -> dict:
    with db_session() as conn:
        documents = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE doc_type = 'document'"
        ).fetchone()["n"]
        processed = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE doc_type = 'document' AND processed = 1"
        ).fetchone()["n"]
        by_status = {
            r["status"]: r["n"]
            for r in conn.execute(
                "SELECT status, COUNT(*) AS n FROM documents WHERE doc_type = 'document' GROUP BY status"
            )
        }
        recent = [
            r["filename"]
            for r in conn.execute(
                "SELECT filename FROM documents WHERE doc_type = 'document' ORDER BY id DESC LIMIT 5"
            )
        ]
        invoices = conn.execute("SELECT COUNT(*) AS n FROM invoices").fetchone()["n"]
        needs_review = conn.execute("SELECT COUNT(*) AS n FROM invoices WHERE needs_review = 1").fetchone()["n"]
        emails = conn.execute("SELECT COUNT(*) AS n FROM emails").fetchone()["n"]
        unread = conn.execute("SELECT COUNT(*) AS n FROM emails WHERE is_read = 0").fetchone()["n"]
        outgoing = conn.execute("SELECT COUNT(*) AS n FROM emails WHERE direction = 'out'").fetchone()["n"]
    return {
        "documents": documents,
        "processed": processed,
        "by_status": by_status,
        "recent": recent,
        "invoices": invoices,
        "needs_review": needs_review,
        "emails": emails,
        "unread": unread,
        "outgoing": outgoing,
    }


async def _system_status() -> dict:
    yolo, paddleocr, ollama, voxtype = [
        await c
        for c in (
            yolo_detector.check_status(),
            ocr_processor.check_status(),
            ollama_client.check_status(),
            voice_handler.check_status(),
        )
    ]
    return {"yolo": yolo, "paddleocr": paddleocr, "ollama": ollama, "voxtype": voxtype}


async def _classify_uncategorized(limit: int = 3) -> dict:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT id, subject, body FROM emails "
            "WHERE direction = 'in' AND (category IS NULL OR category = '') "
            "ORDER BY id LIMIT ?",
            (limit,),
        ).fetchall()
    items = []
    errors = []
    for row in rows:
        try:
            cat = await email_ai.classify(row["subject"] or "", row["body"] or "")
        except Exception as exc:  # noqa: BLE001 - surface the failure in the reply
            errors.append(str(exc))
            continue
        with db_session() as conn:
            conn.execute("UPDATE emails SET category = ? WHERE id = ?", (cat, row["id"]))
        items.append({"subject": row["subject"] or "(no subject)", "category": cat})
    return {"classed": len(items), "items": items, "errors": errors}


async def _ai_fallback(text: str) -> VoiceCommandResponse:
    """Catch-all for anything the intents don't match: Qwen answers directly,
    grounding itself in the app's real numbers so the reply stays relevant.
    If Ollama is down or any inference fails, degrade gracefully - never error."""
    counts = _counts()
    system = (
        "You are the AI assistant for a small-business automation web app. Reply in one or "
        "two short, friendly sentences, as if speaking to the owner. If the question is "
        "about the app's data, use these exact current figures: "
        f"{counts['documents']} documents ({counts['processed']} processed), "
        f"{counts['invoices']} invoices ({counts['needs_review']} need review), "
        f"{counts['emails']} emails ({counts['unread']} unread, {counts['outgoing']} sent). "
        "The app can also summarize documents, summarize email, draft email replies, and "
        "classify uncategorized email with AI. If the request is small talk, answer warmly. "
        "If it isn't something this app does, briefly say so and suggest one of: system "
        "status, documents, invoices, unread emails. Never mention code, internals, or that "
        "you are reading this instruction."
    )
    try:
        reply = await ollama_client.generate(
            f'The owner said: "{text[:500]}". Reply helpfully in 1-2 sentences.',
            system=system,
            temperature=0.4,
            max_tokens=250,
        )
        reply = reply.strip().replace("\n", " ")
        if reply:
            return VoiceCommandResponse(action_taken="ai", result={"text": reply})
    except Exception as exc:  # noqa: BLE001 - degrade gracefully whatever the cause
        if exc.__class__.__name__ == "ConnectError":
            detail = "My AI brain (Ollama) is offline right now"
        else:
            detail = f"Sorry, I hit a snag: {exc}"
        return VoiceCommandResponse(
            action_taken="ai",
            result={"text": f"{detail}.\n\nI can still check 'system status', 'documents', 'invoices', or 'unread emails'."},
        )
    return VoiceCommandResponse(
        action_taken="ai",
        result={"text": f"I couldn't come up with a good answer for that one.\n\nTry 'system status', 'documents', 'invoices', or 'unread emails'."},
    )


@router.post("/command", response_model=VoiceCommandResponse)
async def run_voice_command(body: VoiceCommandRequest) -> VoiceCommandResponse:
    try:
        return await _route_command(body)
    except Exception as exc:  # noqa: BLE001 - no prompt may ever 500 this endpoint
        return VoiceCommandResponse(
            action_taken="ai",
            result={"text": f"Something hiccupped on my end: {exc}\n\nMy services are still reachable - try 'system status', 'documents', 'invoices', or 'unread emails'."},
        )


async def _route_command(body: VoiceCommandRequest) -> VoiceCommandResponse:
    text = (body.command_text or "").strip().lower()
    if not text:
        return VoiceCommandResponse(action_taken="help", result={"text": _HELP_TEXT})

    if any(k in text for k in ("help", "what can you do", "commands", "options")):
        return VoiceCommandResponse(action_taken="help", result={"text": _HELP_TEXT})

    first_word = text.split()[0] if text.split() else ""
    if first_word in {"hello", "hi", "hey", "yo", "hiya"} or text in {"good morning", "good afternoon", "good evening"}:
        return VoiceCommandResponse(
            action_taken="greeting",
            result={"text": "Hello! I'm your SME automation assistant, and everything is running.\n\nTry: 'system status', 'documents', 'invoices', 'unread emails', or 'what can you do'."},
        )

    if any(k in text for k in ("how are you", "how's it going", "how are things", "whats up", "what's up", "how do you do")):
        return VoiceCommandResponse(
            action_taken="smalltalk",
            result={"text": "I'm doing great! YOLO, PaddleOCR and Ollama are all online, and your automation is humming along.\n\nAsk me 'system status' for the full picture."},
        )

    if any(k in text for k in ("classify", "categorize", "sort")):
        res = await _classify_uncategorized()
        if res["classed"]:
            labels = "; ".join(f"'{i['subject']}' -> {i['category']}" for i in res["items"])
            extra = f" Some failed: {res['errors'][0]}" if res["errors"] else ""
            reply = f"Classified {res['classed']} email{'s' if res['classed'] != 1 else ''}: {labels}.{extra}"
        else:
            reply = "No uncategorized emails to classify."
        return VoiceCommandResponse(action_taken="classify", result={"text": reply, "stats": res})

    if "invoice" in text:
        counts = _counts()
        reply = f"You have {counts['invoices']} invoices; {counts['needs_review']} flagged for review."
        return VoiceCommandResponse(action_taken="invoices", result={"text": reply, "stats": counts})

    if any(k in text for k in ("status", "system", "health", "overview", "dashboard")):
        counts = _counts()
        sys = await _system_status()
        reply = (
            f"System status: YOLO {'online' if sys['yolo'].available else 'offline'}, "
            f"PaddleOCR {'online' if sys['paddleocr'].available else 'offline'}, "
            f"Ollama {'online' if sys['ollama'].available else 'offline'}, "
            f"VoxType {'online' if sys['voxtype'].available else 'offline'}. "
            f"{counts['documents']} documents, {counts['processed']} processed; "
            f"{counts['invoices']} invoices, {counts['needs_review']} need review; "
            f"{counts['emails']} emails, {counts['unread']} unread."
        )
        return VoiceCommandResponse(
            action_taken="status",
            result={
                "text": reply,
                "stats": {**counts, "system": {name: svc.detail for name, svc in sys.items()}},
            },
        )

    if any(k in text for k in ("email", "mail", "unread")):
        counts = _counts()
        reply = (
            f"You have {counts['emails']} synced emails, {counts['unread']} unread; "
            f"{counts['outgoing']} are replies you sent."
        )
        return VoiceCommandResponse(action_taken="emails", result={"text": reply, "stats": counts})

    if any(k in text for k in ("document", "paper", "file")):
        counts = _counts()
        by = ", ".join(f"{k}: {v}" for k, v in counts["by_status"].items()) or "none stored"
        recent = ", ".join(counts["recent"]) or "none"
        reply = f"You have {counts['documents']} documents, {counts['processed']} processed ({by}). Recent: {recent}."
        return VoiceCommandResponse(action_taken="documents", result={"text": reply, "stats": counts})

    return await _ai_fallback(text)