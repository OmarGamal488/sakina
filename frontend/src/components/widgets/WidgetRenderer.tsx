/**
 * WidgetRenderer — maps a `data-widget.type` to the correct widget component.
 * All widgets share the same onAction callback so they can send a follow-up message.
 */

import type { Emotion, WidgetType } from '../../lib/types'
import { BreathingExercise } from './BreathingExercise'
import { GroundingExercise } from './GroundingExercise'
import { MoodCheckin } from './MoodCheckin'
import { MoodChart } from './MoodChart'
import { SuggestedActions } from './SuggestedActions'

interface WidgetRendererProps {
  type: WidgetType
  onAction: (text: string) => void
  sessionEmotions: Emotion[]
}

export function WidgetRenderer({ type, onAction, sessionEmotions }: WidgetRendererProps) {
  switch (type) {
    case 'breathing':
      return <BreathingExercise />
    case 'grounding':
      return <GroundingExercise onAction={onAction} />
    case 'mood_checkin':
      return <MoodCheckin onAction={onAction} />
    case 'mood_chart':
      return <MoodChart emotions={sessionEmotions} />
    case 'actions':
      return <SuggestedActions onAction={onAction} />
    default:
      return null
  }
}
