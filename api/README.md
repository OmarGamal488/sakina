# Sakina API

FastAPI orchestrator that hosts the production chat endpoint. Currently a
placeholder — the code lands here in the next milestone.

## Planned layout

```
api/
├── pyproject.toml
├── requirements.txt
├── .env.example
├── app/
│   ├── main.py              # FastAPI app + SSE /chat endpoint
│   ├── orchestrator.py      # Emotion × Intent strategy matrix
│   ├── safety.py            # Crisis regex + escalation protocol
│   ├── rag/
│   │   ├── hybrid.py        # BM25 + dense + RRF fusion
│   │   ├── rerank.py        # Cross-encoder reranker
│   │   └── qdrant_client.py
│   ├── models/
│   │   ├── language_id.py
│   │   ├── emotion.py
│   │   └── intent.py
│   ├── memory.py            # Redis semantic cache + sliding window
│   └── llm.py               # Lightning AI client wrapper (OpenAI-compatible)
├── tests/
└── Dockerfile
```

## Endpoints (planned)

- `POST /chat`          — main streaming chat (SSE)
- `GET  /healthz`       — liveness
- `GET  /readyz`        — readiness (checks Qdrant, Redis, Lightning AI)
- `POST /feedback`      — store user feedback for offline eval
- `GET  /memory/{user}` — fetch sliding-window history

## Local run (planned)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill LIGHTNING_API_KEY, QDRANT_URL, REDIS_URL
uvicorn app.main:app --reload --port 8001
```
