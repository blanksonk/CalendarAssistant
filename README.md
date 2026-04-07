# CalendarAssistant

A web interface that connects to your Google account and lets you view your calendar alongside an AI agent you can talk to. Ask it to schedule meetings, draft scheduling emails, or tell you how you're spending your time.

---

## Architecture + Design

This section documents the full system design — every tool and service, why it was chosen, and how the pieces connect.

---

### System Overview

```
Browser (React + Vite)
        │  HTTP REST + Server-Sent Events (SSE)
        ▼
FastAPI (Python)
  ├── Auth routes        → Google OAuth 2.0 flow
  ├── Calendar routes    → Google Calendar API
  ├── Chat route         → Claude agent loop (SSE stream)
  ├── Insights route     → On-demand metrics computation
  ├── MCP module (in-memory)
  │     ├── list_events()
  │     ├── get_free_slots()
  │     ├── propose_event()       → ghost event via SSE to frontend
  │     ├── create_gmail_draft()
  │     ├── compute_insights()
  │     ├── generate_weekly_focus()
  │     └── switch_tab()          → tab navigation via SSE to frontend
  └── Session middleware → cookie → sessions table → user_id
        │
        ▼
PostgreSQL + pgvector
        │
        ▼
External: Google Calendar API, Gmail API, Anthropic API, Voyage AI
```

---

### Frontend

**React + TypeScript + Vite**

React is the UI library. Vite is the build tool that bundles it — it replaces the now-deprecated Create React App and is significantly faster for development (near-instant hot module replacement). TypeScript adds static typing to catch errors before runtime.

**Layout**: Side-by-side. Calendar/Insights panel takes ~60% of the viewport on the left; the chat panel is always visible on the right regardless of which tab is active.

**Calendar has three view tabs:**
- **Week** (default) — hourly grid, Mon–Fri
- **Month** — full month, events as horizontal bars per day
- **Radial** — D3 zoomable sunburst for the current week. Days are primary segments, hours are rings. Meetings render as colored arcs. Clicking a day segment zooms in to show that day's hourly breakdown in full detail.

**Ghost events (agent-proposed meetings) appear across all three views simultaneously** from a single Zustand store — the user can confirm a pending event from whichever view they're on:
- Week: dashed-border semi-transparent block
- Month: semi-transparent horizontal line (consistent with real event bar style)
- Radial: semi-transparent pulsing arc

**UI enhancements:**
- **Proactive greeting on load** — agent opens with a contextual morning briefing from the day's events
- **Contextual loading states** — each tool call narrates what the agent is doing ("Scanning your calendar Apr 7–14...") rather than showing a generic spinner
- **Auto color-coded events** — type detected from attendee count/title: 1:1 = blue, standup = purple, external = orange, large group = red
- **Attendee avatars** — Google profile photos shown on each event block
- **Command palette (⌘K)** — floating quick-action bar with scheduling shortcuts that submit directly to chat

