# Sakina — Agent Build Brief

> You are a Claude Code agent picking up this project mid-stream from another
> agent. Read this entire file before taking any action. Then build out the
> system per the **Mission** section. The previous agent already organized
> the repo and finalized the design language and avatar system. Your job is
> to ship the working ML pipeline, API, and production frontend.

---

## Hard rules (do not violate)

1. **DO NOT push to GitHub.** The repo owner pushes themselves. You may
   `git add` and `git commit` locally only if explicitly asked.
2. **DO NOT modify `demo/`.** The contents are a working browser-only React
   preview that the owner uses for design reference. You may read from it.
   Port concepts into `frontend/`, do not edit `demo/` files.
3. **DO NOT commit secrets.** Never hardcode API keys. Use `.env.example`
   as the template and read real keys from `.env` at runtime.
4. **DO NOT downgrade or remove dependencies** the owner has set in any
   existing `package.json` / `requirements.txt`. Add, don't replace.
5. **DO NOT install packages globally** (`pip install --user`, `npm install -g`).
   Always use a project-local venv / `node_modules`.
6. **DO NOT change the avatar art direction.** The 6-emotion DAIR-aligned
   avatar set is final: male character, DiceBear `micah` style, seed
   `sakina`, sage shirt, clean-shaven. SVGs already live in
   `demo/assets/avatars/`. Copy them into `frontend/public/avatars/` —
   do not regenerate.
7. **Verify before destructive action.** If a path or file unexpectedly
   exists, investigate before deleting. The repo owner may have placed
   in-progress work.

---

## Mission

Implement the production system in three areas of the repo that are
currently scaffolded but empty:

| Folder         | What to build                                                  |
|----------------|----------------------------------------------------------------|
| `notebooks/`   | Four training/eval notebooks, one per ML module                |
| `api/`         | FastAPI orchestrator with SSE streaming, RAG, and crisis safety|
| `frontend/`    | Vite + React + Vercel AI SDK production app                    |

The owner will integrate everything at the end. You do not need to wire
the three pieces together end-to-end yourself — but each piece must work
standalone and follow the contracts described below.

---

## Project context

Sakina is a **bilingual (Arabic + English) emotion-aware mental-health
support chatbot**. It detects the user's emotion in real time, retrieves
grounded counseling content from a vector store, and streams a response
through an LLM. A crisis-safety regex overrides retrieval and offers a
hotline handoff when the user's text indicates self-harm risk.

Authoritative design documents:

- **`docs/brief.pdf`** — official ITI NLP Final assignment brief. Defines
  required modules, datasets, and deliverables. Read this first.
- **`docs/pipeline_v2.0_backup.pdf`** — full system architecture (24 pages).
  Section numbering used below refers to this document.

The avatar emotion set is locked to the **DAIR labels** — see the next
section. The frontend visual design lives in `demo/` and the `micah` male
avatar SVGs in `demo/assets/avatars/`. Copy these forward; do not redesign.

---

## Datasets

Three Hugging Face datasets drive the ML modules. Pin the revision when
loading so retraining is reproducible.

### 1. Emotion classification — DAIR
- **Link:** https://huggingface.co/datasets/dair-ai/emotion
- **Used by:** `notebooks/02_emotion.ipynb`, `api/app/models/emotion.py`
- **Labels (6, in this order):** `sadness · joy · love · anger · fear · surprise`
- **Use:** Fine-tune `xlm-roberta-base` (multilingual — supports Arabic
  input too). Train/val/test splits are in the dataset already. Export
  to `api/app/models/artifacts/emotion-xlmr/`.
- **Important:** these six labels are the canonical emotion vocabulary
  for the entire system. The frontend `Emotion` type, the API response
  schema, and the avatar SVG filenames all use these six names.

### 2. Counseling knowledge base — Amod
- **Link:** https://huggingface.co/datasets/Amod/mental_health_counseling_conversations
- **Used by:** `notebooks/04_rag.ipynb`, `api/app/rag/*`
- **Use:** Source corpus for the RAG knowledge base. Each row is a
  (Context, Response) pair from a licensed counselor. Chunk responses
  into ~256-token passages, embed with `sentence-transformers/all-MiniLM-L6-v2`
  for dense retrieval, build a BM25 index in parallel, push dense vectors
  to a Qdrant collection named `sakina_counseling`. Hybrid retrieval =
  BM25 + dense fused via Reciprocal Rank Fusion (k=60), then reranked with
  `BAAI/bge-reranker-v2-m3`.
