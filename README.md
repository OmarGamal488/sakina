# Sakina

> Bilingual (Arabic + English) emotion-aware mental-health support chatbot
> with retrieval-augmented generation, a crisis-safety protocol, and an
> adaptive avatar that reacts to the user's detected emotion.
>
> ITI AI Track — NLP Final Project, Intake 46.

---

## What's in this repo

```
sakina/
├── demo/         Browser-only React preview (no build step — open index.html)
├── docs/         Project brief, pipeline document, and design prompts
├── frontend/     [planned] Production React + Vite + Vercel AI SDK app
├── api/          [planned] FastAPI orchestrator + RAG + crisis safety
└── notebooks/    [planned] Four module notebooks per the assignment brief
```

Only `demo/` and `docs/` have code today. The other folders are scaffolded
placeholders so the planned structure is clear to anyone who clones this.

---

## Run the demo (no build required)

The demo is a no-build React app that uses CDN React + Babel-standalone for
in-browser JSX compilation. To run it:

```bash
cd demo
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

What you'll see:
- **`index.html`** — the main chat shell with EN/AR split-pane preview,
  emotion controls in a tweaks panel, and the male avatar reacting to
  emotion changes via ring color, facial expression, and motion.
- **`avatar-demo.html`** — standalone avatar component playground.

The avatar emotion set is aligned 1:1 with the
[DAIR emotion dataset](https://huggingface.co/datasets/dair-ai/emotion):
`sadness · joy · love · anger · fear · surprise`. Same character (seed
`sakina`, DiceBear `micah` style, male, clean-shaven, sage shirt). Only
the ring color and facial expression change with the detected emotion.

> The demo is for design iteration only. The production build will live in
> `frontend/` and use Vite + Vercel AI SDK + a real FastAPI backend.

---

## Planned architecture (see `docs/`)

- **Language detection** — TF-IDF + Logistic Regression with a `lingua-py`
  fallback for short inputs.
- **Emotion classifier** — XLM-RoBERTa fine-tuned on DAIR,
  six classes: `sadness · joy · love · anger · fear · surprise`.
- **Intent classifier** — Few-shot via Groq (`gpt-oss-120b` or `gpt-oss-20b`).
- **RAG** — BM25 + dense (MiniLM) hybrid with RRF fusion, cross-encoder
  rerank, served from Qdrant Cloud.
- **Orchestrator** — Emotion × Intent matrix selecting one of 30 response
  strategies, with a crisis-override regex that bypasses retrieval.
- **Safety** — Three-level crisis escalation with a human-confirmation gate
  before any hotline dial action.
- **Frontend** — React 18 + Tailwind + Framer Motion + Vercel AI SDK
  (`useChat`, `streamUI`) consuming a FastAPI SSE stream.
- **Avatar** — Generated client-side from DiceBear `micah` (seed `sakina`,
  male, clean-shaven, sage shirt locked). Ring color shifts with detected
  emotion. SVGs are also pre-rendered in `demo/assets/avatars/` for
  offline preview.

For full detail, read **`docs/brief.pdf`** (the assignment) and
**`docs/pipeline_v2.0_backup.pdf`** (the architecture document).

---

## Setting up a development environment

> The production code is not in this repo yet. The steps below describe how
> the `frontend/` and `api/` will be initialized.

### Frontend (planned)
```bash
cd frontend
npm install
npm run dev          # Vite dev server on :5173
```
Stack: React 18, TypeScript, Vite, Tailwind, Framer Motion, Vercel AI SDK
(`ai`, `@ai-sdk/react`, `@ai-sdk/groq`), DiceBear `@dicebear/core` +
`@dicebear/collection`, shadcn/ui, Recharts.

### API (planned)
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
Stack: Python 3.11, FastAPI, Qdrant client, sentence-transformers,
transformers, groq, redis, pydantic v2.

### Notebooks (planned)
```bash
cd notebooks
jupyter lab
```
One notebook per module: `01_language_detection.ipynb`,
`02_emotion.ipynb`, `03_intent.ipynb`, `04_rag.ipynb`. Each ends by
exporting a model artifact consumed by the API.

---

## Design assets

See **`docs/design/`** for the design prompts used to generate the
React + Tailwind components via claude.ai Artifacts. The avatar prompt
specifies the male `micah` character, the six emotion overrides, the
ring-color system, and the breathing/tremor motion model.

The pre-rendered avatar SVGs in `demo/assets/avatars/` were generated
via the public DiceBear v9 HTTP API
(`https://api.dicebear.com/9.x/micah/svg?seed=sakina&...`). To regenerate
or tweak, see the design prompt — no API key required, no signup.

---

## License

MIT — see `LICENSE`.

Avatar artwork is generated via DiceBear's `micah` style by Micah Lanier,
licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

---

## Credits

Built as the final project for the ITI AI Track NLP module, Intake 46.
Pipeline architecture, safety protocol, and frontend design by
Omar Gamal ElKady.
