from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.schemas import LoginRequest, LoginResponse, UserOut
from app.services import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])

_security = HTTPBearer()


def _user_out(user: dict) -> UserOut:
    return UserOut(id=user["id"], username=user["username"], role=user["role"], created_at=user["created_at"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    user = auth.authenticate(body.username, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = auth.create_session(user["id"])
    return LoginResponse(token=token, user=_user_out(user))


@router.post("/logout", status_code=204)
async def logout(creds: HTTPAuthorizationCredentials = Depends(_security)) -> None:
    auth.revoke_session(creds.credentials)


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(auth.get_current_user)) -> UserOut:
    return _user_out(user)
