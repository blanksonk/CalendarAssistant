"""Chat history compression — summarises and archives old messages."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import anthropic
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.models import ChatMessage, ChatSession

MESSAGE_LIMIT = 50          # compress when session exceeds this many messages
IDLE_HOURS = 24             # or when idle this long
KEEP_RECENT = 20            # keep the N most recent messages after compression


async def maybe_compress_session(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """
    Check if the session needs compression. If so, summarise + archive.
    Returns True if compression was performed.
    """
    # Load all active (non-archived) messages
    result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.chat_session_id == session_id,
            ChatMessage.archived_at.is_(None),
        )
        .order_by(ChatMessage.created_at)
    )
    messages = list(result.scalars().all())

    if len(messages) <= MESSAGE_LIMIT:
        # Also check idle time
        if not messages:
            return False
        last_msg_time = messages[-1].created_at
        if last_msg_time.tzinfo is None:
            last_msg_time = last_msg_time.replace(tzinfo=timezone.utc)
        idle_since = datetime.now(timezone.utc) - last_msg_time
        if idle_since < timedelta(hours=IDLE_HOURS):
            return False

    if len(messages) <= KEEP_RECENT:
        return False

    # Build conversation text for summarisation
    to_archive = messages[:-KEEP_RECENT]
    conversation_text = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in to_archive
    )

    # Summarise via Claude
    summary = await _generate_summary(conversation_text)

    # Store summary on the ChatSession
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(summary=summary)
    )

    # Archive old messages
    now = datetime.now(timezone.utc)
    for msg in to_archive:
        await db.execute(
            update(ChatMessage)
            .where(ChatMessage.id == msg.id)
            .values(archived_at=now)
        )

    await db.commit()
    return True


async def _generate_summary(conversation_text: str) -> str:
    """Use Claude to summarise a conversation excerpt."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": (
                    "Please summarise the following conversation in 3–5 sentences, "
                    "preserving any scheduling decisions, meeting proposals, or commitments made:\n\n"
                    f"{conversation_text}"
                ),
            }
        ],
    )
    return message.content[0].text.strip()


async def get_session_context(
    session_id: uuid.UUID,
    db: AsyncSession,
    max_recent: int = KEEP_RECENT,
) -> tuple[str | None, list[dict[str, Any]]]:
    """
    Return (summary, recent_messages) for building Claude context.
    Recent messages are dicts with role + content.
    """
    # Load session summary
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    summary = session.summary if session else None

    # Load recent active messages
    result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.chat_session_id == session_id,
            ChatMessage.archived_at.is_(None),
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(max_recent)
    )
    rows = list(result.scalars().all())
    messages = [{"role": r.role, "content": r.content} for r in reversed(rows)]
    return summary, messages
