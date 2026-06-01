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

// Human-readable labels in EN / AR (from demo/data.jsx)
export const EMOTION_LABELS: Record<string, Record<Emotion, string>> = {
  en: {
    sadness:  'sad',
    joy:      'lighter',
    love:     'warm',
    anger:    'angry',
    fear:     'attentive',
    surprise: 'surprised',
  },
  ar: {
    sadness:  'حزين',
    joy:      'أخف',
    love:     'دافئ',
    anger:    'غاضب',
    fear:     'حذِر',
    surprise: 'متفاجئ',
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
