from fastapi import APIRouter, Depends, HTTPException

from app.database import db_session
from app.models.schemas import UserCreateRequest, UserOut, UserUpdateRequest
from app.services import auth
from app.services.passwords import hash_password

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(auth.require_admin)])


def _row_to_out(row) -> UserOut:
    return UserOut(id=row["id"], username=row["username"], role=row["role"], created_at=row["created_at"])


@router.get("", response_model=list[UserOut])
async def list_users() -> list[UserOut]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    return [_row_to_out(r) for r in rows]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(body: UserCreateRequest) -> UserOut:
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=422, detail="role must be 'admin' or 'user'")
    if len(body.password) < 4:
        raise HTTPException(status_code=422, detail="Password must be at least 4 characters")
    with db_session() as conn:
        existing = conn.execute("SELECT 1 FROM users WHERE username = ?", (body.username,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (body.username, hash_password(body.password), body.role),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_out(row)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdateRequest, current: dict = Depends(auth.require_admin)) -> UserOut:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        if body.role is not None:
            if body.role not in ("admin", "user"):
                raise HTTPException(status_code=422, detail="role must be 'admin' or 'user'")
            if row["id"] == current["id"] and body.role != "admin":
                raise HTTPException(status_code=400, detail="You can't demote your own account")
            if row["role"] == "admin" and body.role != "admin":
                remaining = conn.execute(
                    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?", (user_id,)
                ).fetchone()["n"]
                if remaining == 0:
                    raise HTTPException(status_code=400, detail="Can't remove the last remaining admin")
            conn.execute("UPDATE users SET role = ? WHERE id = ?", (body.role, user_id))

        if body.password is not None:
            if len(body.password) < 4:
                raise HTTPException(status_code=422, detail="Password must be at least 4 characters")
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(body.password), user_id))

        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_out(row)


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, current: dict = Depends(auth.require_admin)) -> None:
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="You can't delete your own account")
    with db_session() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")
        if row["role"] == "admin":
            remaining = conn.execute(
                "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?", (user_id,)
            ).fetchone()["n"]
            if remaining == 0:
                raise HTTPException(status_code=400, detail="Can't delete the last remaining admin")
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
