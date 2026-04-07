"""Unit tests for server/mcp/tools/gmail.py (create_gmail_draft + switch_tab)."""
from unittest.mock import MagicMock, patch

import pytest

from server.mcp.tools.gmail import (
    GMAIL_TOOL_SCHEMAS,
    execute_create_gmail_draft,
    execute_switch_tab,
)


def _creds():
    return MagicMock()


# ---------------------------------------------------------------------------
# Schema shape
# ---------------------------------------------------------------------------

class TestSchemas:
    def test_two_schemas_defined(self):
        names = {s["name"] for s in GMAIL_TOOL_SCHEMAS}
        assert names == {"create_gmail_draft", "switch_tab"}

    def test_create_gmail_draft_required_fields(self):
        schema = next(s for s in GMAIL_TOOL_SCHEMAS if s["name"] == "create_gmail_draft")
        required = schema["input_schema"]["required"]
        assert "to" in required
        assert "subject" in required
        assert "body" in required

    def test_switch_tab_enum_values(self):
        schema = next(s for s in GMAIL_TOOL_SCHEMAS if s["name"] == "switch_tab")
        enum = schema["input_schema"]["properties"]["tab"]["enum"]
        assert set(enum) == {"calendar", "insights"}


# ---------------------------------------------------------------------------
# execute_create_gmail_draft
# ---------------------------------------------------------------------------

class TestExecuteCreateGmailDraft:
    def _draft_service_result(self):
        return {
            "draft_id": "draft-abc",
            "to": "alice@example.com",
            "subject": "Hello",
            "body_snippet": "Hi there...",
            "gmail_url": "https://mail.google.com/mail/u/0/#drafts/draft-abc",
        }

    def test_sse_event_marker_present(self):
        creds = _creds()
        with patch(
            "server.mcp.tools.gmail.gmail_service.create_draft",
            return_value=self._draft_service_result(),
        ):
            result = execute_create_gmail_draft(
                {"to": "alice@example.com", "subject": "Hello", "body": "Hi there"}, creds
            )
        assert result["_sse_event"] == "draft_card"

    def test_draft_fields_forwarded(self):
        creds = _creds()
        with patch(
            "server.mcp.tools.gmail.gmail_service.create_draft",
            return_value=self._draft_service_result(),
        ):
            result = execute_create_gmail_draft(
                {"to": "alice@example.com", "subject": "Hello", "body": "Hi there"}, creds
            )
        assert result["draft_id"] == "draft-abc"
        assert result["to"] == "alice@example.com"
        assert result["subject"] == "Hello"
        assert "gmail_url" in result

    def test_passes_args_to_gmail_service(self):
        creds = _creds()
        with patch(
            "server.mcp.tools.gmail.gmail_service.create_draft",
            return_value=self._draft_service_result(),
        ) as mock_create:
            execute_create_gmail_draft(
                {"to": "bob@example.com", "subject": "Meeting", "body": "Let's meet"}, creds
            )
        mock_create.assert_called_once_with(
            creds, to="bob@example.com", subject="Meeting", body="Let's meet"
        )


# ---------------------------------------------------------------------------
# execute_switch_tab
# ---------------------------------------------------------------------------

class TestExecuteSwitchTab:
    def test_calendar_tab(self):
        result = execute_switch_tab({"tab": "calendar"})
        assert result["_sse_event"] == "switch_tab"
        assert result["tab"] == "calendar"

    def test_insights_tab(self):
        result = execute_switch_tab({"tab": "insights"})
        assert result["_sse_event"] == "switch_tab"
        assert result["tab"] == "insights"

    def test_invalid_tab_raises(self):
        with pytest.raises(ValueError, match="Invalid tab"):
            execute_switch_tab({"tab": "dashboard"})
