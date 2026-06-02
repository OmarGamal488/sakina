/**
 * WidgetRenderer — maps a `data-widget.type` to the correct widget component.
 * All widgets share the same onAction callback so they can send a follow-up message.
 */

import type { Emotion, WidgetType } from '../../lib/types'
// DEACTIVATED widgets — backend no longer selects them; component files kept dormant for
// easy reactivation: BreathingExercise (box breathing), MoodCheckin ("How are you feeling?"),
// GroundingExercise (5-4-3-2-1 grounding), SuggestedActions ("What would help most?").
import { MoodChart } from './MoodChart'

interface WidgetRendererProps {
  type: WidgetType
  // Kept in the contract for the dormant action/grounding widgets; unused while
  // mood_chart is the only active widget.
  onAction: (text: string) => void
  sessionEmotions: Emotion[]
}

export function WidgetRenderer({ type, sessionEmotions }: WidgetRendererProps) {
  switch (type) {
    // Only 'mood_chart' is active; breathing/mood_checkin/grounding/actions deactivated
    // → fall through to default (render nothing).
    case 'mood_chart':
      return <MoodChart emotions={sessionEmotions} />
    default:
      return null
  }
}
