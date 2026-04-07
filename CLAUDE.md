# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CalendarAssistant is a web app where users authenticate with Google, view their calendar, and chat with an AI agent to schedule meetings, draft emails, and analyze meeting patterns.

- **Frontend**: React + TypeScript + Vite (`client/`)
- **Backend**: FastAPI + Python (`server/`)
- **Database**: PostgreSQL + pgvector
- **AI**: Claude claude-sonnet-4-6 + Voyage AI embeddings
- **Deployment**: Railway

See `README.md` for the full architecture and design decisions. See `docs/PLANNING.md` for the granular implementation plan.

## Dev Commands

```bash
# Activate Python virtualenv (required before backend commands)
source server/.venv/bin/activate

# Run both frontend and backend together
npm run dev

# Frontend tests (Vitest, watch mode)
cd client && npx vitest

# Run a single frontend test file
cd client && npx vitest src/components/calendar/WeekGrid.test.tsx

# Frontend integration tests (Playwright, requires dev server running)
cd client && npx playwright test

# Backend tests (from repo root, with venv active)
PYTHONPATH=. pytest server/tests/

# Run a single backend test file
PYTHONPATH=. pytest server/tests/unit/test_calendar.py -v
```

> **Python**: Uses Python 3.14 + venv at `server/.venv/`. `voyageai` pinned to 0.2.4 (latest version compatible with Python 3.14).

## Testing

### Frontend (Vitest + React Testing Library + Playwright)
- Unit tests live alongside components: `ComponentName.test.tsx`
- Integration tests live in `client/tests/`
- Mock external API calls — never hit real Google or Anthropic APIs in tests
- No responsive/viewport tests

### Backend (pytest + pytest-asyncio + httpx)
- Unit tests live in `server/tests/unit/`
- Integration tests live in `server/tests/integration/`
- Tests never write to or spin up any real database — the SQLAlchemy async session is mocked like any other dependency
- Mock all external APIs and the DB layer using `pytest-mock`
- Session middleware: use the test helper in `server/tests/conftest.py` to inject a mock session directly

### Mocking conventions
| Dependency | How to mock |
|---|---|
| SQLAlchemy async session | `AsyncMock` returning fixture data — no real DB connection |
| Google Calendar API | Fixture JSON in `server/tests/fixtures/calendar/` |
| Anthropic API | Streaming chunk fixtures in `server/tests/fixtures/claude/` |
| Voyage AI | Return zero-vectors — shape matters, values don't |
| Gmail API | Fixture responses in `server/tests/fixtures/gmail/` |

## Commit Convention

**Commit at the completion of each implementation step.** A step is complete when the component or service is written AND its unit tests pass.

Commit message format:
```
feat(step-Na): brief description
```

Examples:
```
feat(step-2): project scaffold
feat(step-4a): Google OAuth routes + session middleware
feat(step-5d): WeekGrid component + unit tests
feat(step-6d): Claude streaming agent loop + unit tests
```

Rules:
- One commit per step — do not batch multiple steps
- Do not commit partial work or failing tests
- **Push to `main` immediately after every milestone commit**
- Use the `/commit` skill to execute the commit, then `git push`

## Implementation Steps

The full granular step list is in `docs/PLANNING.md`. Current status:

- ✅ Step 1: Documentation (README, PLANNING.md, .gitignore)
- ✅ Step 2: Project scaffold
- ✅ Step 3a: SQLAlchemy models + unit tests
- ✅ Step 3b: Alembic migrations
- ✅ Step 4a: Google OAuth routes + session middleware
- ✅ Step 4b: LoginPage component + useAuth hook
- ⬜ Step 4c: Auth integration test
- ⬜ Step 5a–5g: Calendar
- ⬜ Step 6a–6i: Chat + Agent
- ⬜ Step 7a–7c: Pending events
- ⬜ Step 8a–8i: Insights
- ⬜ Step 9a–9b: AppShell + E2E

Update the checkboxes above as steps are completed.