- **License note:** ensure the dataset license permits ingestion into a
  vector store you redistribute or expose via an API. Surface any
  restriction to the owner in the notebook's first markdown cell.

### 3. Language identification — papluca
- **Link:** https://huggingface.co/datasets/papluca/language-identification
- **Used by:** `notebooks/01_language_detection.ipynb`, `api/app/models/language_id.py`
- **Use:** Train a TF-IDF + LogisticRegression classifier (per the brief).
  Restrict the label set to the languages Sakina supports: `en` and `ar`
  (everything else collapses to `other`). Fall back to `lingua-py` when
  the classifier's top-class probability is below 0.6, which handles very
  short inputs better than TF-IDF.

> The brief explicitly warns against over-engineering language detection
> ("avoid overcomplicated approaches you don't fully grasp"). TF-IDF +
> LogReg is the right ceiling. Do not switch to a transformer.

---

## Current state of the repo

```
sakina/
├── README.md                          done
├── LICENSE                            done
├── .gitignore                         done (Claude/AI files excluded)
├── AGENT_BRIEF.md                     this file
│
├── demo/                              DONE — do not modify
│   ├── index.html
│   ├── avatar-demo.html
│   ├── *.jsx (9 files)
│   ├── styles.css, avatar-demo.css
│   └── assets/avatars/                6 DAIR emotion SVGs
│
├── docs/
│   ├── brief.pdf                      assignment brief — READ FIRST
│   ├── pipeline_v2.0_backup.pdf       architecture (24 pages)
│   └── design/                        empty — design prompts removed
│
├── api/        SCAFFOLDED — your job
├── frontend/   SCAFFOLDED — your job
└── notebooks/  SCAFFOLDED — your job
```

`demo/` is a no-build React preview (CDN React + Babel-standalone). It runs
with `python3 -m http.server` inside that folder. Use it as a visual
reference; the production app you build in `frontend/` should match the
look, feel, and component structure.

---

## Build order (recommended)

Tackle in this order. Each phase produces a verifiable artifact.

### Phase 1 — Notebooks (start here)
Build the three training notebooks and one RAG-build notebook. Each
notebook ends by writing an artifact to `api/app/models/artifacts/` or
pushing data to Qdrant. Notebooks are runnable end-to-end without manual
edits.

```
notebooks/
├── 01_language_detection.ipynb        → lang_id.joblib
├── 02_emotion.ipynb                   → emotion-xlmr/ (transformers dir)
├── 03_intent.ipynb                    → intent_few_shot.json (prompt examples)
└── 04_rag.ipynb                       → Qdrant `sakina_counseling` collection
                                          + bm25_index.pkl
```

Intent classification uses **few-shot via Groq** (per the brief), not a
trained classifier. So `03_intent.ipynb` curates and validates the
few-shot example set; it does not train a model.

### Phase 2 — API (`api/`)
Build the FastAPI orchestrator. Endpoints, layout, and the emotion ×
intent strategy matrix are described in `docs/pipeline_v2.0_backup.pdf`
sections §3–§11. Minimum to be considered done:

- `POST /chat` — streaming SSE endpoint with the contract documented in
  `api/README.md`.
- `GET  /healthz` and `GET /readyz`.
- Crisis regex override fires before retrieval and short-circuits the
  pipeline with a deep-mint crisis card payload.
- All three trained artifacts from Phase 1 load on startup.
- LLM calls go through Groq (`gpt-oss-120b`, `gpt-oss-20b` fallback).
- 100% type-hinted, pydantic v2 schemas, structured logging via `structlog`.
- A `Dockerfile` that builds a runnable image without baked-in secrets.

### Phase 3 — Frontend (`frontend/`)
Bootstrap a Vite + React + TypeScript app. Port the JSX components from
`demo/` into typed `.tsx` files under `src/components/`. Wire `useChat`
from `@ai-sdk/react` to your API's `/chat` SSE endpoint. Use the existing
avatar SVGs from `demo/assets/avatars/` (copy to `public/avatars/`).

