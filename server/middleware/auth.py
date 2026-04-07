"""Session middleware: UUID cookie → user_id lookup."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.models import OAuthToken, Session, User


async def get_current_user(
    session_id: Optional[str] = Cookie(None, alias="session_id"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve session cookie → User. Raises 401 if missing or expired."""
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Session).where(Session.id == sid, Session.expires_at > now)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    # Update last_seen_at without a full load
    await db.execute(
        update(Session).where(Session.id == sid).values(last_seen_at=now)
    )
    await db.commit()

    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_oauth_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OAuthToken:
    """Fetch the OAuth token row for the current user."""
    result = await db.execute(
        select(OAuthToken).where(OAuthToken.user_id == current_user.id)
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="OAuth token not found"
        )
    return token
