"""Ollama-based email classification, summarization, and reply drafting."""

from app.services import ollama_client

_VALID_CATEGORIES = {"urgent", "follow_up", "informational", "action", "spam"}

_CLASSIFY_SYSTEM = (
    "You are an email triage assistant for a small business. Classify the given "
    "email into exactly one category: urgent, follow_up, informational, action, or spam. "
    "Respond with only the category word, nothing else."
)

_SUMMARIZE_SYSTEM = (
    "You are an email assistant. Summarize the following email in 2-4 concise "
    "bullet points capturing the key facts, requests, and any deadlines. "
    "Respond with only the bullet points, no preamble."
)

_DRAFT_SYSTEM = (
    "You are drafting a professional email reply on behalf of a small business owner. "
    "Write a concise, polite, professional reply addressing the sender's email directly. "
    "Do not include a subject line or 'Dear/Hi [name]' placeholder guessing - use the "
    "sender's name if it's evident from the email. Sign off simply. "
    "Respond with only the reply body, nothing else."
)


async def classify(subject: str, body: str) -> str:
    prompt = f"Subject: {subject}\n\n{body}"
    result = await ollama_client.generate(prompt, system=_CLASSIFY_SYSTEM)
    category = result.strip().lower().split()[0].strip(".,!") if result.strip() else "informational"
    return category if category in _VALID_CATEGORIES else "informational"


async def summarize(subject: str, body: str) -> str:
    prompt = f"Subject: {subject}\n\n{body}"
    return (await ollama_client.generate(prompt, system=_SUMMARIZE_SYSTEM)).strip()


async def draft_reply(subject: str, body: str, sender: str) -> str:
    prompt = f"From: {sender}\nSubject: {subject}\n\n{body}"
    return (await ollama_client.generate(prompt, system=_DRAFT_SYSTEM)).strip()
