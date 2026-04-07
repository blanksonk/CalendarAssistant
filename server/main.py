from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from server.config import settings

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="CalendarAssistant API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from server.routes import auth

app.include_router(auth.router, prefix="/api/auth")
from server.routes import calendar

app.include_router(calendar.router, prefix="/api/calendar")
# Remaining routes added as implemented:
# from server.routes import chat, insights
# app.include_router(chat.router, prefix="/api/chat")
# app.include_router(insights.router, prefix="/api/insights")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve built React app in production
client_dist = Path(__file__).parent.parent / "client" / "dist"
if client_dist.exists():
    app.mount("/", StaticFiles(directory=str(client_dist), html=True), name="static")
