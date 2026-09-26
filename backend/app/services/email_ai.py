"""Ollama-based email classification, summarization, and reply drafting.

Qwen is used for exactly three jobs, each with its own sampling profile:
  - classify:  one of 5 fixed labels -> JSON output, temperature 0, ~64 tokens
  - summarize: neutral 2-4 bullets  -> temperature 0.2
  - draft:     professional reply    -> temperature 0.4 (a little prose freedom)
"""

import json

from app.services import ollama_client

_VALID_CATEGORIES = {"urgent", "follow_up", "informational", "action", "spam"}

_CATEGORY_ALIASES = {
    "follow up": "follow_up",
    "follow-up": "follow_up",
    "followup": "follow_up",
    "info": "informational",
}

_CLASSIFY_SYSTEM = (
    "You are an email triage assistant for a small business. Classify the given "
    "email into exactly one category. Respond with JSON only: "
    '{"category": "<category>"}. Categories: urgent (time-sensitive, needs '
    "attention soon), action (requests a task/next step from us), follow_up "
    "(needs a reply, but not right now), informational (no action needed), "
    "spam (unsolicited). Choose the single best category, nothing else."
)

_SUMMARIZE_SYSTEM = (
    "You are an email assistant for a small business. Summarize the following "
    "email in 2-4 concise bullet points capturing the key facts, requests, and "
    "any deadlines. Keep each bullet to one line. Respond with only the bullet "
    "points, no preamble."
)

_DRAFT_SYSTEM = (
    "You are drafting a professional email reply on behalf of a small business owner. "
    "Write a concise, polite, professional reply addressing the sender's email directly. "
    "Do not include a subject line or 'Dear/Hi [name]' placeholder guessing - use the "
    "sender's name if it's evident from the email. Sign off simply with your own name, "
    "or omit the sign-off entirely rather than leaving placeholder text like [Your Name]. "
    "Respond with only the reply body, nothing else."
)


def _parse_category(result: str) -> str:
    category = result
    try:
        data = json.loads(result)
        if isinstance(data, dict):
            category = data.get("category", "")
    except ValueError:
        pass
    category = (category or "").strip().lower().strip(".,!\"' ")
    category = _CATEGORY_ALIASES.get(category, category)
    return category if category in _VALID_CATEGORIES else "informational"


async def classify(subject: str, body: str) -> str:
    prompt = f"Subject: {subject}\n\n{body}"
    result = await ollama_client.generate(
        prompt,
        system=_CLASSIFY_SYSTEM,
        json_mode=True,
        temperature=0.0,
        max_tokens=64,
    )
    return _parse_category(result)


async def summarize(subject: str, body: str) -> str:
    prompt = f"Subject: {subject}\n\n{body}"
    return (await ollama_client.generate(prompt, system=_SUMMARIZE_SYSTEM, temperature=0.2, max_tokens=400)).strip()


async def draft_reply(subject: str, body: str, sender: str, instructions: str | None = None) -> str:
    prompt = f"From: {sender}\nSubject: {subject}\n\n{body}"
    if instructions:
        prompt += f"\n\nAdditional instructions for this reply: {instructions}"
    return (await ollama_client.generate(prompt, system=_DRAFT_SYSTEM, temperature=0.4, max_tokens=600)).strip()
