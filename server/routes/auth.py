"""Google OAuth2 routes: initiate, callback, logout, me."""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.middleware.auth import get_current_user
from server.models import OAuthToken, Session, User
from server.services.google import build_flow, decrypt_token, encrypt_token

router = APIRouter()

SESSION_DURATION_DAYS = 30


@router.get("/google")
async def login_google(request: Request):
    """Start OAuth flow — redirect user to Google's consent screen."""
    flow = build_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    response = Response(status_code=302)
    response.headers["Location"] = auth_url
    # Store state in a short-lived cookie for CSRF protection
    response.set_cookie(
        "oauth_state",
        state,
        httponly=True,
        samesite="lax",
        max_age=600,
    )
    return response


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    oauth_state: str = Cookie(None),
):
    """Handle Google's redirect, exchange code for tokens, upsert user, set session cookie."""
    if not oauth_state or oauth_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    flow = build_flow(state=state)
    flow.fetch_token(code=code)
    creds = flow.credentials

    # Fetch user profile
    people_service = build("oauth2", "v2", credentials=creds, cache_discovery=False)
    user_info = people_service.userinfo().get().execute()

    google_id = user_info["id"]
    email = user_info["email"]
    name = user_info.get("name", email)
    picture = user_info.get("picture")

    # Upsert user
    stmt = (
        pg_insert(User)
        .values(
            id=uuid.uuid4(),
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
        )
        .on_conflict_do_update(
            index_elements=["google_id"],
            set_={"email": email, "name": name, "picture": picture},
        )
        .returning(User.id)
    )
    result = await db.execute(stmt)
    user_id = result.scalar_one()

    # Upsert OAuth tokens (encrypted)
    expires_at = creds.expiry
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    token_stmt = (
        pg_insert(OAuthToken)
        .values(
            user_id=user_id,
            access_token=encrypt_token(creds.token),
            refresh_token=encrypt_token(creds.refresh_token or ""),
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            index_elements=["user_id"],
            set_={
                "access_token": encrypt_token(creds.token),
                "refresh_token": encrypt_token(creds.refresh_token or ""),
                "expires_at": expires_at,
                "updated_at": datetime.now(timezone.utc),
            },
        )
    )
    await db.execute(token_stmt)

    # Create server-side session
    session_id = uuid.uuid4()
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    db.add(Session(id=session_id, user_id=user_id, expires_at=expires))
    await db.commit()

    # Set session cookie and redirect to app
    response.set_cookie(
        "session_id",
        str(session_id),
        httponly=True,
        samesite="lax",
        secure=True,
        max_age=SESSION_DURATION_DAYS * 86400,
    )
    response.delete_cookie("oauth_state")
    response.status_code = 302
    response.headers["Location"] = "/"
    return response


@router.post("/logout")
async def logout(
    response: Response,
    session_id: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """Delete the session row and clear the cookie."""
    if session_id:
        try:
            sid = uuid.UUID(session_id)
            await db.execute(delete(Session).where(Session.id == sid))
            await db.commit()
        except ValueError:
            pass
    response.delete_cookie("session_id")
    return {"status": "logged_out"}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
    }
