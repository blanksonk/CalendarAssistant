"""Claude streaming agent loop with MCP tool execution."""
from __future__ import annotations

import json
import time
from typing import Any, AsyncIterator

import anthropic
from google.oauth2.credentials import Credentials

from server.config import settings
from server.mcp.tools.calendar import (
    CALENDAR_TOOL_SCHEMAS,
    execute_get_free_slots,
    execute_list_events,
    execute_propose_event,
)
from server.mcp.tools.gmail import (
    GMAIL_TOOL_SCHEMAS,
    execute_create_gmail_draft,
    execute_switch_tab,
)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
MAX_TOOL_ROUNDS = 5  # prevent infinite loops

ALL_TOOL_SCHEMAS = CALENDAR_TOOL_SCHEMAS + GMAIL_TOOL_SCHEMAS

_SYSTEM_PROMPT_TEMPLATE = """You are a helpful calendar assistant. Today's date is {today} ({weekday}).

You can:
- View the user's calendar events and find free time slots
- Propose new meetings (they appear as ghost events for the user to confirm)
- Create Gmail drafts for follow-up emails
- Show insights about their meeting patterns
- Switch between the calendar and insights tab

Always use today's date above to interpret relative terms like "tomorrow", "next week", "this Friday", etc.
Be concise and actionable. When proposing meetings, confirm the details with the user first unless they've been explicit. When creating email drafts, ask for confirmation before calling the tool."""


def _build_system_prompt() -> str:
    from datetime import date
    today = date.today()
    return _SYSTEM_PROMPT_TEMPLATE.format(
        today=today.strftime("%Y-%m-%d"),
        weekday=today.strftime("%A"),
    )


def _sse(event_type: str, data: dict[str, Any]) -> str:
    """Format a single SSE line."""
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def _dispatch_tool(
    tool_name: str,
    tool_input: dict[str, Any],
    creds: Credentials | None,
) -> dict[str, Any]:
    """Call the appropriate tool executor and return the result."""
    if tool_name == "list_events":
        if creds is None:
            raise ValueError("Credentials required for list_events")
        return execute_list_events(tool_input, creds)
    elif tool_name == "get_free_slots":
        if creds is None:
            raise ValueError("Credentials required for get_free_slots")
        return execute_get_free_slots(tool_input, creds)
    elif tool_name == "propose_event":
        return execute_propose_event(tool_input)
    elif tool_name == "create_gmail_draft":
        if creds is None:
            raise ValueError("Credentials required for create_gmail_draft")
        return execute_create_gmail_draft(tool_input, creds)
    elif tool_name == "switch_tab":
        return execute_switch_tab(tool_input)
    else:
        raise ValueError(f"Unknown tool: {tool_name!r}")


async def run_agent(
    messages: list[dict[str, Any]],
    creds: Credentials | None = None,
    system: str | None = None,
) -> AsyncIterator[str]:
    """
    Run the Claude agent loop and yield SSE-formatted strings.

    SSE event types:
      text        — incremental assistant text (delta field)
      tool_start  — tool call beginning (tool_name, tool_use_id)
      tool_result — tool call finished (tool_name, tool_use_id, result)
      propose_event — ghost event for the calendar (forwarded from propose_event tool)
      draft_card  — email draft preview card
      switch_tab  — frontend navigation (tab field)
      done        — stream complete
      error       — unrecoverable error (message field)
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    system = system or _build_system_prompt()
    current_messages = list(messages)

    for _round in range(MAX_TOOL_ROUNDS):
        tool_calls_this_round: list[dict[str, Any]] = []

        # Stream from Claude
        async with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            tools=ALL_TOOL_SCHEMAS,  # type: ignore[arg-type]
            messages=current_messages,
        ) as stream:
            current_text = ""
            current_tool_use: dict[str, Any] | None = None
            current_tool_input_json = ""

            async for event in stream:
                if event.type == "content_block_start":
                    if event.content_block.type == "text":
                        current_tool_use = None
                        current_tool_input_json = ""
                    elif event.content_block.type == "tool_use":
                        current_tool_use = {
                            "id": event.content_block.id,
                            "name": event.content_block.name,
                        }
                        current_tool_input_json = ""
                        yield _sse("tool_start", {
                            "tool_name": event.content_block.name,
                            "tool_use_id": event.content_block.id,
                        })

                elif event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        current_text += event.delta.text
                        yield _sse("text", {"delta": event.delta.text})
                    elif event.delta.type == "input_json_delta":
                        current_tool_input_json += event.delta.partial_json

                elif event.type == "content_block_stop":
                    if current_tool_use is not None:
                        # Parse accumulated input JSON
                        try:
                            tool_input = json.loads(current_tool_input_json or "{}")
                        except json.JSONDecodeError:
                            tool_input = {}
                        current_tool_use["input"] = tool_input
                        tool_calls_this_round.append(current_tool_use)
                        current_tool_use = None

                elif event.type == "message_stop":
                    pass

        if not tool_calls_this_round:
            # No tools called — we're done
            yield _sse("done", {})
            return

        # Build the assistant message with all content blocks
        final_message = await stream.get_final_message()
        current_messages.append({"role": "assistant", "content": final_message.content})

        # Execute each tool and collect results
        tool_results: list[dict[str, Any]] = []
        for tc in tool_calls_this_round:
            t_start = time.monotonic()
            try:
                result = _dispatch_tool(tc["name"], tc["input"], creds)
                duration_ms = int((time.monotonic() - t_start) * 1000)

                # Emit special SSE events for frontend-targeting tools
                sse_event = result.get("_sse_event")
                if sse_event:
                    payload = {k: v for k, v in result.items() if k != "_sse_event"}
                    yield _sse(sse_event, payload)

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": json.dumps(result),
                })
                yield _sse("tool_result", {
                    "tool_name": tc["name"],
                    "tool_use_id": tc["id"],
                    "duration_ms": duration_ms,
                })
            except Exception as exc:
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": json.dumps({"error": str(exc)}),
                    "is_error": True,
                })
                yield _sse("tool_result", {
                    "tool_name": tc["name"],
                    "tool_use_id": tc["id"],
                    "error": str(exc),
                })

        current_messages.append({"role": "user", "content": tool_results})

    # Safety: max rounds reached
    yield _sse("error", {"message": "Max tool rounds reached."})
    yield _sse("done", {})
