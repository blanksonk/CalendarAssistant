"""Unit tests for server/services/insights.py."""
from datetime import date, datetime, timezone

import pytest

from server.services.insights import (
    compute_insights,
    _at_a_glance,
    _count_back_to_back,
    _count_focus_blocks,
    _duration_mins,
    _meeting_quality,
    _time_breakdown,
    _top_people,
    _top_series,
)

WEEK_START = date(2026, 4, 6)  # Monday


def _ev(
    summary: str,
    start: str,
    end: str,
    attendees: list[dict] | None = None,
    description: str = "",
    recurring_id: str | None = None,
    self_organizer: bool = False,
) -> dict:
    ev: dict = {
        "id": f"ev-{summary.lower().replace(' ', '-')}",
        "summary": summary,
        "start": {"dateTime": start},
        "end": {"dateTime": end},
        "description": description,
    }
    if attendees is not None:
        ev["attendees"] = attendees
    if recurring_id:
        ev["recurringEventId"] = recurring_id
    if self_organizer:
        ev["organizer"] = {"self": True}
    return ev


STANDUP = _ev(
    "Daily standup",
    "2026-04-07T09:00:00Z",
    "2026-04-07T09:30:00Z",
    attendees=[{"email": "alice@example.com"}, {"email": "bob@example.com"}],
    recurring_id="rec-standup",
)
ONE_ON_ONE = _ev(
    "1:1 with manager",
    "2026-04-07T10:00:00Z",
    "2026-04-07T11:00:00Z",
    attendees=[{"email": "manager@example.com"}],
    description="Weekly 1:1",
)
ALL_HANDS = _ev(
    "All-hands",
    "2026-04-08T14:00:00Z",
    "2026-04-08T15:30:00Z",
    attendees=[
        {"email": "a@x.com"},
        {"email": "b@x.com"},
        {"email": "c@x.com"},
        {"email": "d@x.com"},
    ],
    description="Monthly all-hands",
    self_organizer=True,
)

ALL_EVENTS = [STANDUP, ONE_ON_ONE, ALL_HANDS]


class TestDurationMins:
    def test_30_min_event(self):
        assert _duration_mins(STANDUP) == 30

    def test_60_min_event(self):
        assert _duration_mins(ONE_ON_ONE) == 60

    def test_90_min_event(self):
        assert _duration_mins(ALL_HANDS) == 90

    def test_missing_dates_returns_zero(self):
        assert _duration_mins({}) == 0


class TestAtAGlance:
    def test_total_meetings(self):
        result = _at_a_glance(ALL_EVENTS)
        assert result["total_meetings"] == 3

    def test_avg_duration(self):
        result = _at_a_glance(ALL_EVENTS)
        # (30 + 60 + 90) / 3 = 60
        assert result["avg_duration_mins"] == 60

    def test_longest_meeting(self):
        result = _at_a_glance(ALL_EVENTS)
        assert result["longest_meeting_mins"] == 90

    def test_new_meetings_excludes_recurring(self):
        result = _at_a_glance(ALL_EVENTS)
        # STANDUP is recurring, so new_meetings = 2
        assert result["new_meetings"] == 2

    def test_busiest_day(self):
        result = _at_a_glance(ALL_EVENTS)
        # Tuesday has 2 events (standup + 1:1)
        assert result["busiest_day"] == "Tuesday"

    def test_empty_events(self):
        result = _at_a_glance([])
        assert result["total_meetings"] == 0
        assert result["avg_duration_mins"] == 0


