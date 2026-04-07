"""Unit tests for server/mcp/tools/calendar.py."""
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from server.mcp.tools.calendar import (
    CALENDAR_TOOL_SCHEMAS,
    execute_get_free_slots,
    execute_list_events,
    execute_propose_event,
)

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "calendar"


def _load(name: str) -> dict | list:
    return json.loads((FIXTURE_DIR / name).read_text())


def _creds():
    return MagicMock()


# ---------------------------------------------------------------------------
# Schema shape
# ---------------------------------------------------------------------------

class TestSchemas:
    def test_three_schemas_defined(self):
        names = {s["name"] for s in CALENDAR_TOOL_SCHEMAS}
        assert names == {"list_events", "get_free_slots", "propose_event"}

    def test_list_events_required_fields(self):
        schema = next(s for s in CALENDAR_TOOL_SCHEMAS if s["name"] == "list_events")
        assert schema["input_schema"]["required"] == ["start", "end"]

    def test_get_free_slots_required_fields(self):
        schema = next(s for s in CALENDAR_TOOL_SCHEMAS if s["name"] == "get_free_slots")
        assert "date" in schema["input_schema"]["required"]
        assert "duration_mins" in schema["input_schema"]["required"]

    def test_propose_event_required_fields(self):
        schema = next(s for s in CALENDAR_TOOL_SCHEMAS if s["name"] == "propose_event")
        required = schema["input_schema"]["required"]
        assert "title" in required
        assert "start" in required
        assert "end" in required


# ---------------------------------------------------------------------------
# execute_list_events
# ---------------------------------------------------------------------------

class TestExecuteListEvents:
    def test_returns_events_and_count(self):
        events = _load("events.json")
        creds = _creds()

        with patch("server.mcp.tools.calendar.cal_service.list_events", return_value=events):
            result = execute_list_events(
                {"start": "2026-04-07T00:00:00Z", "end": "2026-04-07T23:59:59Z"}, creds
            )

        assert result["count"] == len(events)
        assert result["events"] == events

    def test_passes_parsed_datetimes_to_service(self):
        creds = _creds()
        with patch("server.mcp.tools.calendar.cal_service.list_events", return_value=[]) as mock_svc:
            execute_list_events(
                {"start": "2026-04-07T00:00:00Z", "end": "2026-04-07T23:59:59Z"}, creds
            )
        call_args = mock_svc.call_args
        assert isinstance(call_args[0][1], datetime)  # start
        assert isinstance(call_args[0][2], datetime)  # end


# ---------------------------------------------------------------------------
# execute_get_free_slots
# ---------------------------------------------------------------------------

class TestExecuteGetFreeSlots:
    def _freebusy(self):
        return _load("freebusy.json")

    def test_returns_free_slots_list(self):
        creds = _creds()
        with patch("server.mcp.tools.calendar.cal_service.get_free_slots", return_value=self._freebusy()):
            result = execute_get_free_slots(
                {"date": "2026-04-07", "duration_mins": 30}, creds
            )
        assert "free_slots" in result
        assert isinstance(result["free_slots"], list)

    def test_slots_respect_duration(self):
        creds = _creds()
        with patch("server.mcp.tools.calendar.cal_service.get_free_slots", return_value=self._freebusy()):
            result = execute_get_free_slots(
                {"date": "2026-04-07", "duration_mins": 60}, creds
            )
        for slot in result["free_slots"]:
            start = datetime.fromisoformat(slot["start"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(slot["end"].replace("Z", "+00:00"))
            assert (end - start).total_seconds() == 3600

    def test_num_suggestions_limits_results(self):
        creds = _creds()
        with patch("server.mcp.tools.calendar.cal_service.get_free_slots", return_value=self._freebusy()):
            result = execute_get_free_slots(
                {"date": "2026-04-07", "duration_mins": 30, "num_suggestions": 1}, creds
            )
        assert len(result["free_slots"]) <= 1

    def test_slots_dont_overlap_busy_periods(self):
        creds = _creds()
        with patch("server.mcp.tools.calendar.cal_service.get_free_slots", return_value=self._freebusy()):
            result = execute_get_free_slots(
                {"date": "2026-04-07", "duration_mins": 30}, creds
            )
        # The busy blocks from fixture: 09:00–09:30, 10:00–11:00, 14:00–15:00
        for slot in result["free_slots"]:
            slot_start = datetime.fromisoformat(slot["start"].replace("Z", "+00:00"))
            slot_end = datetime.fromisoformat(slot["end"].replace("Z", "+00:00"))
            # 09:00 is busy — slots should start at 09:30 or later
            assert slot_start.hour >= 9
            # Must not start at 09:00 (busy immediately) for a 30 min slot
            assert not (slot_start.hour == 9 and slot_start.minute == 0)

    def test_no_busy_returns_working_hours_slot(self):
        creds = _creds()
        empty_freebusy = {"calendars": {"primary": {"busy": []}}}
        with patch("server.mcp.tools.calendar.cal_service.get_free_slots", return_value=empty_freebusy):
            result = execute_get_free_slots(
                {"date": "2026-04-07", "duration_mins": 60, "num_suggestions": 1}, creds
            )
        assert len(result["free_slots"]) == 1
        assert result["free_slots"][0]["start"] == "2026-04-07T09:00:00Z"


# ---------------------------------------------------------------------------
# execute_propose_event
# ---------------------------------------------------------------------------

class TestExecuteProsposeEvent:
    def test_returns_sse_event_marker(self):
        result = execute_propose_event({
            "title": "Sync with Alice",
            "start": "2026-04-07T14:00:00Z",
            "end": "2026-04-07T15:00:00Z",
        })
        assert result["_sse_event"] == "propose_event"

    def test_includes_all_fields(self):
        result = execute_propose_event({
            "title": "Team lunch",
            "start": "2026-04-08T12:00:00Z",
            "end": "2026-04-08T13:00:00Z",
            "attendees": ["alice@example.com"],
            "description": "Monthly team lunch",
        })
        assert result["title"] == "Team lunch"
        assert result["start"] == "2026-04-08T12:00:00Z"
        assert result["end"] == "2026-04-08T13:00:00Z"
        assert result["attendees"] == ["alice@example.com"]
        assert result["description"] == "Monthly team lunch"

    def test_optional_fields_default_empty(self):
        result = execute_propose_event({
            "title": "Quick chat",
            "start": "2026-04-09T09:00:00Z",
            "end": "2026-04-09T09:30:00Z",
        })
        assert result["attendees"] == []
        assert result["description"] == ""

    def test_id_is_generated(self):
        result = execute_propose_event({
            "title": "X",
            "start": "2026-04-07T10:00:00Z",
            "end": "2026-04-07T10:30:00Z",
        })
        assert result["id"].startswith("pending-")
