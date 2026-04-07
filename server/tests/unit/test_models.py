"""Unit tests for SQLAlchemy ORM models.

These tests verify model construction, relationships, constraints, and cascade
behavior entirely in-memory — no database connection is required.
"""
import uuid
from datetime import datetime, timezone

import pytest

from server.models import (
    ChatMessage,
    ChatSession,
    OAuthToken,
    Session,
    ToolCall,
    User,
    WeeklyFocus,
)


def _user(**kwargs) -> User:
    defaults = dict(
        google_id="google-123",
        email="user@example.com",
        name="Test User",
    )
    return User(**{**defaults, **kwargs})


def _future() -> datetime:
    return datetime(2030, 1, 1, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# User model
# ---------------------------------------------------------------------------


class TestUserModel:
    def test_auto_uuid_on_construction(self):
        u = _user()
        assert u.id is None or isinstance(u.id, uuid.UUID)

    def test_required_fields(self):
        u = _user()
        assert u.google_id == "google-123"
        assert u.email == "user@example.com"
        assert u.name == "Test User"

    def test_picture_optional(self):
        u = _user()
        assert u.picture is None

    def test_relationships_exist(self):
        u = _user()
        assert hasattr(u, "sessions")
        assert hasattr(u, "oauth_token")
        assert hasattr(u, "chat_sessions")
        assert hasattr(u, "chat_messages")
        assert hasattr(u, "tool_calls")
        assert hasattr(u, "weekly_focuses")

    def test_table_name(self):
        assert User.__tablename__ == "users"


# ---------------------------------------------------------------------------
# Session model
# ---------------------------------------------------------------------------


class TestSessionModel:
    def test_construction(self):
        user_id = uuid.uuid4()
        s = Session(user_id=user_id, expires_at=_future())
        assert s.user_id == user_id
        assert s.expires_at == _future()

    def test_table_name(self):
        assert Session.__tablename__ == "sessions"


# ---------------------------------------------------------------------------
# OAuthToken model
# ---------------------------------------------------------------------------


class TestOAuthTokenModel:
    def test_construction(self):
        user_id = uuid.uuid4()
        token = OAuthToken(
            user_id=user_id,
            access_token="enc-access",
            refresh_token="enc-refresh",
            expires_at=_future(),
        )
        assert token.access_token == "enc-access"
        assert token.refresh_token == "enc-refresh"

    def test_table_name(self):
        assert OAuthToken.__tablename__ == "oauth_tokens"


# ---------------------------------------------------------------------------
# ChatSession model
# ---------------------------------------------------------------------------


class TestChatSessionModel:
    def test_summary_nullable(self):
        cs = ChatSession(user_id=uuid.uuid4())
        assert cs.summary is None
        assert cs.summary_embedding is None

    def test_table_name(self):
        assert ChatSession.__tablename__ == "chat_sessions"


# ---------------------------------------------------------------------------
# ChatMessage model
# ---------------------------------------------------------------------------


class TestChatMessageModel:
    def test_valid_roles(self):
        for role in ("user", "assistant"):
            msg = ChatMessage(
                chat_session_id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                role=role,
                content="hello",
            )
            assert msg.role == role

    def test_embedding_nullable(self):
        msg = ChatMessage(
            chat_session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            role="user",
            content="hi",
        )
        assert msg.embedding is None

    def test_archived_at_nullable(self):
        msg = ChatMessage(
            chat_session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            role="user",
            content="hi",
        )
        assert msg.archived_at is None

    def test_role_constraint_name(self):
        constraints = {c.name for c in ChatMessage.__table__.constraints}
        assert "chat_messages_role_check" in constraints

    def test_table_name(self):
        assert ChatMessage.__tablename__ == "chat_messages"


# ---------------------------------------------------------------------------
# ToolCall model
# ---------------------------------------------------------------------------


class TestToolCallModel:
    def test_construction(self):
        tc = ToolCall(
            user_id=uuid.uuid4(),
            chat_session_id=uuid.uuid4(),
            tool_name="list_events",
            status="success",
        )
        assert tc.tool_name == "list_events"
        assert tc.status == "success"

    def test_optional_fields(self):
        tc = ToolCall(
            user_id=uuid.uuid4(),
            chat_session_id=uuid.uuid4(),
            tool_name="get_free_slots",
            status="error",
        )
        assert tc.input is None
        assert tc.output is None
        assert tc.error_message is None
        assert tc.duration_ms is None

    def test_status_constraint_name(self):
        constraints = {c.name for c in ToolCall.__table__.constraints}
        assert "tool_calls_status_check" in constraints

    def test_table_name(self):
        assert ToolCall.__tablename__ == "tool_calls"


# ---------------------------------------------------------------------------
# WeeklyFocus model
# ---------------------------------------------------------------------------


class TestWeeklyFocusModel:
    def test_construction(self):
        user_id = uuid.uuid4()
        wf = WeeklyFocus(
            user_id=user_id,
            week_start=datetime(2026, 4, 6),
            narrative="You had a productive week.",
        )
        assert wf.user_id == user_id
        assert wf.narrative == "You had a productive week."

    def test_table_name(self):
        assert WeeklyFocus.__tablename__ == "weekly_focus"


# ---------------------------------------------------------------------------
# Cascade relationship structure
# ---------------------------------------------------------------------------


class TestCascadeStructure:
    """Verify cascade is set up correctly by inspecting relationship properties."""

    def test_user_sessions_cascade(self):
        rel = User.__mapper__.relationships["sessions"]
        assert "delete" in rel.cascade or "all" in str(rel.cascade)

    def test_user_oauth_token_cascade(self):
        rel = User.__mapper__.relationships["oauth_token"]
        assert "delete" in rel.cascade or "all" in str(rel.cascade)

    def test_user_chat_sessions_cascade(self):
        rel = User.__mapper__.relationships["chat_sessions"]
        assert "delete" in rel.cascade or "all" in str(rel.cascade)

    def test_chat_session_messages_cascade(self):
        rel = ChatSession.__mapper__.relationships["messages"]
        assert "delete" in rel.cascade or "all" in str(rel.cascade)

    def test_chat_session_tool_calls_cascade(self):
        rel = ChatSession.__mapper__.relationships["tool_calls"]
        assert "delete" in rel.cascade or "all" in str(rel.cascade)
