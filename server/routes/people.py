"""People search route — contact typeahead."""
from fastapi import APIRouter, Depends, HTTPException, Query

from server.middleware.auth import get_current_user, get_oauth_token
from server.models import OAuthToken, User
from server.services import people as people_service
from server.services.google import credentials_from_tokens, decrypt_token

router = APIRouter()


def _build_creds(token: OAuthToken):
    return credentials_from_tokens(
        access_token=decrypt_token(token.access_token),
        refresh_token=decrypt_token(token.refresh_token),
        expires_at=token.expires_at,
    )


@router.get("/search")
async def search_people(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    token: OAuthToken = Depends(get_oauth_token),
):
    """Search contacts by name or email fragment for typeahead."""
    creds = _build_creds(token)
    try:
        results = people_service.search_contacts(creds, q, max_results=5)
    except ValueError as exc:
        if str(exc) == "contacts_scope_missing":
            raise HTTPException(
                status_code=403,
                detail="contacts_scope_missing",
            )
        raise
    return {"results": results}
