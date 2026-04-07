"""MCP tool definitions for Google Calendar: list_events, get_free_slots, propose_event."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from google.oauth2.credentials import Credentials

from server.services import calendar as cal_service

# ---------------------------------------------------------------------------
# Claude tool schemas
# ---------------------------------------------------------------------------

CALENDAR_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "list_events",
        "description": (
            "Retrieve the user's calendar events for a date range. "
            "Use this to answer questions about their schedule."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start": {
                    "type": "string",
                    "description": "ISO 8601 datetime for the start of the range (UTC).",
                },
                "end": {
                    "type": "string",
                    "description": "ISO 8601 datetime for the end of the range (UTC).",
                },
            },
            "required": ["start", "end"],
        },
    },
    {
        "name": "get_free_slots",
        "description": (
            "Find open time windows in the user's calendar for a given date. "
            "Returns a list of available slots ordered by start time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "ISO 8601 date string (e.g. '2026-04-07') to search for free slots.",
                },
                "duration_mins": {
                    "type": "integer",
                    "description": "Desired meeting duration in minutes.",
                },
                "num_suggestions": {
                    "type": "integer",
                    "description": "Maximum number of free slots to return (default 3).",
                },
            },
            "required": ["date", "duration_mins"],
        },
    },
    {
        "name": "propose_event",
        "description": (
            "Propose a new calendar event. This pushes a 'ghost' event to the user's "
            "calendar view so they can review and confirm it. Do not call insert_event "
            "directly — always propose first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Event title."},
                "start": {
                    "type": "string",
                    "description": "ISO 8601 datetime for the event start (UTC).",
                },
                "end": {
                    "type": "string",
                    "description": "ISO 8601 datetime for the event end (UTC).",
                },
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of attendee email addresses.",
                },
                "description": {
                    "type": "string",
                    "description": "Optional event description or agenda.",
                },
            },
            "required": ["title", "start", "end"],
        },
    },
]


# ---------------------------------------------------------------------------
# Executors
# ---------------------------------------------------------------------------

_WORK_START_HOUR = 9   # 9 AM
_WORK_END_HOUR = 18    # 6 PM


def execute_list_events(tool_input: dict[str, Any], creds: Credentials) -> dict[str, Any]:
    """Run list_events and return serialisable result."""
    start = datetime.fromisoformat(tool_input["start"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(tool_input["end"].replace("Z", "+00:00"))
    events = cal_service.list_events(creds, start, end)
    return {"events": events, "count": len(events)}


def execute_get_free_slots(tool_input: dict[str, Any], creds: Credentials) -> dict[str, Any]:
    """Query freebusy and compute open windows within working hours."""
    date_str = tool_input["date"]
    duration_mins = int(tool_input["duration_mins"])
    num_suggestions = int(tool_input.get("num_suggestions", 3))

    day_start = datetime.fromisoformat(f"{date_str}T{_WORK_START_HOUR:02d}:00:00+00:00")
    day_end = datetime.fromisoformat(f"{date_str}T{_WORK_END_HOUR:02d}:00:00+00:00")

    freebusy = cal_service.get_free_slots(creds, day_start, day_end)
    busy_periods = freebusy.get("calendars", {}).get("primary", {}).get("busy", [])

    # Parse busy blocks
    busy: list[tuple[datetime, datetime]] = []
    for period in busy_periods:
        b_start = datetime.fromisoformat(period["start"].replace("Z", "+00:00"))
        b_end = datetime.fromisoformat(period["end"].replace("Z", "+00:00"))
        busy.append((b_start, b_end))
    busy.sort(key=lambda x: x[0])

    # Find free windows
    duration = timedelta(minutes=duration_mins)
    slots: list[dict[str, str]] = []
    cursor = day_start

    for b_start, b_end in busy:
        if cursor + duration <= b_start:
            slots.append({
                "start": cursor.isoformat().replace("+00:00", "Z"),
                "end": (cursor + duration).isoformat().replace("+00:00", "Z"),
            })
        if b_end > cursor:
            cursor = b_end
        if len(slots) >= num_suggestions:
            break

    # Check remaining time after last busy block
    if len(slots) < num_suggestions and cursor + duration <= day_end:
        slots.append({
            "start": cursor.isoformat().replace("+00:00", "Z"),
            "end": (cursor + duration).isoformat().replace("+00:00", "Z"),
        })

    return {"free_slots": slots[:num_suggestions], "date": date_str, "duration_mins": duration_mins}


def execute_propose_event(tool_input: dict[str, Any]) -> dict[str, Any]:
    """Return a propose_event payload — the agent loop emits this as a SSE event."""
    return {
        "_sse_event": "propose_event",
        "id": f"pending-{tool_input['start'].replace(':', '').replace('-', '')[:15]}",
        "title": tool_input["title"],
        "start": tool_input["start"],
        "end": tool_input["end"],
        "attendees": tool_input.get("attendees", []),
        "description": tool_input.get("description", ""),
    }
