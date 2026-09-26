import httpx

from app.config import settings
from app.models.schemas import ServiceStatus


async def check_status() -> ServiceStatus:
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            resp = await client.get(f"{settings.ollama_host}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            if settings.ollama_model in models:
                return ServiceStatus(available=True, detail=f"connected, {settings.ollama_model} loaded")
            return ServiceStatus(
                available=True,
                detail=f"connected, but {settings.ollama_model} not pulled (found: {', '.join(models) or 'none'})",
            )
    except httpx.ConnectError:
        return ServiceStatus(available=False, detail=f"cannot reach Ollama at {settings.ollama_host}")
    except Exception as exc:  # noqa: BLE001 - surface any failure as a status detail
        return ServiceStatus(available=False, detail=f"error: {exc}")


async def generate(
    prompt: str,
    system: str | None = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 600,
) -> str:
    """Call Ollama's /api/generate. Used by the document pipeline and email services (Phase 3).

    Per-task tuning: the caller picks `temperature`/`max_tokens` to match the job.
    A classification is a deterministic single label (temperature 0, a handful of
    tokens); a summary is neutral; a drafted reply gets a little more freedom.
    `num_predict` is a safety net so a rambling answer can't burn CPU time.

    think=False matters a lot: qwen3.5 (this machine's default model) is a
    reasoning model that otherwise emits a long internal chain-of-thought
    before its actual answer - measured at 3000+ tokens (7+ minutes on this
    CPU) for a five-word reply with thinking left on. With it off, the same
    request takes about 1.5s. It stays unconditionally off regardless of task.
    """
    payload: dict = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": max_tokens,
        },
    }
    if system:
        payload["system"] = system
    if json_mode:
        payload["format"] = "json"

    # 120s, not 60s: a cold model load on CPU-only hardware (first request
    # after the model was last unloaded from RAM) can take a while by itself,
    # before generation even starts.
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{settings.ollama_host}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json()["response"]
