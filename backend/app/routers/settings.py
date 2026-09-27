from fastapi import APIRouter

from app.config import settings as app_settings
from app.database import db_session
from app.models.schemas import SettingOut, StatsResponse

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=list[SettingOut])
async def get_settings() -> list[SettingOut]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM settings").fetchall()
    return [SettingOut(key=r["key"], value=r["value"]) for r in rows]


@router.put("", response_model=list[SettingOut])
async def update_settings(body: list[SettingOut]) -> list[SettingOut]:
    with db_session() as conn:
        for item in body:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (item.key, item.value),
            )
        rows = conn.execute("SELECT * FROM settings").fetchall()
    return [SettingOut(key=r["key"], value=r["value"]) for r in rows]


def _dir_size(path) -> int:
    if not path.exists():
        return 0
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


@router.get("/stats", response_model=StatsResponse)
async def get_stats() -> StatsResponse:
    """Real counts and disk usage for the Settings page - no dummy numbers."""
    with db_session() as conn:
        documents = conn.execute("SELECT COUNT(*) AS n FROM documents").fetchone()["n"]
        invoices = conn.execute("SELECT COUNT(*) AS n FROM invoices").fetchone()["n"]
        emails = conn.execute("SELECT COUNT(*) AS n FROM emails").fetchone()["n"]
        users_count = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]

    db_size = app_settings.db_path.stat().st_size if app_settings.db_path.exists() else 0
    uploads_size = _dir_size(app_settings.upload_dir)

    return StatsResponse(
        documents=documents,
        invoices=invoices,
        emails=emails,
        users=users_count,
        db_size_bytes=db_size,
        uploads_size_bytes=uploads_size,
        ollama_model=app_settings.ollama_model,
        ollama_host=app_settings.ollama_host,
        paddleocr_lang=app_settings.paddleocr_lang,
    )
