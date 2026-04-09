"""Unit tests for server/routes/people.py and server/services/people.py."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from server.main import app
from server.middleware.auth import get_current_user, get_oauth_token
from server.models import OAuthToken, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_user() -> User:
    return User(
        id=uuid.uuid4(),
        google_id="g-456",
        email="user@example.com",
        name="Test User",
        picture=None,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def _mock_token(user_id: uuid.UUID) -> OAuthToken:
    from server.services.google import encrypt_token
    return OAuthToken(
        user_id=user_id,
        access_token=encrypt_token("access-tok"),
        refresh_token=encrypt_token("refresh-tok"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )


# ---------------------------------------------------------------------------
# People route tests
# ---------------------------------------------------------------------------


class TestPeopleRoute:
    def setup_method(self):
        self.user = _mock_user()
        self.token = _mock_token(self.user.id)
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_oauth_token] = lambda: self.token

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_search_returns_results(self):
        fake_results = [{"name": "Alice Smith", "email": "alice@example.com"}]
        with patch("server.routes.people.people_service.search_contacts", return_value=fake_results):
            client = TestClient(app)
            resp = client.get("/api/people/search?q=alice")
        assert resp.status_code == 200
        assert resp.json()["results"] == fake_results

    def test_search_returns_empty_list(self):
        with patch("server.routes.people.people_service.search_contacts", return_value=[]):
            client = TestClient(app)
            resp = client.get("/api/people/search?q=nobody")
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_missing_q_returns_422(self):
        client = TestClient(app)
        resp = client.get("/api/people/search")
        assert resp.status_code == 422

    def test_scope_missing_returns_403(self):
        with patch(
            "server.routes.people.people_service.search_contacts",
            side_effect=ValueError("contacts_scope_missing"),
        ):
            client = TestClient(app)
            resp = client.get("/api/people/search?q=alice")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "contacts_scope_missing"

    def test_unauthenticated_returns_401(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/people/search?q=alice")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# People service tests
# ---------------------------------------------------------------------------


class TestSearchContacts:
    def _make_person(self, name: str, email: str, primary: bool = True) -> dict:
        return {
            "names": [{"displayName": name, "metadata": {"primary": primary}}],
            "emailAddresses": [{"value": email, "metadata": {"primary": primary}}],
        }

    def test_returns_contacts_from_people_api(self):
        from server.services.people import search_contacts

        mock_service = MagicMock()
        person = self._make_person("Bob Jones", "bob@example.com")
        mock_service.people().searchContacts().execute.return_value = {
            "results": [{"person": person}]
        }
        # Directory search returns nothing
        mock_service.people().searchDirectoryPeople().execute.return_value = {"people": []}

        with patch("server.services.people.people_client", return_value=mock_service):
            creds = MagicMock()
            results = search_contacts(creds, "bob")

        assert len(results) == 1
        assert results[0]["name"] == "Bob Jones"
        assert results[0]["email"] == "bob@example.com"

    def test_deduplicates_across_sources(self):
        from server.services.people import search_contacts

        mock_service = MagicMock()
        person = self._make_person("Alice", "alice@example.com")
        mock_service.people().searchContacts().execute.return_value = {
            "results": [{"person": person}]
        }
        # Directory returns the same email — should be deduped
        mock_service.people().searchDirectoryPeople().execute.return_value = {
            "people": [person]
        }

        with patch("server.services.people.people_client", return_value=mock_service):
            creds = MagicMock()
            results = search_contacts(creds, "alice")

        emails = [r["email"] for r in results]
        assert emails.count("alice@example.com") == 1

    def test_raises_on_scope_403(self):
        from server.services.people import search_contacts
        from googleapiclient.errors import HttpError
        import httplib2

        mock_service = MagicMock()
        resp = httplib2.Response({"status": "403"})
        resp.reason = "Forbidden"
        exc = HttpError(resp=resp, content=b'{"error":{"status":"PERMISSION_DENIED"}}')
        mock_service.people().searchContacts().execute.side_effect = exc

        with patch("server.services.people.people_client", return_value=mock_service):
            creds = MagicMock()
            with pytest.raises(ValueError, match="contacts_scope_missing"):
                search_contacts(creds, "alice")

    def test_skips_contacts_without_email(self):
        from server.services.people import search_contacts

        mock_service = MagicMock()
        # Person with no email address
        no_email_person = {"names": [{"displayName": "No Email", "metadata": {"primary": True}}], "emailAddresses": []}
        mock_service.people().searchContacts().execute.return_value = {
            "results": [{"person": no_email_person}]
        }
        mock_service.people().searchDirectoryPeople().execute.return_value = {"people": []}

        with patch("server.services.people.people_client", return_value=mock_service):
            creds = MagicMock()
            results = search_contacts(creds, "no")

        assert results == []
