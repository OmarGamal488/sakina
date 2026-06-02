// Emotion constants — LOCKED, never change order or colors
import type { Emotion } from './types'

export const EMOTION_ORDER: Emotion[] = [
  'sadness',
  'joy',
  'love',
  'anger',
  'fear',
  'surprise',
]

export const DEFAULT_EMOTION: Emotion = 'joy'

// Exact colors per CLAUDE.md cross-cutting invariants
export const EMOTION_COLORS: Record<Emotion, string> = {
  sadness:  '#6B8FB5',
  joy:      '#E4B363',
  love:     '#C8959B',
  anger:    '#D4856B',
  fear:     '#B8A6C4',
  surprise: '#E5B0A4',
}

// Emotion display labels — the canonical DAIR-emotion dataset label names
// (sadness · joy · love · anger · fear · surprise), shown verbatim in the UI.
export const EMOTION_LABELS: Record<string, Record<Emotion, string>> = {
  en: {
    sadness:  'sadness',
    joy:      'joy',
    love:     'love',
    anger:    'anger',
    fear:     'fear',
    surprise: 'surprise',
  },
  ar: {
    sadness:  'حزن',
    joy:      'فرح',
    love:     'حب',
    anger:    'غضب',
    fear:     'خوف',
    surprise: 'مفاجأة',
  },
}

// Screen-reader label for each emotion state
export const SR_LABELS: Record<Emotion, string> = {
  sadness:  'Sakina, gentle and quiet',
  joy:      'Sakina, warm',
  love:     'Sakina, warm and present',
  anger:    'Sakina, focused',
  fear:     'Sakina, attentive',
  surprise: 'Sakina, attentive',
}
