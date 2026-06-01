# Sakina Frontend

Production React client for **Sakina**, the multilingual (20-language) emotion-aware
mental-health support chatbot. It talks to the FastAPI orchestrator (`../api`) over a
custom Server-Sent-Events `/chat` stream and renders an emotion-adaptive chat UI with a
persistent avatar, RTL support, RAG source citations, and a bilingual (detected-language +
English) reveal.

Built — not a placeholder. The read-only design reference lives in [`../demo`](../demo).

## Stack

- **Vite 6 + React 18 + TypeScript** (strict)
- **Tailwind CSS 3** + a small `index.css` carrying the cream-theme design tokens
- **Framer Motion** + **lucide-react** (icons)
- **Custom SSE client** (`src/lib/sse.ts` + `src/lib/sseParser.ts`) — no chat-stream library
- **Vitest** — unit tests for the SSE framing

## Layout

```
frontend/
├── index.html, vite.config.ts, tsconfig.json, tailwind.config.ts, postcss.config.js
├── public/avatars/             # 6 pre-rendered DAIR emotion SVGs (locked — do not regenerate)
└── src/
    ├── main.tsx                # mounts <App/> inside an <ErrorBoundary>
    ├── App.tsx                 # single responsive chat column
    ├── index.css               # cream theme tokens + layout + RTL rules
    ├── vite-env.d.ts
    ├── lib/
    │   ├── types.ts            # SSE event + message types, RTL_LANGS, pickText
    │   ├── emotion.ts          # Emotion type + locked EMOTION_COLORS / labels
    │   ├── sseParser.ts        # pure SSE framing (chunk-boundary safe) — unit-tested
    │   ├── sseParser.test.ts   # adversarial framing tests (CRLF splits, EOF, 1-char chunks)
    │   └── sse.ts              # fetch + ReadableStream transport over sseParser
    ├── hooks/
    │   └── useChat.ts          # message/status/emotion state machine + SSE lifecycle
    └── components/
        ├── SakinaAvatar.tsx    PresenceHeader.tsx  TopBar.tsx
        ├── MessageBubble.tsx   Composer.tsx        TypingIndicator.tsx
        ├── SourcesPanel.tsx    CrisisCard.tsx      ErrorBoundary.tsx
```

## Local run

```bash
npm install
cp .env.example .env.local       # VITE_API_URL=http://localhost:8001
npm run dev                      # http://localhost:5173  (API must be running on :8001)
npm run build                    # production build → dist/
npm run typecheck                # tsc --noEmit
npm test                         # vitest — SSE parser suite
```

## SSE contract (consumed by `lib/sse.ts`)

`POST {VITE_API_URL}/chat` → `text/event-stream`:

- `event: meta`  → `{ emotion, intent, language, sources[], kind }` (once, before generation)
- `event: delta` → `{ text }` (repeated; concatenated into the live bubble)
- `event: done`  → `{ id, role, emotion, time, text: { <lang>: reply, "en": english }, kind }`

`sse.ts` returns whether a `done` was dispatched; `useChat` recovers (commits partial text /
resets status) if a stream closes without one, so the UI can never hang.

## Divergences from the original plan (deliberate — flagged for review)

| Original plan | What was built | Why |
|---|---|---|
| Vercel AI SDK (`ai`, `@ai-sdk/react`) `useChat` | **Custom SSE client** (`sse.ts` + `sseParser.ts`) | The backend speaks a custom `meta/delta/done` contract with a rich `meta` payload (emotion, intent, sources), not the AI SDK's message-stream protocol. A ~120-line, unit-tested reader is simpler to reason about and defend than bending `useChat` around it. |
| DiceBear runtime (`@dicebear/*`) | **Static SVG `<img>`** from `public/avatars/` | The 6 emotion avatars are pre-rendered and art-locked; no runtime generation needed. |
| EN/AR split two-pane layout | **Single responsive column + "🌐 EN" reveal** on non-English replies | The two-pane split was a demo design artifact. A per-message English reveal (from `done.text.en`) showcases the 20-language + translation pipeline without doubling the UI. |
| `recharts` mood timeline, journaling, onboarding, settings sheet, voice | **Deferred** | Out of scope for the core graded demo; the chat + emotion + RAG + multilingual loop is the deliverable. |

## Notes

- A `CrisisCard` component exists and renders when a message arrives with `kind: "crisis"`.
  The backend's crisis safety gate is currently deferred, so `kind` is always `null` today —
  the UI is wired for it when the gate is re-enabled.
- RTL is driven by `RTL_LANGS` (`ar`, `ur`); all other languages render LTR.
- `clsx` remains in `package.json` (per repo guardrail: add deps, don't remove existing ones)
  though class names are currently built with template strings.
```
