"""Unit tests for the Google Calendar service layer.

All Google API calls are mocked — no real credentials needed.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from server.services.calendar import get_free_slots, insert_event, list_events, patch_event


def _creds(expired: bool = False) -> MagicMock:
    creds = MagicMock()
    creds.expired = expired
    creds.refresh_token = "fake-refresh-token" if expired else None
    return creds


def _dt(hour: int = 9) -> datetime:
    return datetime(2026, 4, 7, hour, 0, tzinfo=timezone.utc)


class TestListEvents:
    @patch("server.services.calendar.calendar_client")
    def test_calls_events_list_with_correct_params(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.events().list().execute.return_value = {"items": [], "nextPageToken": None}

        creds = _creds()
        list_events(creds, _dt(9), _dt(17))

        call_kwargs = mock_service.events().list.call_args.kwargs
        assert call_kwargs["calendarId"] == "primary"
        assert call_kwargs["singleEvents"] is True
        assert call_kwargs["orderBy"] == "startTime"

    @patch("server.services.calendar.calendar_client")
    def test_returns_events_from_response(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        fake_events = [{"id": "evt1", "summary": "Standup"}, {"id": "evt2", "summary": "1:1"}]
        mock_service.events().list().execute.return_value = {
            "items": fake_events,
            "nextPageToken": None,
        }

        creds = _creds()
        result = list_events(creds, _dt(9), _dt(17))

        assert len(result) == 2
        assert result[0]["summary"] == "Standup"

    @patch("server.services.calendar.calendar_client")
    def test_paginates_until_no_next_token(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service

        page1 = {"items": [{"id": f"evt{i}"} for i in range(3)], "nextPageToken": "tok1"}
        page2 = {"items": [{"id": f"evt{i}"} for i in range(3, 5)], "nextPageToken": None}
        mock_service.events().list().execute.side_effect = [page1, page2]

        creds = _creds()
        result = list_events(creds, _dt(9), _dt(17))
        assert len(result) == 5

    @patch("server.services.calendar.calendar_client")
    @patch("server.services.calendar._refresh_if_needed")
    def test_refreshes_expired_creds(self, mock_refresh, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.events().list().execute.return_value = {"items": [], "nextPageToken": None}

        creds = _creds(expired=True)
        list_events(creds, _dt(9), _dt(17))

        mock_refresh.assert_called_once_with(creds)

    @patch("server.services.calendar.calendar_client")
    def test_time_params_formatted_as_rfc3339(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.events().list().execute.return_value = {"items": [], "nextPageToken": None}

        start = datetime(2026, 4, 7, 9, 0, tzinfo=timezone.utc)
        end = datetime(2026, 4, 7, 17, 0, tzinfo=timezone.utc)
        list_events(_creds(), start, end)

        call_kwargs = mock_service.events().list.call_args.kwargs
        assert call_kwargs["timeMin"] == "2026-04-07T09:00:00Z"
        assert call_kwargs["timeMax"] == "2026-04-07T17:00:00Z"


class TestGetFreeSlots:
    @patch("server.services.calendar.calendar_client")
    def test_queries_primary_calendar_by_default(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.freebusy().query().execute.return_value = {"calendars": {"primary": {}}}

        creds = _creds()
        result = get_free_slots(creds, _dt(9), _dt(17))

        call_kwargs = mock_service.freebusy().query.call_args.kwargs
        assert {"id": "primary"} in call_kwargs["body"]["items"]

    @patch("server.services.calendar.calendar_client")
    def test_returns_raw_freebusy_response(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        fake_response = {
            "calendars": {"primary": {"busy": [{"start": "2026-04-07T10:00:00Z"}]}}
        }
        mock_service.freebusy().query().execute.return_value = fake_response

        result = get_free_slots(_creds(), _dt(9), _dt(17))
        assert "calendars" in result
        assert "primary" in result["calendars"]


class TestInsertEvent:
    @patch("server.services.calendar.calendar_client")
    def test_creates_event_with_correct_fields(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        created = {"id": "new-evt", "summary": "Team sync"}
        mock_service.events().insert().execute.return_value = created

        creds = _creds()
        result = insert_event(
            creds,
            title="Team sync",
            start=_dt(10),
            end=_dt(11),
            attendees=["alice@example.com"],
            description="Weekly team sync",
        )

        call_kwargs = mock_service.events().insert.call_args.kwargs
        body = call_kwargs["body"]
        assert body["summary"] == "Team sync"
        assert body["description"] == "Weekly team sync"
        assert body["attendees"] == [{"email": "alice@example.com"}]
        assert result["id"] == "new-evt"

    @patch("server.services.calendar.calendar_client")
    def test_creates_event_without_optional_fields(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.events().insert().execute.return_value = {"id": "evt"}

        insert_event(_creds(), "Heads up", _dt(14), _dt(15))

        call_kwargs = mock_service.events().insert.call_args.kwargs
        body = call_kwargs["body"]
        assert "attendees" not in body
        assert "description" not in body


class TestPatchEvent:
    @patch("server.services.calendar.calendar_client")
    def test_patches_only_provided_fields(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        updated = {"id": "evt1", "summary": "Renamed"}
        mock_service.events().patch().execute.return_value = updated

        result = patch_event(_creds(), event_id="evt1", title="Renamed")

        call_kwargs = mock_service.events().patch.call_args.kwargs
        assert call_kwargs["eventId"] == "evt1"
        assert call_kwargs["calendarId"] == "primary"
        body = call_kwargs["body"]
        assert body["summary"] == "Renamed"
        assert "start" not in body
        assert "end" not in body
        assert result["summary"] == "Renamed"

    @patch("server.services.calendar.calendar_client")
    def test_patches_all_fields(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.events().patch().execute.return_value = {"id": "evt1"}

        patch_event(
            _creds(),
            event_id="evt1",
            title="Updated",
            start=_dt(10),
            end=_dt(11),
            attendees=["bob@example.com"],
            description="New description",
        )

        body = mock_service.events().patch.call_args.kwargs["body"]
        assert body["summary"] == "Updated"
        assert "dateTime" in body["start"]
        assert "dateTime" in body["end"]
        assert body["attendees"] == [{"email": "bob@example.com"}]
        assert body["description"] == "New description"

    @patch("server.services.calendar.calendar_client")
    def test_empty_patch_sends_empty_body(self, mock_client):
        mock_service = MagicMock()
        mock_client.return_value = mock_service
        mock_service.events().patch().execute.return_value = {"id": "evt1"}

        patch_event(_creds(), event_id="evt1")

        body = mock_service.events().patch.call_args.kwargs["body"]
        assert body == {}
