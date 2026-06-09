// Types — aligned to the API SSE contract and AI SDK v6

import type { UIMessage } from 'ai'

export type Emotion = 'sadness' | 'joy' | 'love' | 'anger' | 'fear' | 'surprise'

export type Intent =
  | 'greeting'
  | 'goodbye'
  | 'gratitude'
  | 'asking_mental_health_question'
  | 'out_of_scope'

// Human-readable names for the detected-intent chip (shown beside emotion + language)
export const INTENT_LABELS: Record<Intent, string> = {
  greeting: 'Greeting',
  goodbye: 'Goodbye',
  gratitude: 'Gratitude',
  asking_mental_health_question: 'Mental-health question',
  out_of_scope: 'Out of scope',
}

// 20 languages supported by the backend
export type LangCode =
  | 'ar' | 'bg' | 'de' | 'el' | 'en' | 'es' | 'fr' | 'hi' | 'it' | 'ja'
  | 'nl' | 'pl' | 'pt' | 'ru' | 'sw' | 'th' | 'tr' | 'ur' | 'vi' | 'zh'

export interface Source {
  text: string
  context: string
  score: number
}

// Chat status machine (from the AI SDK useChat hook)
export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

// RTL languages
export const RTL_LANGS: ReadonlySet<LangCode> = new Set(['ar', 'ur'])

// Human-readable names for the detected-language label (shown under each reply)
export const LANG_NAMES: Record<LangCode, string> = {
  ar: 'Arabic',  bg: 'Bulgarian', de: 'German',     el: 'Greek',   en: 'English',
  es: 'Spanish', fr: 'French',    hi: 'Hindi',      it: 'Italian', ja: 'Japanese',
  nl: 'Dutch',   pl: 'Polish',    pt: 'Portuguese', ru: 'Russian', sw: 'Swahili',
  th: 'Thai',    tr: 'Turkish',   ur: 'Urdu',       vi: 'Vietnamese', zh: 'Chinese',
}

// ─── AI SDK v6 typed data-parts ──────────────────────────────────────────────

/** Widget types emitted by the backend in a data-widget part */
export type WidgetType = 'breathing' | 'grounding' | 'mood_checkin' | 'mood_chart' | 'actions'

/** Payload of the `data-meta` part (one per assistant message) */
export interface MetaData {
  emotion: Emotion
  intent: Intent
  language: LangCode
  sources: Source[]
  /** Set to 'crisis' when the safety gate fired (skips RAG/LLM); triggers <CrisisCard>. */
  kind?: 'crisis' | null
}

/** Payload of the `data-text` part (one per assistant message) */
export type TextData = Partial<Record<LangCode, string>>

/** Payload of the `data-widget` part (optional, at most one per assistant message) */
export interface WidgetData {
  type: WidgetType
}

/**
 * DATA_PARTS schema for useChat<SakinaUIMessage>.
 * Must be a `type` alias (not interface) so it satisfies `extends Record<string, unknown>`
 * — the UIDataTypes constraint on UIMessage's second type parameter.
 */
export type SakinaDataTypes = {
  meta: MetaData
  text: TextData
  widget: WidgetData
}

/** Fully typed UIMessage for this app — import this instead of raw UIMessage */
export type SakinaUIMessage = UIMessage<unknown, SakinaDataTypes>
