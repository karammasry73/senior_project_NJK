from fastapi import APIRouter

from app.database import db_session
from app.models.schemas import SettingOut

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
