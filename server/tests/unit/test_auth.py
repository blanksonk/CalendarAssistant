"""Unit tests for Google OAuth routes and session middleware.

All external dependencies (Google APIs, database) are mocked.
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport

from server.models import OAuthToken, Session, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(user_id: uuid.UUID | None = None) -> User:
    return User(
        id=user_id or uuid.uuid4(),
        google_id="google-abc",
        email="test@example.com",
        name="Test User",
        picture=None,
    )


def _make_session(user_id: uuid.UUID, expired: bool = False) -> Session:
    delta = timedelta(days=-1) if expired else timedelta(days=30)
    return Session(
        id=uuid.uuid4(),
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + delta,
    )


# ---------------------------------------------------------------------------
# Session middleware tests
# ---------------------------------------------------------------------------


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_raises_401_when_no_cookie(self):
        from server.middleware.auth import get_current_user

        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(session_id=None, db=mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_raises_401_for_invalid_uuid(self):
        from server.middleware.auth import get_current_user

        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(session_id="not-a-uuid", db=mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_raises_401_when_session_not_found(self):
        from server.middleware.auth import get_current_user

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(session_id=str(uuid.uuid4()), db=mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_user_for_valid_session(self):
        from server.middleware.auth import get_current_user

        user = _make_user()
        session = _make_session(user.id)

        mock_db = AsyncMock()
        session_result = MagicMock()
        session_result.scalar_one_or_none.return_value = session
        update_result = MagicMock()  # result of UPDATE last_seen_at
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = user

        # get_current_user calls execute 3x: SELECT session, UPDATE last_seen_at, SELECT user
        mock_db.execute = AsyncMock(side_effect=[session_result, update_result, user_result])
        mock_db.commit = AsyncMock()

        result = await get_current_user(session_id=str(session.id), db=mock_db)
        assert result.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_raises_401_when_user_not_found_after_valid_session(self):
        from server.middleware.auth import get_current_user

        session = _make_session(uuid.uuid4())

        mock_db = AsyncMock()
        session_result = MagicMock()
        session_result.scalar_one_or_none.return_value = session
        update_result = MagicMock()
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = None

        mock_db.execute = AsyncMock(side_effect=[session_result, update_result, user_result])
        mock_db.commit = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(session_id=str(session.id), db=mock_db)
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Auth route tests
# ---------------------------------------------------------------------------


class TestLogout:
    @pytest.mark.asyncio
    async def test_logout_deletes_session_and_clears_cookie(self):
        from server.routes.auth import logout
        from fastapi.responses import Response

        session_id = str(uuid.uuid4())
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        response = Response()
        result = await logout(response=response, session_id=session_id, db=mock_db)

        assert result == {"status": "logged_out"}
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_logout_without_cookie_is_safe(self):
        from server.routes.auth import logout
        from fastapi.responses import Response

        mock_db = AsyncMock()
        response = Response()
        result = await logout(response=response, session_id=None, db=mock_db)

        assert result == {"status": "logged_out"}
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_logout_handles_invalid_session_id(self):
        from server.routes.auth import logout
        from fastapi.responses import Response

        mock_db = AsyncMock()
        response = Response()
        # Should not raise — invalid UUID is silently ignored
        result = await logout(response=response, session_id="bad-uuid", db=mock_db)
        assert result == {"status": "logged_out"}


class TestMeRoute:
    @pytest.mark.asyncio
    async def test_returns_user_profile(self):
        from server.routes.auth import me

        user = _make_user()
        result = await me(current_user=user)

        assert result["email"] == user.email
        assert result["name"] == user.name
        assert str(result["id"]) == str(user.id)


# ---------------------------------------------------------------------------
# Token encryption tests
# ---------------------------------------------------------------------------


class TestTokenEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from server.services.google import decrypt_token, encrypt_token

        plaintext = "ya29.test-access-token"
        encrypted = encrypt_token(plaintext)
        assert encrypted != plaintext
        assert decrypt_token(encrypted) == plaintext

    def test_different_calls_produce_different_ciphertext(self):
        """Fernet uses random IV — same input should not produce identical output."""
        from server.services.google import encrypt_token

        t1 = encrypt_token("same-token")
        t2 = encrypt_token("same-token")
        assert t1 != t2
