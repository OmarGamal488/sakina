# Sakina Frontend

Production React app — Vite + TypeScript + Tailwind + Framer Motion +
Vercel AI SDK. Currently a placeholder; the working prototype lives in
[`../demo`](../demo) and will be ported here once the API is wired up.

## Planned layout

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── public/
│   └── avatars/             # pre-rendered emotion SVGs (copy from demo)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── lib/
    │   ├── emotion.ts       # Emotion type + EMOTION_COLORS map
    │   └── stream.ts        # SSE adapter for useChat
    ├── components/
    │   ├── SakinaAvatar.tsx
    │   ├── ChatShell.tsx
    │   ├── MessageBubble.tsx
    │   ├── CrisisCard.tsx
    │   ├── MoodTimeline.tsx
    │   ├── JournalingCard.tsx
    │   ├── Onboarding.tsx
    │   └── SettingsSheet.tsx
    └── styles.css
```

## Why a separate folder instead of editing `demo/`

The demo uses CDN React + Babel-standalone — fine for design iteration,
unacceptable for production (no tree-shaking, no type-checking, slow first
paint). The Vite build here will be the actual shipped app. The demo stays
around as a documentation artifact.

## Local run (planned)

```bash
npm install
cp .env.example .env.local       # VITE_API_URL=http://localhost:8001
npm run dev                      # http://localhost:5173
```

## Dependencies (planned)

```
react ^18.3
react-dom ^18.3
ai ^5                            # Vercel AI SDK
@ai-sdk/react ^2
@ai-sdk/groq ^1
@dicebear/core ^9
@dicebear/collection ^9
framer-motion ^11
tailwindcss ^3.4
recharts ^2
lucide-react ^0.456
clsx ^2
```

## Porting the demo into Vite

When ready, copy the JSX files from `../demo/` into `src/components/`,
rename `.jsx` → `.tsx`, add proper imports (React, Framer Motion, DiceBear)
since the demo uses globals, and replace the inline sample data in
`data.jsx` with `useChat` from `@ai-sdk/react`.
