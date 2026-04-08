"""Google People API service — contact search for resolving names to email addresses."""
from __future__ import annotations

from typing import Any

from google.oauth2.credentials import Credentials

from server.services.google import people_client


def search_contacts(creds: Credentials, query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """
    Search the user's contacts and directory for a name or email fragment.
    Returns a list of {name, email} dicts ordered by relevance.
    """
    service = people_client(creds)
    results: list[dict[str, Any]] = []

    # Search contacts (personal contacts + "other contacts")
    try:
        resp = (
            service.people()
            .searchContacts(
                query=query,
                readMask="names,emailAddresses",
                pageSize=max_results,
            )
            .execute()
        )
        for result in resp.get("results", []):
            person = result.get("person", {})
            name = _primary(person.get("names", []), "displayName")
            email = _primary(person.get("emailAddresses", []), "value")
            if email:
                results.append({"name": name or email, "email": email})
    except Exception:
        pass

    # Also search the directory (Google Workspace users)
    if len(results) < max_results:
        try:
            resp = (
                service.people()
                .searchDirectoryPeople(
                    query=query,
                    readMask="names,emailAddresses",
                    sources=["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"],
                    pageSize=max_results - len(results),
                )
                .execute()
            )
            for person in resp.get("people", []):
                name = _primary(person.get("names", []), "displayName")
                email = _primary(person.get("emailAddresses", []), "value")
                if email and not any(r["email"] == email for r in results):
                    results.append({"name": name or email, "email": email})
        except Exception:
            pass

    return results[:max_results]


def _primary(items: list[dict], field: str) -> str:
    """Return the value of `field` from the first item marked primary, or the first item."""
    for item in items:
        if item.get("metadata", {}).get("primary"):
            return item.get(field, "")
    return items[0].get(field, "") if items else ""
