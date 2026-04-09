"""MCP tool definitions for insights: compute_insights + generate_weekly_focus."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

import anthropic
from google.oauth2.credentials import Credentials
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.services import calendar as cal_service
from server.services.insights import compute_insights as _compute_insights

INSIGHTS_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "compute_insights",
        "description": (
            "Compute detailed meeting statistics for a given week. "
            "Returns at-a-glance stats, time breakdown, meeting quality metrics, "
            "top people, and top recurring series."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "week": {
                    "type": "string",
                    "description": (
                        "ISO date of the Monday that starts the week to analyze (e.g. '2026-04-06'). "
                        "Defaults to the current week if omitted."
                    ),
                },
            },
            "required": [],
        },
    },
    {
        "name": "generate_weekly_focus",
        "description": (
            "Generate a 2–3 sentence AI narrative that summarises the user's week "
            "— what they focused on, key meeting themes, and any patterns worth noting. "
            "Uses cached result if available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "week": {
                    "type": "string",
                    "description": "ISO date of the Monday that starts the week (e.g. '2026-04-06').",
                },
            },
            "required": [],
        },
    },
]


# ---------------------------------------------------------------------------
# Executors
# ---------------------------------------------------------------------------


def _current_week_start() -> date:
    today = date.today()
    return today - __import__("datetime").timedelta(days=today.weekday())


def execute_compute_insights(
    tool_input: dict[str, Any],
    creds: Credentials,
) -> dict[str, Any]:
    """Fetch events for the week and compute all metrics."""
    week_str = tool_input.get("week")
    if week_str:
        week_start = date.fromisoformat(week_str)
    else:
        week_start = _current_week_start()

    from datetime import timedelta

    start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=7)

    events = cal_service.list_events(creds, start_dt, end_dt)
    result = _compute_insights(events, week_start)
    return result


async def execute_generate_weekly_focus(
    tool_input: dict[str, Any],
    creds: Credentials,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Generate (or return cached) a weekly focus narrative.

    Cache lookup: WeeklyFocus table keyed by (user_id, week_start).
    If cache hit and narrative was generated today, return it.
    Otherwise generate via Claude and store.
    """
    from sqlalchemy import select
    from server.models import WeeklyFocus

    week_str = tool_input.get("week")
    if week_str:
        week_start = date.fromisoformat(week_str)
    else:
        week_start = _current_week_start()

    # Check cache
    result = await db.execute(
        select(WeeklyFocus).where(
            WeeklyFocus.user_id == user_id,
            WeeklyFocus.week_start == week_start,
        )
    )
    cached = result.scalar_one_or_none()
    if cached:
        return {
            "narrative": cached.narrative,
            "week_start": week_start.isoformat(),
            "from_cache": True,
        }

    # Fetch events and build context
    from datetime import timedelta

    start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=7)
    events = cal_service.list_events(creds, start_dt, end_dt)

    import re

    def _clean_desc(raw: str) -> str:
        """Strip URLs and whitespace; return empty string if nothing useful remains."""
        cleaned = re.sub(r'https?://\S+', '', raw or '').strip()
        return cleaned[:150] if cleaned else ''

    lines = []
    for ev in events[:40]:
        title = ev.get('summary', 'Untitled')
        desc = _clean_desc(ev.get('description', ''))
        lines.append(f"- {title}" + (f": {desc}" if desc else ""))
    titles_and_descriptions = "\n".join(lines)

    # Generate narrative via Claude
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Based on these calendar events for the week of {week_start}:\n"
                    f"{titles_and_descriptions}\n\n"
                    "Write a 2–3 sentence narrative summarising what this person focused on this week. "
                    "Be specific about themes, key meetings, and any notable patterns. "
                    "Write in second person (\"You...\")."
                ),
            }
        ],
    )
    narrative = message.content[0].text.strip()

    # Store in cache
    focus = WeeklyFocus(user_id=user_id, week_start=week_start, narrative=narrative)
    db.add(focus)
    await db.commit()

    return {
        "narrative": narrative,
        "week_start": week_start.isoformat(),
        "from_cache": False,
    }
