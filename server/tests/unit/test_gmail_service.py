"""Unit tests for server/services/gmail.py."""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from server.services.gmail import create_draft

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "gmail"


def _draft_fixture() -> dict:
    return json.loads((FIXTURE_DIR / "draft_response.json").read_text())


def _make_mock_creds():
    return MagicMock()


def _make_mock_service(draft_response: dict):
    """Build a mock Gmail API service that returns draft_response on drafts().create().execute()."""
    mock_service = MagicMock()
    mock_service.users.return_value.drafts.return_value.create.return_value.execute.return_value = (
        draft_response
    )
    return mock_service


class TestCreateDraft:
    def test_returns_expected_fields(self):
        fixture = _draft_fixture()
        creds = _make_mock_creds()

        with patch("server.services.gmail.gmail_client", return_value=_make_mock_service(fixture)):
            result = create_draft(
                creds,
                to="alice@example.com",
                subject="Hello",
                body="How are you?",
            )

        assert result["draft_id"] == "draft-abc123"
        assert result["to"] == "alice@example.com"
        assert result["subject"] == "Hello"
        assert result["body_snippet"] == "How are you?"
        assert "gmail_url" in result
        assert "draft-abc123" in result["gmail_url"]

    def test_body_snippet_truncated_at_200_chars(self):
        fixture = _draft_fixture()
        creds = _make_mock_creds()
        long_body = "x" * 300

        with patch("server.services.gmail.gmail_client", return_value=_make_mock_service(fixture)):
            result = create_draft(creds, to="a@b.com", subject="S", body=long_body)

        assert result["body_snippet"].endswith("...")
        assert len(result["body_snippet"]) == 203  # 200 + "..."

    def test_body_snippet_not_truncated_when_short(self):
        fixture = _draft_fixture()
        creds = _make_mock_creds()

        with patch("server.services.gmail.gmail_client", return_value=_make_mock_service(fixture)):
            result = create_draft(creds, to="a@b.com", subject="S", body="Short body")

        assert result["body_snippet"] == "Short body"
        assert not result["body_snippet"].endswith("...")

    def test_gmail_url_format(self):
        fixture = _draft_fixture()
        creds = _make_mock_creds()

        with patch("server.services.gmail.gmail_client", return_value=_make_mock_service(fixture)):
            result = create_draft(creds, to="a@b.com", subject="S", body="body")

        assert result["gmail_url"] == "https://mail.google.com/mail/u/0/#drafts/draft-abc123"

    def test_api_called_with_correct_user_id(self):
        fixture = _draft_fixture()
        creds = _make_mock_creds()
        mock_service = _make_mock_service(fixture)

        with patch("server.services.gmail.gmail_client", return_value=mock_service):
            create_draft(creds, to="a@b.com", subject="S", body="body")

        mock_service.users.return_value.drafts.return_value.create.assert_called_once()
        call_kwargs = mock_service.users.return_value.drafts.return_value.create.call_args
        assert call_kwargs.kwargs.get("userId") == "me" or call_kwargs[1].get("userId") == "me"
