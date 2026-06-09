import { SakinaAvatar } from './SakinaAvatar'
import type { Emotion } from '../lib/types'
import { EMOTION_COLORS, EMOTION_LABELS, NEUTRAL_COLOR } from '../lib/emotion'

interface PresenceHeaderProps {
  // `null` while a reply is pending and no emotion has been detected yet.
  emotion: Emotion | null
  isSpeaking: boolean
}

export function PresenceHeader({ emotion, isSpeaking }: PresenceHeaderProps) {
  // Blank presence while pending: neutral color, no emotion name in the label.
  const emoLabel = emotion ? (EMOTION_LABELS.en?.[emotion] ?? emotion) : null
  const emoColor = emotion ? EMOTION_COLORS[emotion] : NEUTRAL_COLOR

  const style = {
    '--emo': emoColor,
    '--emo-soft': `${emoColor}22`,
  } as unknown as React.CSSProperties

  return (
    <div className="presence" style={style}>
      <SakinaAvatar emotion={emotion} size="md" isSpeaking={isSpeaking} />
      <div className="presence-meta">
        <div className="presence-emo">
          <span className="swatch" aria-hidden />
          <span>{emoLabel ? `Sakina · ${emoLabel}` : 'Sakina'}</span>
        </div>
      </div>
    </div>
  )
}