class TestTimeBreakdown:
    def test_total_meeting_mins(self):
        result = _time_breakdown(ALL_EVENTS)
        assert result["total_meeting_mins"] == 180

    def test_morning_afternoon_split(self):
        result = _time_breakdown(ALL_EVENTS)
        # Standup (9am) and 1:1 (10am) = morning; All-hands (2pm) = afternoon
        assert result["morning_meetings"] == 2
        assert result["afternoon_meetings"] == 1

    def test_back_to_back_count(self):
        # Standup ends 09:30, 1:1 starts 10:00 → 30 min gap → NOT back-to-back
        result = _time_breakdown(ALL_EVENTS)
        assert result["back_to_back_count"] == 0

    def test_back_to_back_detected(self):
        # Two events with 0 min gap
        ev1 = _ev("A", "2026-04-07T09:00:00Z", "2026-04-07T09:30:00Z")
        ev2 = _ev("B", "2026-04-07T09:30:00Z", "2026-04-07T10:00:00Z")
        result = _count_back_to_back([ev1, ev2])
        assert result == 1


class TestMeetingQuality:
    def test_no_agenda_count(self):
        result = _meeting_quality(ALL_EVENTS)
        # STANDUP has no description
        assert result["no_agenda_count"] == 1

    def test_recurring_count(self):
        result = _meeting_quality(ALL_EVENTS)
        assert result["recurring_count"] == 1

    def test_one_off_count(self):
        result = _meeting_quality(ALL_EVENTS)
        assert result["one_off_count"] == 2

    def test_organized_vs_invited(self):
        result = _meeting_quality(ALL_EVENTS)
        # ALL_HANDS is self-organized
        assert result["organized_count"] == 1
        assert result["invited_count"] == 2

    def test_one_on_one_vs_group(self):
        result = _meeting_quality(ALL_EVENTS)
        # ONE_ON_ONE has 1 attendee → 1:1; ALL_HANDS has 4 → group; STANDUP 2 → 1:1
        assert result["one_on_one_count"] == 2
        assert result["group_count"] == 1


class TestTopPeople:
    def test_returns_sorted_by_count(self):
        events = [
            _ev("A", "2026-04-07T09:00:00Z", "2026-04-07T10:00:00Z",
                attendees=[{"email": "alice@x.com"}, {"email": "bob@x.com"}]),
            _ev("B", "2026-04-07T10:00:00Z", "2026-04-07T11:00:00Z",
                attendees=[{"email": "alice@x.com"}]),
        ]
        result = _top_people(events)
        assert result[0]["email"] == "alice@x.com"
        assert result[0]["count"] == 2

    def test_self_excluded(self):
        events = [
            _ev("A", "2026-04-07T09:00:00Z", "2026-04-07T10:00:00Z",
                attendees=[{"email": "me@x.com", "self": True}, {"email": "other@x.com"}]),
        ]
        result = _top_people(events)
        emails = [r["email"] for r in result]
        assert "me@x.com" not in emails


class TestTopSeries:
    def test_returns_recurring_only(self):
        result = _top_series(ALL_EVENTS)
        titles = [r["title"] for r in result]
        assert "Daily standup" in titles
        assert "1:1 with manager" not in titles
        assert "All-hands" not in titles

    def test_sorted_by_total_mins(self):
        events = [
            _ev("Standup", "2026-04-07T09:00:00Z", "2026-04-07T09:15:00Z", recurring_id="s"),
            _ev("Standup", "2026-04-08T09:00:00Z", "2026-04-08T09:15:00Z", recurring_id="s"),
            _ev("Weekly review", "2026-04-07T14:00:00Z", "2026-04-07T15:00:00Z", recurring_id="w"),
        ]
        result = _top_series(events)
        # Weekly review: 60 min total; Standup: 30 min total
        assert result[0]["title"] == "Weekly review"


class TestComputeInsights:
    def test_returns_expected_top_level_keys(self):
        result = compute_insights(ALL_EVENTS, WEEK_START)
        assert "at_a_glance" in result
        assert "time_breakdown" in result
        assert "meeting_quality" in result
        assert "top_people" in result
        assert "top_series" in result

    def test_filters_to_week(self):
        # Event outside the week should be excluded
        outside = _ev("Out of week", "2026-04-01T09:00:00Z", "2026-04-01T10:00:00Z")
        result = compute_insights([outside, STANDUP], WEEK_START)
        assert result["total_meetings"] == 1
