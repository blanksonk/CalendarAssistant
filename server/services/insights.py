"""Insights computation service — all metrics derived from calendar events."""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_insights(events: list[dict[str, Any]], week_start: date) -> dict[str, Any]:
    """
    Compute all meeting metrics for the given week from a flat list of Google
    Calendar event dicts.

    Returns a structured dict matching the Insights tab design:
      - at_a_glance
      - time_breakdown
      - meeting_quality
      - top_people  (list of {email, count})
      - top_series  (list of {title, count, total_mins})
    """
    week_end = week_start + timedelta(days=7)
    events = _filter_week(events, week_start, week_end)

    return {
        "week_start": week_start.isoformat(),
        "total_meetings": len(events),
        "at_a_glance": _at_a_glance(events),
        "time_breakdown": _time_breakdown(events),
        "meeting_quality": _meeting_quality(events),
        "top_people": _top_people(events),
        "top_series": _top_series(events),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_dt(event: dict[str, Any]) -> tuple[datetime | None, datetime | None]:
    """Return (start_dt, end_dt) as UTC-aware datetimes, or (None, None)."""
    try:
        start_raw = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")
        end_raw = event.get("end", {}).get("dateTime") or event.get("end", {}).get("date")
        if not start_raw or not end_raw:
            return None, None
        start = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
        return start, end
    except Exception:
        return None, None


def _duration_mins(event: dict[str, Any]) -> int:
    start, end = _parse_dt(event)
    if start is None or end is None:
        return 0
    return max(0, int((end - start).total_seconds() / 60))


def _filter_week(
    events: list[dict[str, Any]], week_start: date, week_end: date
) -> list[dict[str, Any]]:
    filtered = []
    for ev in events:
        start, _ = _parse_dt(ev)
        if start is None:
            continue
        ev_date = start.date()
        if week_start <= ev_date < week_end:
            filtered.append(ev)
    return filtered


def _at_a_glance(events: list[dict[str, Any]]) -> dict[str, Any]:
    durations = [_duration_mins(e) for e in events]
    total = len(events)
    avg_dur = int(sum(durations) / total) if total else 0
    longest = max(durations, default=0)

    # Busiest day
    day_counter: Counter[str] = Counter()
    for ev in events:
        start, _ = _parse_dt(ev)
        if start:
            day_counter[start.strftime("%A")] += 1
    busiest_day = day_counter.most_common(1)[0][0] if day_counter else ""

    # New meetings = non-recurring events
    new_meetings = sum(1 for e in events if not e.get("recurringEventId"))

    return {
        "total_meetings": total,
        "new_meetings": new_meetings,
        "avg_duration_mins": avg_dur,
        "longest_meeting_mins": longest,
        "busiest_day": busiest_day,
    }


def _time_breakdown(events: list[dict[str, Any]]) -> dict[str, Any]:
    total_meeting_mins = sum(_duration_mins(e) for e in events)

    # Focus blocks: 90+ min uninterrupted gaps within 9am–6pm
    focus_blocks = _count_focus_blocks(events)

    # Back-to-back: two consecutive meetings with <5 min gap
    back_to_back = _count_back_to_back(events)

    # Morning vs afternoon split
    morning = 0
    afternoon = 0
    for ev in events:
        start, _ = _parse_dt(ev)
        if start:
            if start.hour < 12:
                morning += 1
            else:
                afternoon += 1

    return {
        "total_meeting_mins": total_meeting_mins,
        "focus_block_count": focus_blocks,
        "back_to_back_count": back_to_back,
        "morning_meetings": morning,
        "afternoon_meetings": afternoon,
    }


def _count_focus_blocks(events: list[dict[str, Any]]) -> int:
    """Count 90+ min uninterrupted blocks during 9am–6pm on each day."""
    from collections import defaultdict

    # Group events by date
    by_day: dict[date, list[tuple[datetime, datetime]]] = defaultdict(list)
    for ev in events:
        start, end = _parse_dt(ev)
        if start and end:
            by_day[start.date()].append((start, end))

    count = 0
    for day, blocks in by_day.items():
        blocks.sort(key=lambda x: x[0])
        # Work window: 9am–6pm
        cursor = datetime(day.year, day.month, day.day, 9, 0, tzinfo=timezone.utc)
        work_end = datetime(day.year, day.month, day.day, 18, 0, tzinfo=timezone.utc)

        for b_start, b_end in blocks:
            if cursor + timedelta(minutes=90) <= b_start:
                count += 1
            cursor = max(cursor, b_end)

        if cursor + timedelta(minutes=90) <= work_end:
            count += 1

    return count


def _count_back_to_back(events: list[dict[str, Any]]) -> int:
    """Count pairs of consecutive meetings with < 5 min gap."""
    parsed = []
    for ev in events:
        start, end = _parse_dt(ev)
        if start and end:
            parsed.append((start, end))
    parsed.sort(key=lambda x: x[0])

    count = 0
    for i in range(len(parsed) - 1):
        gap = (parsed[i + 1][0] - parsed[i][1]).total_seconds() / 60
        if 0 <= gap < 5:
            count += 1
    return count


def _meeting_quality(events: list[dict[str, Any]]) -> dict[str, Any]:
    no_agenda = sum(1 for e in events if not e.get("description", "").strip())
    recurring = sum(1 for e in events if e.get("recurringEventId"))
    one_off = len(events) - recurring

    # Organizer vs attendee
    organized = sum(
        1 for e in events if e.get("organizer", {}).get("self", False)
    )
    invited = len(events) - organized

    # 1:1 vs group (3+ attendees including self)
    one_on_one = 0
    group = 0
    for ev in events:
        attendees = ev.get("attendees", [])
        n = len(attendees)
        if n <= 2:
            one_on_one += 1
        elif n >= 3:
            group += 1

    return {
        "no_agenda_count": no_agenda,
        "recurring_count": recurring,
        "one_off_count": one_off,
        "organized_count": organized,
        "invited_count": invited,
        "one_on_one_count": one_on_one,
        "group_count": group,
    }


def _top_people(events: list[dict[str, Any]], top_n: int = 5) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for ev in events:
        for a in ev.get("attendees", []):
            if not a.get("self"):
                counter[a.get("email", "")] += 1
    return [{"email": email, "count": count} for email, count in counter.most_common(top_n)]


def _top_series(events: list[dict[str, Any]], top_n: int = 5) -> list[dict[str, Any]]:
    """Recurring events ranked by total time consumed."""
    series: dict[str, dict[str, Any]] = {}
    for ev in events:
        if not ev.get("recurringEventId"):
            continue
        title = ev.get("summary", "Untitled")
        mins = _duration_mins(ev)
        if title not in series:
            series[title] = {"title": title, "count": 0, "total_mins": 0}
        series[title]["count"] += 1
        series[title]["total_mins"] += mins

    sorted_series = sorted(series.values(), key=lambda x: x["total_mins"], reverse=True)
    return sorted_series[:top_n]