**State management**:
- [TanStack Query](https://tanstack.com/query) — server state (calendar events, insights). Handles caching, background refetch, and cache invalidation when the agent creates an event.
- [Zustand](https://zustand-demo.pmnd.rs/) — client state (chat messages, pending ghost events). SSE stream updates need to happen outside React's render cycle; Zustand handles this cleanly.

**Pending events** (agent-proposed meetings) live exclusively in frontend state — not persisted to the database. They appear as ghost blocks on the calendar. If the user tries to refresh or close the tab with pending events outstanding, a `beforeunload` browser warning fires. On confirmation via the modal, the event is created in Google Calendar and the ghost is replaced with a real event.

---

### Backend

**FastAPI (Python)**

Chosen over Flask (sync-first, streaming is awkward) and Django (too heavy for an API-only backend with no templating needs). FastAPI is async-native, which is essential for streaming Claude responses to the browser via Server-Sent Events without blocking other requests.

**Streaming**: The `/api/chat` endpoint returns `text/event-stream`. Claude's response is streamed token-by-token to the frontend. Special SSE event types carry structured payloads:

| Event type | What it does |
|---|---|
| `text` | Appends a token to the current assistant message |
| `tool_start` | Shows an inline spinner with the tool name |
| `tool_result` | Marks the spinner complete, shows result summary |
| `propose_event` | Pushes a ghost event into the frontend calendar state |
| `switch_tab` | Navigates the frontend to "calendar" or "insights" |
| `done` | Ends the stream, triggers calendar data refetch |

---

### AI Agent

**Model: `claude-sonnet-4-6` (Anthropic)**

A single model is used for all requests in v1. A tiered approach (routing simple queries to `claude-haiku-4-5` for ~4x cost savings) is designed and documented but deferred to v2 — the routing logic is isolated enough to add later without architectural changes.

**MCP Server (in-memory) + Claude `tool_use` API**

Tools are defined using the [Model Context Protocol](https://modelcontextprotocol.io/) as a Python module running inside the FastAPI process. Claude is called with the official `tools` parameter — it returns `tool_use` content blocks, the backend dispatches each block to the corresponding MCP handler, and `tool_result` blocks are returned to Claude to continue the loop. The in-memory MCP module is purely the handler layer — the wire protocol is Claude's native `tool_use` API throughout.

This was chosen over:
- *Separate stdio process*: stdio is 1:1 and breaks in multi-instance deployments
- *Separate HTTP service*: two services to deploy and manage — overkill at this stage
- *Inline tool definitions*: no MCP structure means tool logic is scattered across the codebase

Running MCP in-memory gives the tool structure and discoverability of MCP without adding infrastructure. It can be extracted into a standalone HTTP service later if independent scaling is needed.

**Auth injection (Option 4)**: The MCP server is stateless and auth-agnostic. The FastAPI backend injects the current user's Google OAuth tokens into each tool call before routing it to the MCP module. The MCP server never holds tokens — auth logic stays in the backend where the session context already lives.

**Agent tools**:

| Tool | What it does |
|---|---|
| `list_events(start, end)` | Fetches full event details for a date range |
| `get_free_slots(date, duration_mins, num_suggestions)` | Finds open windows via Google's freebusy API |
| `propose_event(title, start, end, attendees, description)` | Creates a ghost event in frontend state via SSE |
| `create_gmail_draft(to, subject, body)` | Saves a Gmail draft, returns the Gmail URL |
| `compute_insights(week)` | Runs server-side metrics computation, returns structured stats |
| `generate_weekly_focus(week)` | Claude synthesizes a narrative from event titles/descriptions |
| `switch_tab(tab)` | Sends a tab-navigation SSE event to the frontend |

---

### Google Integration

**OAuth 2.0 scopes**:
- `calendar.events` — read and create calendar events
- `calendar.readonly` — list calendars
- `gmail.compose` — create drafts only (no read access)
- `userinfo.email`, `userinfo.profile` — user identity

Gmail read access was explicitly excluded. The Insights tab shows only meeting data derived from calendar events — not email analytics. This keeps the OAuth consent screen minimal and the permission footprint small.

**Token handling**: Google access tokens expire after 1 hour. The `google-auth` Python library detects expiry and automatically refreshes using the stored refresh token. After a refresh, the new access token is written back to the `oauth_tokens` table. Tokens are never sent to the browser.

**Token encryption at rest**: OAuth access and refresh tokens are encrypted before being written to the database using Fernet symmetric encryption (Python `cryptography` library). The encryption key is stored as an environment variable (`ENCRYPTION_KEY`). The backend decrypts tokens after reading from the DB and before passing them to the Google API client. Plaintext tokens never touch the database. If the database is compromised, tokens are unreadable without the key.

---

### Database

**PostgreSQL + pgvector**

PostgreSQL was chosen over Supabase (which bundles auth + Postgres) because Supabase's auth system would be redundant — this app implements Google OAuth directly to get Calendar and Gmail scopes that Supabase's auth can't provide. Plain Postgres on Railway keeps it simple with no redundant auth layer.

The `pgvector` extension adds vector similarity search to PostgreSQL — no separate vector database service (Pinecone, Weaviate, etc.) needed. Since we're already on Postgres, pgvector is just an `ALTER TABLE ... ADD COLUMN embedding vector(512)` and an index.

**Schema**:

```
users          — Google profile (id, google_id, email, name, picture)
sessions       — Server-side session store (session UUID → user_id)
oauth_tokens   — Google tokens per user (access, refresh, expiry)
chat_sessions  — Groups of messages, with optional compressed summary
chat_messages  — Individual messages + 512-dim Voyage AI embeddings
weekly_focus   — Cached AI narratives keyed by (user_id, week_start)
tool_calls     — Observability log (tool name, input, output, duration, status)
```

**Rate limiting**: Applied via `slowapi` (FastAPI-native). Limits are per authenticated user except on auth routes where they are per IP.

| Endpoint | Limit | Reason |
|---|---|---|
| `POST /api/chat` | 10 req/min | Calls Claude — most expensive endpoint |
| `GET /api/calendar/*` | 30 req/min | Google API quota protection |
| `GET /api/insights/*` | 20 req/min | May trigger Claude for Weekly Focus |
| `POST /api/auth/*` | 5 req/min per IP | Brute force protection |

**Session management**: Server-side sessions in PostgreSQL. The browser holds a random UUID cookie (HttpOnly, Secure, SameSite=Lax). Every request validates the UUID against the `sessions` table to get the `user_id`. Logout deletes the row — the token is immediately invalid, with no grace period. Signed cookies (the simpler alternative) were rejected because they can't be server-side invalidated on logout without a blocklist.

---

### Embeddings & RAG

**Voyage AI `voyage-3-lite`**

Voyage AI is Anthropic's recommended embedding partner — embeddings are optimized to complement Claude's context representations, meaning retrieved content maps cleanly to how Claude reasons. At $0.02/1M tokens and 512 dimensions, it's both cheap and fast for pgvector cosine similarity search.

Alternatives considered:
- *OpenAI `text-embedding-3-small`*: similar price, 1536 dimensions (slower pgvector queries), introduces OpenAI as a third provider
- *Google `text-embedding-004`*: free tier is generous but a separate Gemini API credential from the Calendar/Gmail OAuth
- *sentence-transformers (local)*: free but adds compute load and ~90MB model file to deployment

**RAG flow — hybrid embedding strategy**: Embeddings are not generated per message. Instead:

- **During an active session**: only user messages are embedded individually (not assistant responses). This halves embedding volume and focuses retrieval on user intent — what the user said and asked — rather than what the agent replied.
- **After compression**: when a session is summarized, one embedding is generated for the summary and the per-message embeddings are discarded. RAG searches over summary embeddings for older sessions and individual user message embeddings for recent ones.

On each new user message, the query is embedded and compared via cosine similarity against both layers. The top 5 results are injected into Claude's context, giving the agent memory of user preferences across sessions — e.g., "you mentioned you want to keep mornings free."

**Chat history compression**: When a chat session is idle for 24 hours or exceeds 50 messages, a background job calls Claude to summarize it. The summary is stored in `chat_sessions.summary`. Raw messages are **soft-deleted** — an `archived_at` timestamp is set rather than the rows being deleted. This preserves the data permanently while keeping active queries fast (`WHERE archived_at IS NULL`). Active sessions send the last 20 unarchived messages plus any existing summary as context.

---

### Insights

**Computed on demand — not stored**

All meeting metrics (focus time, back-to-back count, meeting quality ratios, etc.) are computed in Python at request time from Google Calendar API data. They're not cached or stored because:
- Calendar data lives in Google — syncing it would add complexity and create staleness risk
- The computation is fast: pure math on at most ~100 events per week
- Results are always fresh: if a user adds or modifies an event, metrics reflect it immediately

The one exception is the **Weekly Focus narrative** — a 2–3 sentence AI-generated summary of what the user focused on that week. Regenerating it on every tab visit would be wasteful, so it's cached in the `weekly_focus` table keyed by `(user_id, week_start)`. The cache is always queried with the `user_id` from the validated server-side session, making cross-user contamination impossible. A missing or stale cache entry is silently regenerated — it's derived content, not source of truth.

---

### Deployment

**Railway**

Single service: FastAPI serves both the API and the built React static files (`client/dist/`) in production. Railway's managed PostgreSQL add-on supports the pgvector extension. Deploys automatically on push to `main`.

Railway was chosen over:
- *Render*: free tier has cold starts (spin-down on inactivity) which breaks streaming
- *DigitalOcean App Platform*: more control but more manual configuration
- *AWS/GCP*: correct at scale, significant DevOps overhead for v1

Local dev: React dev server on `:5173` (Vite), FastAPI on `:8000`, local Postgres instance.

---

### Environment Variables

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
DATABASE_URL=postgresql+asyncpg://...
SESSION_SECRET=                        # openssl rand -hex 32
ENCRYPTION_KEY=                        # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
CORS_ORIGIN=http://localhost:5173
```

---

### Google Cloud Console Setup

1. Create a project and enable: **Google Calendar API**, **Gmail API**, **Google People API**
2. OAuth Consent Screen → External → add scopes:
   `calendar.events`, `calendar.readonly`, `gmail.compose`, `userinfo.email`, `userinfo.profile`
   → Add your Gmail account as a test user
3. Credentials → OAuth 2.0 Client ID → Web application
   - Dev redirect URI: `http://localhost:8000/api/auth/google/callback`
   - Prod redirect URI: `https://your-app.railway.app/api/auth/google/callback`
4. Copy **Client ID** and **Client Secret** into your `.env`
