from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    auth as auth_router,
    documents,
    emails,
    emails_oauth_callback,
    invoices,
    settings as settings_router,
    system,
    users,
    voice,
)
from app.services.auth import get_current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SME Automation Assistant API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(emails_oauth_callback.router)  # must stay public - see that file's docstring
app.include_router(users.router)  # users.py already gates itself with require_admin

# Everything else requires a logged-in session. System status stays public -
# it's a harmless health check and the frontend needs it before login too.
_authed = [Depends(get_current_user)]
app.include_router(documents.router, dependencies=_authed)
app.include_router(invoices.router, dependencies=_authed)
app.include_router(emails.router, dependencies=_authed)
app.include_router(voice.router, dependencies=_authed)
app.include_router(settings_router.router, dependencies=_authed)
app.include_router(system.router)


@app.get("/")
async def root():
    return {"name": "SME Automation Assistant API", "docs": "/docs"}