The frontend's `Emotion` type MUST match the six DAIR labels exactly.
The `EMOTION_COLORS` map and the per-emotion micah facial overrides must
match the values used in `demo/avatar.jsx`.

### Phase 4 — Integration (only if asked)
Stop after Phase 3 and ask the owner whether to wire everything together
locally with docker-compose. They may want to handle integration
themselves.

---

## Required external accounts

These are the only signups Sakina needs. Cite each in the `.env.example`
you produce:

| Service             | Purpose                                | Env var          |
|---------------------|----------------------------------------|------------------|
| **Groq**            | LLM (per brief: gpt-oss-120b/20b)      | `GROQ_API_KEY`   |
| **Qdrant Cloud**    | Vector store for counseling KB         | `QDRANT_URL`, `QDRANT_API_KEY` |
| **Hugging Face**    | Dataset access + model artifacts       | `HF_TOKEN` (optional) |
| **Redis**           | Semantic cache + sliding-window memory | `REDIS_URL` (local docker is fine) |

The owner has accounts on all four already.

---

## Local environment setup (commands you may run)

```bash
# From the repo root.

# --- API (Python 3.11) ---
cd api
python -m venv .venv && source .venv/bin/activate
pip install -U pip
# you will create requirements.txt — minimum: fastapi, uvicorn, pydantic v2,
# sentence-transformers, transformers, torch, qdrant-client, redis, groq,
# scikit-learn, lingua-language-detector, structlog, python-dotenv
pip install -r requirements.txt

# --- Frontend (Node 20+) ---
cd ../frontend
npm install
# package.json minimum: react, react-dom, vite, typescript, tailwindcss,
# postcss, autoprefixer, framer-motion, ai, @ai-sdk/react, @ai-sdk/groq,
# @dicebear/core, @dicebear/collection, recharts, lucide-react, clsx

# --- Notebooks ---
cd ../notebooks
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # jupyterlab, datasets, transformers,
                                  # accelerate, sentence-transformers,
                                  # qdrant-client, rank-bm25, etc.
jupyter lab
```

Do not run training notebooks on CPU for emotion — XLM-RoBERTa fine-tune
needs a GPU. If the host has no GPU, train on a free Colab/Kaggle GPU
and download the artifact into `api/app/models/artifacts/emotion-xlmr/`.

---

## Definition of done

Phase 1 (notebooks):
- All four notebooks run top-to-bottom without manual edits.
- Each writes its artifact to the expected path.
- The emotion notebook reports macro-F1 ≥ 0.90 on the DAIR test split.
- The language-id notebook reports ≥ 0.97 accuracy on en/ar test slices.
- The RAG notebook ends with a sanity-check cell that retrieves top-k
  for a sample query and prints the reranked passages.

Phase 2 (API):
- `pytest -q` passes (you also write the tests).
- `curl -N -X POST localhost:8001/chat -d '{"text":"i am sad"}'` streams
  tokens and includes an `emotion: "sadness"` field in the metadata frame.
- `curl localhost:8001/healthz` returns 200; `/readyz` checks all three
  external services.
- `docker build -t sakina-api .` produces an image under 2 GB.
- Crisis regex test cases trigger the crisis card payload before any
  retrieval call.

Phase 3 (frontend):
- `npm run dev` opens at :5173 with the chat shell rendered.
- `npm run build` produces a `dist/` under 500 KB gzipped.
- The avatar component shows all six DAIR emotions when clicked.
- Type-checks clean (`tsc --noEmit`).
- The chat shell connects to the API at `VITE_API_URL` (default
  `http://localhost:8001`) and streams responses.

---

## When you finish

1. Save all changes locally.
2. Run all definition-of-done checks.
3. Write a short `HANDOFF.md` at the repo root describing what shipped,
   what's pending, and any decisions you had to make that weren't in
   this brief.
4. Stop. Do not push. Wait for the owner.

Good luck. The owner has already done the design and architecture work —
your job is execution. Stay inside the lines of `docs/brief.pdf` and the
six-emotion DAIR vocabulary, and avoid scope creep.
