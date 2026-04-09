"""Unit tests for server/routes/chat.py."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from server.main import app
from server.middleware.auth import get_current_user, get_oauth_token
from server.models import ChatSession, OAuthToken, User
from server.routes.chat import _get_or_create_session, _load_history


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
    from server.services.google import encrypt_token
    return OAuthToken(
        user_id=user_id,
        access_token=encrypt_token("access-tok"),
        refresh_token=encrypt_token("refresh-tok"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )


# ---------------------------------------------------------------------------
# _get_or_create_session
# ---------------------------------------------------------------------------


class TestGetOrCreateSession:
    @pytest.mark.asyncio
    async def test_creates_new_session_when_none_provided(self):
        user = _mock_user()
        db = AsyncMock()
        new_session = ChatSession(id=uuid.uuid4(), user_id=user.id)

        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "id", new_session.id))

        result = await _get_or_create_session(user, None, db)
        db.add.assert_called_once()
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_existing_session_when_found(self):
        user = _mock_user()
        sid = uuid.uuid4()
        existing = ChatSession(id=sid, user_id=user.id)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        result = await _get_or_create_session(user, str(sid), db)
        assert result.id == sid

    @pytest.mark.asyncio
    async def test_invalid_session_id_raises_400(self):
        from fastapi import HTTPException
        user = _mock_user()
        db = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await _get_or_create_session(user, "not-a-uuid", db)
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# _load_history
# ---------------------------------------------------------------------------


class TestLoadHistory:
    @pytest.mark.asyncio
    async def test_empty_session_returns_empty_list(self):
        session = ChatSession(id=uuid.uuid4(), user_id=uuid.uuid4(), summary=None)
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        history = await _load_history(session, db)
        assert history == []

    @pytest.mark.asyncio
    async def test_summary_prepended_when_present(self):
        from server.models import ChatMessage
        session = ChatSession(
            id=uuid.uuid4(), user_id=uuid.uuid4(), summary="Past conversation summary"
        )
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        history = await _load_history(session, db)
        assert len(history) == 1
        assert "Past conversation summary" in history[0]["content"]


# ---------------------------------------------------------------------------
# POST /api/chat — integration-style with overridden deps
# ---------------------------------------------------------------------------


class TestChatRoute:
    def _setup_app(self, user: User, token: OAuthToken):
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_oauth_token] = lambda: token
        return app

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_empty_message_returns_400(self):
        user = _mock_user()
        token = _mock_token(user.id)
        self._setup_app(user, token)

        with patch("server.routes.chat.get_db"):
            from fastapi.testclient import TestClient
            client = TestClient(app, raise_server_exceptions=False)
            # Mock the DB dependency
            async def mock_db():
                db = AsyncMock()
                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = None
                db.execute = AsyncMock(return_value=mock_result)
                db.add = MagicMock()
                db.commit = AsyncMock()
                db.refresh = AsyncMock()
                yield db

            from server.database import get_db
            app.dependency_overrides[get_db] = mock_db

            resp = client.post("/api/chat", json={"message": "  "})
            assert resp.status_code == 400

    def test_valid_message_streams_sse(self):
        user = _mock_user()
        token = _mock_token(user.id)
        self._setup_app(user, token)

        new_session = ChatSession(id=uuid.uuid4(), user_id=user.id, summary=None)

        async def mock_db():
            db = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_result.scalars.return_value.all.return_value = []
            db.execute = AsyncMock(return_value=mock_result)
            db.add = MagicMock()
            db.commit = AsyncMock()

            async def refresh_side_effect(obj):
                obj.id = new_session.id
                obj.summary = None

            db.refresh = AsyncMock(side_effect=refresh_side_effect)
            yield db

        from server.database import get_db
        app.dependency_overrides[get_db] = mock_db

        async def fake_agent(messages, creds=None, system=None, **kwargs):
            yield 'data: {"type":"text","delta":"Hello"}\n\n'
            yield 'data: {"type":"done"}\n\n'

        with patch("server.routes.chat.claude_service.run_agent", side_effect=fake_agent):
            client = TestClient(app, raise_server_exceptions=False)
            with client.stream("POST", "/api/chat", json={"message": "Hi"}) as resp:
                assert resp.status_code == 200
                assert "text/event-stream" in resp.headers["content-type"]
                content = b"".join(resp.iter_bytes()).decode()
                assert "Hello" in content
                assert "done" in content
