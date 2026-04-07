"""Voyage AI embedding service + cosine similarity RAG retrieval."""
from __future__ import annotations

import math
from typing import Any

import voyageai

from server.config import settings

MODEL = "voyage-3-lite"
DIMENSIONS = 512


def _client() -> voyageai.Client:
    return voyageai.Client(api_key=settings.voyage_api_key)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of texts using Voyage AI.
    Returns a list of float vectors, one per text.
    """
    if not texts:
        return []
    client = _client()
    result = client.embed(texts, model=MODEL, input_type="document")
    return result.embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string (uses 'query' input_type for retrieval)."""
    client = _client()
    result = client.embed([query], model=MODEL, input_type="query")
    return result.embeddings[0]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def retrieve_relevant(
    query_embedding: list[float],
    candidates: list[dict[str, Any]],
    embedding_key: str = "embedding",
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Given a query embedding and a list of candidate dicts each with an embedding,
    return the top_k most similar candidates sorted by cosine similarity descending.

    candidates: list of dicts, each must have embedding_key containing a list[float]
    """
    if not candidates:
        return []

    scored = []
    for candidate in candidates:
        emb = candidate.get(embedding_key)
        if not emb:
            continue
        if isinstance(emb, str):
            # Parse comma-separated or JSON-encoded embedding stored as text
            try:
                import json
                emb = json.loads(emb)
            except Exception:
                emb = [float(x) for x in emb.split(",")]
        score = cosine_similarity(query_embedding, emb)
        scored.append((score, candidate))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]
