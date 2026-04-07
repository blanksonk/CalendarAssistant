"""Unit tests for server/services/claude.py — streaming agent loop."""
from __future__ import annotations

import json
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.services.claude import _dispatch_tool, _sse, run_agent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_sse(line: str) -> dict[str, Any]:
    """Parse a single SSE line like 'data: {...}' into a dict."""
    assert line.startswith("data: "), f"Not an SSE line: {line!r}"
    return json.loads(line[6:].rstrip("\n"))


async def _collect(gen: AsyncIterator[str]) -> list[dict[str, Any]]:
    """Drain an async generator and parse each SSE line."""
    events = []
    async for line in gen:
        for chunk in line.split("\n\n"):
            chunk = chunk.strip()
            if chunk.startswith("data: "):
                events.append(_parse_sse(chunk))
    return events


# ---------------------------------------------------------------------------
# _sse helper
# ---------------------------------------------------------------------------


class TestSseHelper:
    def test_format(self):
        line = _sse("text", {"delta": "Hello"})
        assert line.startswith("data: ")
        payload = json.loads(line[6:])
        assert payload["type"] == "text"
        assert payload["delta"] == "Hello"


# ---------------------------------------------------------------------------
# _dispatch_tool
# ---------------------------------------------------------------------------


class TestDispatchTool:
    def test_propose_event_no_creds_needed(self):
        result = _dispatch_tool(
            "propose_event",
            {"title": "Test", "start": "2026-04-07T10:00:00Z", "end": "2026-04-07T10:30:00Z"},
            creds=None,
        )
        assert result["_sse_event"] == "propose_event"

    def test_switch_tab_no_creds_needed(self):
        result = _dispatch_tool("switch_tab", {"tab": "calendar"}, creds=None)
        assert result["_sse_event"] == "switch_tab"
        assert result["tab"] == "calendar"

    def test_list_events_requires_creds(self):
        with pytest.raises(ValueError, match="Credentials required"):
            _dispatch_tool(
                "list_events",
                {"start": "2026-04-07T00:00:00Z", "end": "2026-04-07T23:59:59Z"},
                creds=None,
            )

    def test_unknown_tool_raises(self):
        with pytest.raises(ValueError, match="Unknown tool"):
            _dispatch_tool("nonexistent_tool", {}, creds=None)

    def test_list_events_with_creds(self):
        creds = MagicMock()
        with patch(
            "server.mcp.tools.calendar.cal_service.list_events", return_value=[]
        ):
            result = _dispatch_tool(
                "list_events",
                {"start": "2026-04-07T00:00:00Z", "end": "2026-04-07T23:59:59Z"},
                creds=creds,
            )
        assert result["count"] == 0


# ---------------------------------------------------------------------------
# run_agent — pure text response (no tool calls)
# ---------------------------------------------------------------------------


def _make_text_stream_mock(text: str):
    """Build a mock that simulates a Claude text-only streaming response."""
    # Simulate the event sequence for a text-only response
    content_block_start = MagicMock()
    content_block_start.type = "content_block_start"
    content_block_start.content_block = MagicMock()
    content_block_start.content_block.type = "text"

    delta_event = MagicMock()
    delta_event.type = "content_block_delta"
    delta_event.delta = MagicMock()
    delta_event.delta.type = "text_delta"
    delta_event.delta.text = text

    stop_event = MagicMock()
    stop_event.type = "content_block_stop"

    msg_stop = MagicMock()
    msg_stop.type = "message_stop"

    async def _aiter():
        yield content_block_start
        yield delta_event
        yield stop_event
        yield msg_stop

    # Final message (no tool_use blocks)
    final_msg = MagicMock()
    final_msg.content = [MagicMock(type="text", text=text)]

    stream_ctx = AsyncMock()
    stream_ctx.__aenter__ = AsyncMock(return_value=stream_ctx)
    stream_ctx.__aexit__ = AsyncMock(return_value=False)
    stream_ctx.__aiter__ = lambda self: _aiter()
    stream_ctx.get_final_message = AsyncMock(return_value=final_msg)

    return stream_ctx


class TestRunAgentTextOnly:
    @pytest.mark.asyncio
    async def test_emits_text_and_done(self):
        stream_mock = _make_text_stream_mock("Hello!")

        with patch("server.services.claude.anthropic.AsyncAnthropic") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.messages.stream.return_value = stream_mock

            events = await _collect(
                run_agent([{"role": "user", "content": "Hi"}])
            )

        types = [e["type"] for e in events]
        assert "text" in types
        assert "done" in types

    @pytest.mark.asyncio
    async def test_text_delta_content(self):
        stream_mock = _make_text_stream_mock("How can I help?")

        with patch("server.services.claude.anthropic.AsyncAnthropic") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.messages.stream.return_value = stream_mock

            events = await _collect(
                run_agent([{"role": "user", "content": "Hello"}])
            )

        text_events = [e for e in events if e["type"] == "text"]
        combined = "".join(e["delta"] for e in text_events)
        assert combined == "How can I help?"

    @pytest.mark.asyncio
    async def test_done_is_last_event(self):
        stream_mock = _make_text_stream_mock("Done!")

        with patch("server.services.claude.anthropic.AsyncAnthropic") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.messages.stream.return_value = stream_mock

            events = await _collect(
                run_agent([{"role": "user", "content": "Test"}])
            )

        assert events[-1]["type"] == "done"
