"""RAG retriever for Sakina — hybrid BM25 + bge-m3 dense → RRF → bge-reranker → top-k.

Loads ``bm25_index.pkl`` (NB04), connects to the Qdrant cloud collection, and loads
``BAAI/bge-m3`` (dense embedding) + ``BAAI/bge-reranker-v2-m3`` (cross-encoder).
Retrieval runs on the ENGLISH query (corpus is English counselor responses; emotion
module already translates non-English input).
"""

from __future__ import annotations

import pickle
import re
from collections import defaultdict
from dataclasses import dataclass

import structlog

from app.config import ARTIFACTS_DIR, settings

logger = structlog.get_logger(__name__)

RRF_K = 60
TOP_K_PER_RETRIEVER = 10
TOP_K_RERANKED = 3
EMBED_MODEL = "BAAI/bge-m3"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


@dataclass(frozen=True)
class Passage:
    """A retrieved counseling passage."""

    text: str
    context: str
    score: float

    def as_dict(self) -> dict:
        return {"text": self.text, "context": self.context, "score": self.score}


class RAGRetriever:
    """Hybrid retriever: BM25 + dense (bge-m3) fused with RRF, reranked by bge-reranker."""

    def __init__(self) -> None:
        bm = pickle.loads((ARTIFACTS_DIR / "bm25_index.pkl").read_bytes())
        self._bm25 = bm["bm25"]
        self._texts: list[str] = bm["chunk_texts"]
        self._contexts: list[str] = bm["chunk_contexts"]

        from qdrant_client import QdrantClient
        from sentence_transformers import CrossEncoder, SentenceTransformer

        logger.info("rag_loading", embed=EMBED_MODEL, reranker=RERANKER_MODEL, use_reranker=settings.use_reranker)
        self._embedder = SentenceTransformer(
            EMBED_MODEL,
            device="cpu",
            cache_folder=str(settings.sentence_transformers_cache_dir),
            model_kwargs={"low_cpu_mem_usage": True},
        )
        self._reranker = None
        if settings.use_reranker:
            self._reranker = CrossEncoder(
                RERANKER_MODEL,
                device="cpu",
                max_length=512,
                cache_folder=str(settings.sentence_transformers_cache_dir),
                model_kwargs={"low_cpu_mem_usage": True},
            )
        self._qc = QdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=60
        )
        self._collection = settings.qdrant_collection
        logger.info("rag_loaded", n_chunks=len(self._texts))

    # ------------------------------------------------------------------
    def _tok(self, text: str) -> list[str]:
        return _TOKEN_RE.findall(text.lower())

    def _bm25_topk(self, query: str, k: int = TOP_K_PER_RETRIEVER):
        import numpy as np

        scores = self._bm25.get_scores(self._tok(query))
        top = np.argsort(scores)[::-1][:k]
        return [(int(i), float(scores[i])) for i in top if scores[i] > 0]

    def _dense_topk(self, query: str, k: int = TOP_K_PER_RETRIEVER):
        emb = self._embedder.encode(query, normalize_embeddings=True, convert_to_numpy=True)
        hits = self._qc.query_points(
            collection_name=self._collection, query=emb.tolist(), limit=k, with_payload=False
        ).points
        return [(int(h.id), float(h.score)) for h in hits]

    def _rrf(self, ranked_lists, k: int = RRF_K):
        scores: dict[int, float] = defaultdict(float)
        for ranked in ranked_lists:
            for rank, (doc_id, _) in enumerate(ranked, start=1):
                scores[doc_id] += 1.0 / (k + rank)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)

    def retrieve(self, query: str, k: int = TOP_K_RERANKED) -> list[Passage]:
        """Full hybrid pipeline → top-*k* reranked passages (empty list if nothing hits)."""
        import numpy as np

        fused = self._rrf([self._bm25_topk(query), self._dense_topk(query)])
        ids = [doc_id for doc_id, _ in fused[:TOP_K_PER_RETRIEVER]]
        if not ids:
            return []
        if not settings.use_reranker:
            return [
                Passage(text=self._texts[doc_id], context=self._contexts[doc_id], score=rrf_score)
                for doc_id, rrf_score in fused[:k]
            ]
        scores = self._reranker.predict([(query, self._texts[i]) for i in ids])
        order = np.argsort(scores)[::-1][:k]
        return [
            Passage(
                text=self._texts[ids[i]], context=self._contexts[ids[i]], score=float(scores[i])
            )
            for i in order
        ]


_instance: RAGRetriever | None = None


def get_retriever() -> RAGRetriever:
    """Module-level lazy singleton.  Loads ~4.6 GB (bge-m3 + reranker) on first call."""
    global _instance
    if _instance is None:
        _instance = RAGRetriever()
    return _instance


if __name__ == "__main__":
    r = get_retriever()
    for p in r.retrieve("I can't sleep because I keep worrying about everything"):
        print(f"[{p.score:.3f}] {p.text[:120]}...")
