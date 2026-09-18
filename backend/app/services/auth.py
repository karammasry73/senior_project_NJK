"""Session-based auth: opaque bearer tokens stored in the `sessions` table.

Simpler than JWT for a local single-process app - no secret-key management
to get right, and revoking a session is just deleting a row instead of
needing a blocklist.
"""

import secrets
import time

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import db_session
from app.services.passwords import verify_password

SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # a week - this is a local dev tool, not a bank

_security = HTTPBearer(auto_error=False)


def authenticate(username: str, password: str) -> dict | None:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return dict(row)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    with db_session() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at),
        )
    return token


def revoke_session(token: str) -> None:
    with db_session() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _user_from_token(token: str) -> dict | None:
    with db_session() as conn:
        row = conn.execute(
            """
            SELECT users.*, sessions.expires_at AS session_expires_at FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
    if row is None or row["session_expires_at"] < time.time():
        return None
    return dict(row)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_security),
    token: str | None = Query(default=None),
) -> dict:
    # Prefer the Authorization header (used by every fetch() call the app
    # makes) but fall back to a ?token= query param - needed for the one
    # case a browser attaches no custom headers at all: plain <img src=...>
    # tags (the document image preview). A URL-embedded token is a known,
    # accepted trade-off for that pattern in a local, non-internet-facing app.
    raw_token = creds.credentials if creds else token
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = _user_from_token(raw_token)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid - please log in again")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
