"""Just the Gmail OAuth redirect target, kept out of emails.py deliberately.

Google's browser redirect lands here as a plain GET with no Authorization
header - it can't carry a bearer token, so this one route must stay public
even though the rest of /api/emails/* requires a logged-in session.
"""

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.services import gmail_client

router = APIRouter(prefix="/api/emails", tags=["emails"])

# Where the frontend "Email Manager" page lives - the browser is bounced
# back here (with a query param signaling success/failure) after Google
# redirects to the callback below.
_FRONTEND_EMAILS_URL = "http://localhost:5173/emails"


@router.get("/auth/callback")
async def auth_callback(code: str | None = None, error: str | None = None):
    if error:
        return RedirectResponse(f"{_FRONTEND_EMAILS_URL}?gmail_error={error}")
    if not code:
        return RedirectResponse(f"{_FRONTEND_EMAILS_URL}?gmail_error=missing_code")
    try:
        gmail_client.exchange_code(code)
    except Exception as exc:  # noqa: BLE001 - surface the failure to the user via redirect
        return RedirectResponse(f"{_FRONTEND_EMAILS_URL}?gmail_error={exc}")
    return RedirectResponse(f"{_FRONTEND_EMAILS_URL}?gmail_connected=1")
