"""Chat SSE route — streams Claude agent responses to the frontend."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.middleware.auth import get_current_user, get_oauth_token
from server.models import ChatMessage, ChatSession, OAuthToken, User
from server.services import claude as claude_service
from server.services.google import credentials_from_tokens, decrypt_token

router = APIRouter()

_MAX_RECENT_MESSAGES = 20


class ChatRequest(BaseModel):
    message: str
    chat_session_id: str | None = None


def _build_creds(token: OAuthToken):
    return credentials_from_tokens(
        access_token=decrypt_token(token.access_token),
        refresh_token=decrypt_token(token.refresh_token),
        expires_at=token.expires_at,
    )


async def _get_or_create_session(
    user: User,
    session_id_str: str | None,
    db: AsyncSession,
) -> ChatSession:
    """Return an existing chat session or create a new one."""
    if session_id_str:
        try:
            sid = uuid.UUID(session_id_str)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID")

        result = await db.execute(
            select(ChatSession).where(ChatSession.id == sid, ChatSession.user_id == user.id)
        )
        session = result.scalar_one_or_none()
        if session:
            return session

    # Create a new session
    new_session = ChatSession(user_id=user.id)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


async def _load_history(session: ChatSession, db: AsyncSession) -> list[dict[str, Any]]:
    """Load recent messages from this chat session for Claude context."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(_MAX_RECENT_MESSAGES)
    )
    rows = result.scalars().all()
    # Reverse to chronological order
    messages = [{"role": r.role, "content": r.content} for r in reversed(rows)]

    # Prepend summary as a system message if it exists
    if session.summary:
        messages.insert(0, {
            "role": "user",
            "content": f"[Previous conversation summary: {session.summary}]",
        })

    return messages


async def _persist_message(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    role: str,
    content: str,
    db: AsyncSession,
) -> None:
    msg = ChatMessage(
        user_id=user_id,
        chat_session_id=session_id,
        role=role,
        content=content,
    )
    db.add(msg)
    await db.commit()


@router.post("")
async def chat(
    body: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /api/chat  →  text/event-stream

    Streams SSE events from the Claude agent loop.
    """
    if not body.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty")

    session = await _get_or_create_session(current_user, body.chat_session_id, db)
    history = await _load_history(session, db)

    # Persist the user message
    await _persist_message(current_user.id, session.id, "user", body.message, db)

    history.append({"role": "user", "content": body.message})
    creds = _build_creds(token)

    # Accumulate the full assistant reply so we can persist it after streaming
    collected_text: list[str] = []

    async def _stream():
        async for chunk in claude_service.run_agent(history, creds=creds):
            yield chunk
            # Collect text deltas for persistence
            import json as _json
            try:
                for part in chunk.split("\n\n"):
                    part = part.strip()
                    if part.startswith("data: "):
                        event = _json.loads(part[6:])
                        if event.get("type") == "text":
                            collected_text.append(event.get("delta", ""))
                        elif event.get("type") == "done":
                            # Persist assistant reply
                            full_reply = "".join(collected_text)
                            if full_reply:
                                import asyncio
                                asyncio.create_task(
                                    _persist_message(
                                        current_user.id, session.id, "assistant", full_reply, db
                                    )
                                )
            except Exception:
                pass

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Chat-Session-Id": str(session.id),
        },
    )
