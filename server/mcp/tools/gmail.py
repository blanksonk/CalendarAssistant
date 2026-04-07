"""MCP tool definitions for Gmail (create_gmail_draft) and UI (switch_tab)."""
from __future__ import annotations

from typing import Any

from google.oauth2.credentials import Credentials

from server.services import gmail as gmail_service

# ---------------------------------------------------------------------------
# Claude tool schemas
# ---------------------------------------------------------------------------

GMAIL_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "create_gmail_draft",
        "description": (
            "Create a Gmail draft on behalf of the user. "
            "Returns a preview card with To, Subject, body snippet, and a direct edit URL. "
            "Editing and sending happens in Gmail — never send email directly."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Recipient email address.",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line.",
                },
                "body": {
                    "type": "string",
                    "description": "Full email body text.",
                },
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "switch_tab",
        "description": (
            "Switch the user's active panel to 'calendar' or 'insights'. "
            "Use this when the user asks to see a different view, "
            "or when showing them relevant data requires switching tabs."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tab": {
                    "type": "string",
                    "enum": ["calendar", "insights"],
                    "description": "The tab to navigate to.",
                },
            },
            "required": ["tab"],
        },
    },
]


# ---------------------------------------------------------------------------
# Executors
# ---------------------------------------------------------------------------


def execute_create_gmail_draft(tool_input: dict[str, Any], creds: Credentials) -> dict[str, Any]:
    """Create a Gmail draft and return a preview payload with SSE marker."""
    result = gmail_service.create_draft(
        creds,
        to=tool_input["to"],
        subject=tool_input["subject"],
        body=tool_input["body"],
    )
    # Add SSE marker so the agent loop emits a draft_card event to the frontend
    return {
        "_sse_event": "draft_card",
        **result,
    }


def execute_switch_tab(tool_input: dict[str, Any]) -> dict[str, Any]:
    """Return a switch_tab SSE payload — the agent loop emits this as a frontend navigation event."""
    tab = tool_input["tab"]
    if tab not in ("calendar", "insights"):
        raise ValueError(f"Invalid tab: {tab!r}. Must be 'calendar' or 'insights'.")
    return {
        "_sse_event": "switch_tab",
        "tab": tab,
    }
