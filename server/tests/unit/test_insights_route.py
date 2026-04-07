"""Unit tests for server/routes/insights.py."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from server.main import app
from server.middleware.auth import get_current_user, get_oauth_token
from server.models import OAuthToken, User
from server.services.google import encrypt_token


def _mock_user() -> User:
    return User(
        id=uuid.uuid4(),
        google_id="g-123",
        email="test@example.com",
        name="Test User",
        picture=None,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def _mock_token(user_id: uuid.UUID) -> OAuthToken:
    return OAuthToken(
        user_id=user_id,
        access_token=encrypt_token("access-tok"),
        refresh_token=encrypt_token("refresh-tok"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )


MOCK_EVENTS = [
    {
        "id": "e1",
        "summary": "Standup",
        "start": {"dateTime": "2026-04-07T09:00:00Z"},
        "end": {"dateTime": "2026-04-07T09:30:00Z"},
    },
    {
        "id": "e2",
        "summary": "1:1",
        "start": {"dateTime": "2026-04-07T10:00:00Z"},
        "end": {"dateTime": "2026-04-07T11:00:00Z"},
        "description": "Weekly 1:1",
    },
]


class TestInsightsRoute:
    def _setup(self, user: User, token: OAuthToken):
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_oauth_token] = lambda: token

        async def mock_db():
            db = AsyncMock()
            yield db

        from server.database import get_db
        app.dependency_overrides[get_db] = mock_db
        return TestClient(app, raise_server_exceptions=False)

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_returns_200_with_insights_structure(self):
        user = _mock_user()
        token = _mock_token(user.id)
        client = self._setup(user, token)

        with patch("server.routes.insights.cal_service.list_events", return_value=MOCK_EVENTS):
            resp = client.get("/api/insights?week=2026-04-06")

        assert resp.status_code == 200
        data = resp.json()
        assert "at_a_glance" in data
        assert "time_breakdown" in data
        assert "meeting_quality" in data
        assert "top_people" in data
        assert "top_series" in data

    def test_total_meetings_matches_events(self):
        user = _mock_user()
        token = _mock_token(user.id)
        client = self._setup(user, token)

        with patch("server.routes.insights.cal_service.list_events", return_value=MOCK_EVENTS):
            resp = client.get("/api/insights?week=2026-04-06")

        data = resp.json()
        assert data["total_meetings"] == 2

    def test_defaults_to_current_week(self):
        user = _mock_user()
        token = _mock_token(user.id)
        client = self._setup(user, token)

        with patch("server.routes.insights.cal_service.list_events", return_value=[]) as mock_list:
            resp = client.get("/api/insights")

        assert resp.status_code == 200
        # Should have called list_events
        mock_list.assert_called_once()

    def test_week_start_in_response(self):
        user = _mock_user()
        token = _mock_token(user.id)
        client = self._setup(user, token)

        with patch("server.routes.insights.cal_service.list_events", return_value=[]):
            resp = client.get("/api/insights?week=2026-04-06")

        data = resp.json()
        assert data["week_start"] == "2026-04-06"
