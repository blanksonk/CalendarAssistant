"""MCP tool definition for Google People API contact lookup."""
from __future__ import annotations

from typing import Any

from google.oauth2.credentials import Credentials

from server.services import people as people_service

PEOPLE_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "lookup_contact",
        "description": (
            "Search the user's Google contacts and directory to resolve a person's name "
            "to their email address. Use this before propose_event whenever you need an "
            "attendee's email and don't already have it. Returns up to 5 matches."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Name or partial name to search for (e.g. 'Emily', 'Smith').",
                },
            },
            "required": ["query"],
        },
    },
]


def execute_lookup_contact(tool_input: dict[str, Any], creds: Credentials) -> dict[str, Any]:
    """Search contacts and return name/email matches."""
    results = people_service.search_contacts(creds, tool_input["query"])
    return {
        "matches": results,
        "count": len(results),
        "note": "Pick the correct email from matches above and use it in propose_event.",
    }
