"""Calendar API routes — events listing, creation, and patching."""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Path
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.middleware.auth import get_current_user, get_oauth_token
from server.models import OAuthToken, User
from server.services import calendar as cal_service
from server.services.google import credentials_from_tokens, decrypt_token

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _build_creds(token: OAuthToken):
    return credentials_from_tokens(
        access_token=decrypt_token(token.access_token),
        refresh_token=decrypt_token(token.refresh_token),
        expires_at=token.expires_at,
    )


@router.get("/events")
async def get_events(
    start: datetime = Query(
        default=None,
        description="Start of date range (ISO 8601). Defaults to start of current week.",
    ),
    end: datetime = Query(
        default=None,
        description="End of date range (ISO 8601). Defaults to end of current week.",
    ),
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
    db: AsyncSession = Depends(get_db),
):
    """Return calendar events for the given date range."""
    now = datetime.now(timezone.utc)
    if start is None:
        start = now - timedelta(days=now.weekday())  # Monday
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    if end is None:
        end = start + timedelta(days=7)

    creds = _build_creds(token)
    events = cal_service.list_events(creds, start, end)
    return {"events": events}


@router.get("/freebusy")
async def get_freebusy(
    start: datetime = Query(...),
    end: datetime = Query(...),
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
):
    """Return freebusy data for the current user's primary calendar."""
    creds = _build_creds(token)
    result = cal_service.get_free_slots(creds, start, end)
    return result


@router.post("/events")
async def create_event(
    title: str,
    start: datetime,
    end: datetime,
    attendees: Optional[List[str]] = Query(None),
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
):
    """Create a confirmed event on the user's primary calendar."""
    creds = _build_creds(token)
    event = cal_service.insert_event(
        creds,
        title=title,
        start=start,
        end=end,
        attendees=attendees,
        description=description,
    )
    return event


@router.patch("/events/{event_id}")
async def patch_event(
    event_id: str = Path(..., description="Google Calendar event ID"),
    title: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    attendees: Optional[List[str]] = Query(None),
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
):
    """Partially update an existing calendar event."""
    creds = _build_creds(token)
    event = cal_service.patch_event(
        creds,
        event_id=event_id,
        title=title,
        start=start,
        end=end,
        attendees=attendees,
        description=description,
    )
    return event
