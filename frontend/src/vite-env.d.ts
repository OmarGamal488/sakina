/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** FastAPI orchestrator base URL — used by the AI SDK transport (App.tsx) + voice hooks. */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
