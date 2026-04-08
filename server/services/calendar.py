"""Google Calendar API service layer."""
from datetime import datetime, timezone
from typing import Any, Optional

from google.oauth2.credentials import Credentials

from server.services.google import calendar_client


def _refresh_if_needed(creds: Credentials) -> None:
    """Refresh credentials if they are expired or about to expire."""
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())


def list_events(
    creds: Credentials,
    start: datetime,
    end: datetime,
    max_results: int = 250,
) -> list[dict[str, Any]]:
    """Return all events between start and end (inclusive)."""
    _refresh_if_needed(creds)
    service = calendar_client(creds)

    time_min = start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    time_max = end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    events: list[dict] = []
    page_token: Optional[str] = None

    while True:
        response = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=min(max_results, 250),
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
            )
            .execute()
        )
        events.extend(response.get("items", []))
        page_token = response.get("nextPageToken")
        if not page_token or len(events) >= max_results:
            break

    return events[:max_results]


def get_free_slots(
    creds: Credentials,
    start: datetime,
    end: datetime,
    calendar_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Query freebusy for the given time range. Returns raw freebusy response."""
    _refresh_if_needed(creds)
    service = calendar_client(creds)

    if calendar_ids is None:
        calendar_ids = ["primary"]

    time_min = start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    time_max = end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    body = {
        "timeMin": time_min,
        "timeMax": time_max,
        "items": [{"id": cid} for cid in calendar_ids],
    }
    return service.freebusy().query(body=body).execute()


def insert_event(
    creds: Credentials,
    title: str,
    start: datetime,
    end: datetime,
    attendees: Optional[list[str]] = None,
    description: Optional[str] = None,
) -> dict[str, Any]:
    """Create a confirmed event on the user's primary calendar."""
    _refresh_if_needed(creds)
    service = calendar_client(creds)

    event_body: dict[str, Any] = {
        "summary": title,
        "start": {
            "dateTime": start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "timeZone": "UTC",
        },
    }
    if attendees:
        event_body["attendees"] = [{"email": a} for a in attendees]
    if description:
        event_body["description"] = description

    return service.events().insert(
        calendarId="primary", body=event_body, sendUpdates="all"
    ).execute()


def delete_event(
    creds: Credentials,
    event_id: str,
) -> None:
    """Delete (cancel) an event from the user's primary calendar."""
    _refresh_if_needed(creds)
    service = calendar_client(creds)
    service.events().delete(calendarId="primary", eventId=event_id).execute()


def patch_event(
    creds: Credentials,
    event_id: str,
    title: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    attendees: Optional[list[str]] = None,
    description: Optional[str] = None,
) -> dict[str, Any]:
    """Partially update a calendar event. Only provided fields are changed."""
    _refresh_if_needed(creds)
    service = calendar_client(creds)

    body: dict[str, Any] = {}
    if title is not None:
        body["summary"] = title
    if start is not None:
        body["start"] = {
            "dateTime": start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "timeZone": "UTC",
        }
    if end is not None:
        body["end"] = {
            "dateTime": end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "timeZone": "UTC",
        }
    if attendees is not None:
        body["attendees"] = [{"email": a} for a in attendees]
    if description is not None:
        body["description"] = description

    return (
        service.events()
        .patch(calendarId="primary", eventId=event_id, body=body)
        .execute()
    )
