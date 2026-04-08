"""Unit tests for the calendar API routes.

Tests verify: auth guard applied, correct service calls made, response shape.
All external dependencies (Google API, DB) are mocked.
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from server.models import OAuthToken, User


def _make_user() -> User:
    return User(
        id=uuid.uuid4(),
        google_id="gid",
        email="u@example.com",
        name="User",
    )


def _make_token(user_id: uuid.UUID) -> OAuthToken:
    from server.services.google import encrypt_token

    return OAuthToken(
        user_id=user_id,
        access_token=encrypt_token("fake-access"),
        refresh_token=encrypt_token("fake-refresh"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )


class TestGetEventsRoute:
    @patch("server.routes.calendar.cal_service.list_events")
    def test_returns_events_list(self, mock_list):
        from server.main import app
        from server.middleware.auth import get_current_user, get_oauth_token
        from server.database import get_db

        user = _make_user()
        token = _make_token(user.id)
        mock_list.return_value = [{"id": "e1", "summary": "Standup"}]

        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_oauth_token] = lambda: token
        app.dependency_overrides[get_db] = lambda: AsyncMock()

        try:
            client = TestClient(app)
            resp = client.get("/api/calendar/events")
            assert resp.status_code == 200
            body = resp.json()
            assert "events" in body
            assert body["events"][0]["summary"] == "Standup"
        finally:
            app.dependency_overrides.clear()

    @patch("server.routes.calendar.cal_service.list_events")
    def test_default_range_is_current_week(self, mock_list):
        from server.main import app
        from server.middleware.auth import get_current_user, get_oauth_token
        from server.database import get_db

        user = _make_user()
        token = _make_token(user.id)
        mock_list.return_value = []

        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_oauth_token] = lambda: token
        app.dependency_overrides[get_db] = lambda: AsyncMock()

        try:
            client = TestClient(app)
            resp = client.get("/api/calendar/events")
            assert resp.status_code == 200
            # list_events was called with start/end derived automatically
            mock_list.assert_called_once()
            start_arg = mock_list.call_args[0][1]
            assert start_arg.weekday() == 0  # Monday
        finally:
            app.dependency_overrides.clear()

    def test_unauthenticated_returns_401(self):
        from server.main import app

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/calendar/events")
        assert resp.status_code == 401


class TestCreateEventRoute:
    @patch("server.routes.calendar.cal_service.insert_event")
    def test_creates_event_and_returns_it(self, mock_insert):
        from server.main import app
        from server.middleware.auth import get_current_user, get_oauth_token
        from server.database import get_db

        user = _make_user()
        token = _make_token(user.id)
        created = {"id": "new-evt", "summary": "Sync"}
        mock_insert.return_value = created

        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_oauth_token] = lambda: token
        app.dependency_overrides[get_db] = lambda: AsyncMock()

        try:
            client = TestClient(app)
            resp = client.post(
                "/api/calendar/events",
                params={
                    "title": "Sync",
                    "start": "2026-04-07T10:00:00Z",
                    "end": "2026-04-07T11:00:00Z",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["id"] == "new-evt"
        finally:
            app.dependency_overrides.clear()


class TestPatchEventRoute:
    def _setup(self, mock_patch):
        from server.main import app
        from server.middleware.auth import get_current_user, get_oauth_token
        from server.database import get_db

        user = _make_user()
        token = _make_token(user.id)
        mock_patch.return_value = {"id": "evt1", "summary": "Renamed"}

        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_oauth_token] = lambda: token
        app.dependency_overrides[get_db] = lambda: AsyncMock()
        return app, user, token

    @patch("server.routes.calendar.cal_service.patch_event")
    def test_patches_event_and_returns_updated(self, mock_patch):
        app, _, _ = self._setup(mock_patch)
        try:
            client = TestClient(app)
            resp = client.patch(
                "/api/calendar/events/evt1",
                params={"title": "Renamed"},
            )
            assert resp.status_code == 200
            assert resp.json()["summary"] == "Renamed"
            mock_patch.assert_called_once()
            assert mock_patch.call_args.kwargs["event_id"] == "evt1"
            assert mock_patch.call_args.kwargs["title"] == "Renamed"
        finally:
            app.dependency_overrides.clear()

    @patch("server.routes.calendar.cal_service.patch_event")
    def test_passes_only_provided_params(self, mock_patch):
        app, _, _ = self._setup(mock_patch)
        try:
            client = TestClient(app)
            client.patch("/api/calendar/events/evt1", params={"description": "New desc"})
            kwargs = mock_patch.call_args.kwargs
            assert kwargs["description"] == "New desc"
            assert kwargs["title"] is None
            assert kwargs["start"] is None
        finally:
            app.dependency_overrides.clear()

    def test_unauthenticated_returns_401(self):
        from server.main import app
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.patch("/api/calendar/events/evt1", params={"title": "x"})
        assert resp.status_code == 401
