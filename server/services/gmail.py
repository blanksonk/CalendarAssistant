"""Gmail API service — draft creation only (gmail.compose scope)."""
import base64
from email.mime.text import MIMEText
from typing import Any

from google.oauth2.credentials import Credentials

from server.services.google import gmail_client


def create_draft(
    creds: Credentials,
    to: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Create a Gmail draft and return the draft ID + direct edit URL."""
    service = gmail_client(creds)

    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    draft = service.users().drafts().create(
        userId="me",
        body={"message": {"raw": raw}},
    ).execute()

    draft_id = draft.get("id", "")
    gmail_url = f"https://mail.google.com/mail/u/0/#drafts/{draft_id}"

    return {
        "draft_id": draft_id,
        "to": to,
        "subject": subject,
        "body_snippet": body[:200] + ("..." if len(body) > 200 else ""),
        "gmail_url": gmail_url,
    }
