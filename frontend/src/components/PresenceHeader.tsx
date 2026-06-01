import { SakinaAvatar } from './SakinaAvatar'
import type { Emotion } from '../lib/types'
import { EMOTION_COLORS, EMOTION_LABELS } from '../lib/emotion'

interface PresenceHeaderProps {
  emotion: Emotion
  isSpeaking: boolean
}

export function PresenceHeader({ emotion, isSpeaking }: PresenceHeaderProps) {
  const emoLabel = EMOTION_LABELS.en?.[emotion] ?? emotion
  const emoColor = EMOTION_COLORS[emotion]

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
          <span>Sakina · {emoLabel}</span>
        </div>
      </div>
    </div>
  )
}
