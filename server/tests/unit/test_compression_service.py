"""Unit tests for server/services/compression.py."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.services.compression import (
    IDLE_HOURS,
    KEEP_RECENT,
    MESSAGE_LIMIT,
    get_session_context,
    maybe_compress_session,
)
from server.models import ChatMessage, ChatSession


def _msg(
    content: str,
    role: str = "user",
    created_at: datetime | None = None,
    archived_at: datetime | None = None,
) -> ChatMessage:
    m = ChatMessage(
        id=uuid.uuid4(),
        chat_session_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        role=role,
        content=content,
        archived_at=archived_at,
        created_at=created_at or datetime.now(timezone.utc),
    )
    return m


def _recent_messages(n: int) -> list[ChatMessage]:
    return [_msg(f"msg {i}") for i in range(n)]


def _old_messages(n: int) -> list[ChatMessage]:
    old_time = datetime.now(timezone.utc) - timedelta(hours=IDLE_HOURS + 1)
    return [_msg(f"old msg {i}", created_at=old_time) for i in range(n)]


def _make_db(messages: list[ChatMessage], session: ChatSession | None = None):
    """Return a mocked AsyncSession that returns given messages on first execute, session on second."""
    db = AsyncMock()
    call_count = 0

    async def execute_side_effect(query):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            result.scalars.return_value.all.return_value = messages
        else:
            result.scalar_one_or_none.return_value = session
        return result

    db.execute = AsyncMock(side_effect=execute_side_effect)
    db.commit = AsyncMock()
    return db


class TestMaybeCompressSession:
    @pytest.mark.asyncio
    async def test_no_compression_when_under_limit_and_recent(self):
        messages = _recent_messages(10)
        db = _make_db(messages)
        result = await maybe_compress_session(uuid.uuid4(), uuid.uuid4(), db)
        assert result is False

    @pytest.mark.asyncio
    async def test_compresses_when_over_message_limit(self):
        # Create MESSAGE_LIMIT + 5 messages, all recent
        messages = _recent_messages(MESSAGE_LIMIT + 5)
        db = AsyncMock()

        async def execute_side_effect(stmt):
            result = MagicMock()
            result.scalars.return_value.all.return_value = messages
            return result

        db.execute = AsyncMock(side_effect=execute_side_effect)
        db.commit = AsyncMock()

        with patch(
            "server.services.compression._generate_summary",
            new=AsyncMock(return_value="Summary text"),
        ):
            compressed = await maybe_compress_session(uuid.uuid4(), uuid.uuid4(), db)

        assert compressed is True
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_compresses_when_idle_too_long(self):
        # Even under MESSAGE_LIMIT, idle sessions get compressed
        messages = _old_messages(MESSAGE_LIMIT + 5)
        db = AsyncMock()

        async def execute_side_effect(stmt):
            result = MagicMock()
            result.scalars.return_value.all.return_value = messages
            return result

        db.execute = AsyncMock(side_effect=execute_side_effect)
        db.commit = AsyncMock()

        with patch(
            "server.services.compression._generate_summary",
            new=AsyncMock(return_value="Summary"),
        ):
            compressed = await maybe_compress_session(uuid.uuid4(), uuid.uuid4(), db)

        assert compressed is True

    @pytest.mark.asyncio
    async def test_returns_false_for_empty_session(self):
        db = _make_db([])
        result = await maybe_compress_session(uuid.uuid4(), uuid.uuid4(), db)
        assert result is False


class TestGetSessionContext:
    @pytest.mark.asyncio
    async def test_returns_summary_and_messages(self):
        session = ChatSession(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            summary="Past summary",
        )
        messages = [_msg("hello", role="user"), _msg("hi", role="assistant")]

        db = AsyncMock()
        call_count = 0

        async def execute_side_effect(q):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = session
            else:
                result.scalars.return_value.all.return_value = messages
            return result

        db.execute = AsyncMock(side_effect=execute_side_effect)

        summary, msgs = await get_session_context(uuid.uuid4(), db)
        assert summary == "Past summary"
        assert len(msgs) == 2
        # Messages are returned in chronological order after desc+reverse
        assert any(m["role"] == "user" for m in msgs)

    @pytest.mark.asyncio
    async def test_returns_none_summary_when_no_session(self):
        db = AsyncMock()
        call_count = 0

        async def execute_side_effect(q):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = None
            else:
                result.scalars.return_value.all.return_value = []
            return result

        db.execute = AsyncMock(side_effect=execute_side_effect)

        summary, msgs = await get_session_context(uuid.uuid4(), db)
        assert summary is None
        assert msgs == []
