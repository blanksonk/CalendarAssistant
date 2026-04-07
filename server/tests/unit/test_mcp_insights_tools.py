"""Unit tests for server/mcp/tools/insights.py."""
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.mcp.tools.insights import (
    INSIGHTS_TOOL_SCHEMAS,
    _current_week_start,
    execute_compute_insights,
    execute_generate_weekly_focus,
)


def _creds():
    return MagicMock()


def _mock_events():
    return [
        {
            "id": "ev1",
            "summary": "Standup",
            "start": {"dateTime": "2026-04-07T09:00:00Z"},
            "end": {"dateTime": "2026-04-07T09:30:00Z"},
        }
    ]


# ---------------------------------------------------------------------------
# Schema shape
# ---------------------------------------------------------------------------


class TestSchemas:
    def test_two_schemas_defined(self):
        names = {s["name"] for s in INSIGHTS_TOOL_SCHEMAS}
        assert names == {"compute_insights", "generate_weekly_focus"}

    def test_compute_insights_no_required_fields(self):
        schema = next(s for s in INSIGHTS_TOOL_SCHEMAS if s["name"] == "compute_insights")
        assert schema["input_schema"]["required"] == []

    def test_generate_weekly_focus_no_required_fields(self):
        schema = next(s for s in INSIGHTS_TOOL_SCHEMAS if s["name"] == "generate_weekly_focus")
        assert schema["input_schema"]["required"] == []


# ---------------------------------------------------------------------------
# execute_compute_insights
# ---------------------------------------------------------------------------


class TestExecuteComputeInsights:
    def test_returns_insights_structure(self):
        creds = _creds()
        with patch(
            "server.mcp.tools.insights.cal_service.list_events", return_value=_mock_events()
        ):
            result = execute_compute_insights({"week": "2026-04-06"}, creds)

        assert "at_a_glance" in result
        assert "time_breakdown" in result
        assert "meeting_quality" in result
        assert "top_people" in result
        assert "top_series" in result

    def test_uses_provided_week(self):
        creds = _creds()
        with patch(
            "server.mcp.tools.insights.cal_service.list_events", return_value=[]
        ) as mock_list:
            execute_compute_insights({"week": "2026-04-06"}, creds)

        call_args = mock_list.call_args
        start_dt: datetime = call_args[0][1]
        assert start_dt.date() == date(2026, 4, 6)

    def test_defaults_to_current_week(self):
        creds = _creds()
        with patch("server.mcp.tools.insights.cal_service.list_events", return_value=[]) as mock_list:
            execute_compute_insights({}, creds)

        call_args = mock_list.call_args
        start_dt: datetime = call_args[0][1]
        expected = _current_week_start()
        assert start_dt.date() == expected


# ---------------------------------------------------------------------------
# execute_generate_weekly_focus
# ---------------------------------------------------------------------------


class TestExecuteGenerateWeeklyFocus:
    @pytest.mark.asyncio
    async def test_returns_cached_narrative_when_available(self):
        from server.models import WeeklyFocus

        user_id = uuid.uuid4()
        creds = _creds()
        cached = WeeklyFocus(
            user_id=user_id,
            week_start=date(2026, 4, 6),
            narrative="You had a productive week.",
        )

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = cached
        db.execute = AsyncMock(return_value=mock_result)

        result = await execute_generate_weekly_focus(
            {"week": "2026-04-06"}, creds, user_id, db
        )

        assert result["narrative"] == "You had a productive week."
        assert result["from_cache"] is True

    @pytest.mark.asyncio
    async def test_generates_narrative_when_not_cached(self):
        user_id = uuid.uuid4()
        creds = _creds()

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # cache miss
        db.execute = AsyncMock(return_value=mock_result)
        db.add = MagicMock()
        db.commit = AsyncMock()

        # Mock Claude response
        mock_content = MagicMock()
        mock_content.text = "You focused on planning this week."
        mock_message = MagicMock()
        mock_message.content = [mock_content]

        with (
            patch(
                "server.mcp.tools.insights.cal_service.list_events", return_value=_mock_events()
            ),
            patch("server.mcp.tools.insights.anthropic.Anthropic") as mock_anthropic_cls,
        ):
            mock_client = MagicMock()
            mock_anthropic_cls.return_value = mock_client
            mock_client.messages.create.return_value = mock_message

            result = await execute_generate_weekly_focus(
                {"week": "2026-04-06"}, creds, user_id, db
            )

        assert result["narrative"] == "You focused on planning this week."
        assert result["from_cache"] is False
        db.add.assert_called_once()
        db.commit.assert_called_once()
