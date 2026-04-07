"""Insights API route — computes and returns meeting metrics."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.middleware.auth import get_current_user, get_oauth_token
from server.models import OAuthToken, User
from server.services import calendar as cal_service
from server.services.insights import compute_insights
from server.services.google import credentials_from_tokens, decrypt_token

router = APIRouter()


def _build_creds(token: OAuthToken):
    return credentials_from_tokens(
        access_token=decrypt_token(token.access_token),
        refresh_token=decrypt_token(token.refresh_token),
        expires_at=token.expires_at,
    )


def _current_week_start() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


@router.get("")
async def get_insights(
    week: str = Query(
        default=None,
        description="ISO date of the Monday that starts the target week (e.g. '2026-04-06'). "
                    "Defaults to the current week.",
    ),
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Return computed meeting insights for the requested week.

    Query param:
      week: YYYY-MM-DD (Monday). Defaults to current week.
    """
    if week:
        week_start = date.fromisoformat(week)
    else:
        week_start = _current_week_start()

    start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=7)

    creds = _build_creds(token)
    events = cal_service.list_events(creds, start_dt, end_dt)
    insights = compute_insights(events, week_start)

    return insights
