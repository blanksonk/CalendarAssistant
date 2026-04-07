"""Shared pytest fixtures for the server test suite."""
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

# Set dummy env vars before any server module is imported.
# server/config.py instantiates Settings() at module level, so env vars
# must exist before any server import happens.
_TEST_ENV = {
    "GOOGLE_CLIENT_ID": "test-client-id",
    "GOOGLE_CLIENT_SECRET": "test-client-secret",
    "GOOGLE_REDIRECT_URI": "http://localhost:8000/api/auth/google/callback",
    "ANTHROPIC_API_KEY": "test-anthropic-key",
    "VOYAGE_API_KEY": "test-voyage-key",
    "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
    "SESSION_SECRET": "test-session-secret-32-chars-long!!",
    # Valid 32-byte Fernet key (URL-safe base64, 44 chars required)
    "ENCRYPTION_KEY": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
}
for _k, _v in _TEST_ENV.items():
    os.environ.setdefault(_k, _v)

import pytest  # noqa: E402

from server.models import (  # noqa: E402
    ChatMessage,
    ChatSession,
    OAuthToken,
    Session,
    ToolCall,
    User,
    WeeklyFocus,
)


@pytest.fixture
def mock_user() -> User:
    """A fully populated User object for use in tests."""
    return User(
        id=uuid.uuid4(),
        google_id="google-test-123",
        email="test@example.com",
        name="Test User",
        picture="https://example.com/photo.jpg",
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


@pytest.fixture
def mock_db_session():
    """AsyncMock SQLAlchemy session — never touches a real database."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session
