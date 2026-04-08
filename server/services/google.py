"""Google OAuth2 client factory and token helpers."""
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.fernet import Fernet
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from server.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/contacts.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

_fernet = Fernet(settings.encryption_key.encode())


def encrypt_token(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()


def build_flow(state: Optional[str] = None) -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
        state=state,
    )
    return flow


def credentials_from_tokens(
    access_token: str,
    refresh_token: str,
    expires_at: datetime,
) -> Credentials:
    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        expiry=expires_at.replace(tzinfo=None),  # google-auth expects naive UTC
    )


def calendar_client(creds: Credentials):
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def gmail_client(creds: Credentials):
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def people_client(creds: Credentials):
    return build("people", "v1", credentials=creds, cache_discovery=False)
