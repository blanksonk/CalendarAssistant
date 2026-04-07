"""Unit tests for server/services/embeddings.py."""
import math
from unittest.mock import MagicMock, patch

import pytest

from server.services.embeddings import (
    cosine_similarity,
    embed_query,
    embed_texts,
    retrieve_relevant,
)

ZERO_VEC_512 = [0.0] * 512


def _make_voyage_result(embeddings: list[list[float]]):
    result = MagicMock()
    result.embeddings = embeddings
    return result


# ---------------------------------------------------------------------------
# cosine_similarity
# ---------------------------------------------------------------------------


class TestCosineSimilarity:
    def test_identical_vectors_return_one(self):
        v = [1.0, 0.0, 0.0]
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors_return_zero(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors_return_minus_one(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_zero_vector_returns_zero(self):
        assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0

    def test_symmetric(self):
        a = [1.0, 2.0, 3.0]
        b = [4.0, 5.0, 6.0]
        assert cosine_similarity(a, b) == pytest.approx(cosine_similarity(b, a))


# ---------------------------------------------------------------------------
# embed_texts
# ---------------------------------------------------------------------------


class TestEmbedTexts:
    def test_empty_list_returns_empty(self):
        result = embed_texts([])
        assert result == []

    def test_calls_voyage_with_document_input_type(self):
        fake_result = _make_voyage_result([ZERO_VEC_512])
        with patch("server.services.embeddings._client") as mock_client_fn:
            mock_client = MagicMock()
            mock_client_fn.return_value = mock_client
            mock_client.embed.return_value = fake_result

            result = embed_texts(["Hello world"])

        mock_client.embed.assert_called_once_with(
            ["Hello world"], model="voyage-3-lite", input_type="document"
        )
        assert result == [ZERO_VEC_512]

    def test_returns_one_embedding_per_text(self):
        texts = ["first", "second", "third"]
        embeddings = [ZERO_VEC_512] * 3
        fake_result = _make_voyage_result(embeddings)

        with patch("server.services.embeddings._client") as mock_client_fn:
            mock_client = MagicMock()
            mock_client_fn.return_value = mock_client
            mock_client.embed.return_value = fake_result

            result = embed_texts(texts)

        assert len(result) == 3


# ---------------------------------------------------------------------------
# embed_query
# ---------------------------------------------------------------------------


class TestEmbedQuery:
    def test_calls_voyage_with_query_input_type(self):
        fake_result = _make_voyage_result([ZERO_VEC_512])
        with patch("server.services.embeddings._client") as mock_client_fn:
            mock_client = MagicMock()
            mock_client_fn.return_value = mock_client
            mock_client.embed.return_value = fake_result

            result = embed_query("What meetings do I have?")

        mock_client.embed.assert_called_once_with(
            ["What meetings do I have?"], model="voyage-3-lite", input_type="query"
        )
        assert result == ZERO_VEC_512


# ---------------------------------------------------------------------------
# retrieve_relevant
# ---------------------------------------------------------------------------


class TestRetrieveRelevant:
    def _candidates(self):
        return [
            {"id": "a", "content": "alpha", "embedding": [1.0, 0.0, 0.0]},
            {"id": "b", "content": "beta",  "embedding": [0.0, 1.0, 0.0]},
            {"id": "c", "content": "gamma", "embedding": [0.5, 0.5, 0.0]},
        ]

    def test_returns_top_k(self):
        query_emb = [1.0, 0.0, 0.0]
        result = retrieve_relevant(query_emb, self._candidates(), top_k=2)
        assert len(result) == 2

    def test_most_similar_first(self):
        query_emb = [1.0, 0.0, 0.0]
        result = retrieve_relevant(query_emb, self._candidates(), top_k=3)
        # Candidate "a" is identical to query → should be first
        assert result[0]["id"] == "a"

    def test_empty_candidates_returns_empty(self):
        result = retrieve_relevant([1.0, 0.0], [], top_k=3)
        assert result == []

    def test_candidates_without_embedding_skipped(self):
        candidates = [
            {"id": "a", "content": "alpha", "embedding": [1.0, 0.0]},
            {"id": "b", "content": "beta"},  # no embedding
        ]
        result = retrieve_relevant([1.0, 0.0], candidates, top_k=5)
        ids = [c["id"] for c in result]
        assert "b" not in ids

    def test_json_encoded_embedding_parsed(self):
        import json
        candidates = [
            {"id": "a", "embedding": json.dumps([1.0, 0.0, 0.0])},
        ]
        result = retrieve_relevant([1.0, 0.0, 0.0], candidates, top_k=1)
        assert result[0]["id"] == "a"
