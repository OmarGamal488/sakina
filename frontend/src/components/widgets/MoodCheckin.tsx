/**
 * MoodCheckin — pick from the 6 DAIR emotions, add an optional note,
 * then submit → sends a follow-up message via onAction.
 */

import { useState } from 'react'
import type { Emotion } from '../../lib/types'
import { EMOTION_COLORS, EMOTION_ORDER, EMOTION_LABELS } from '../../lib/emotion'

interface MoodCheckinProps {
  onAction: (text: string) => void
}

export function MoodCheckin({ onAction }: MoodCheckinProps) {
  const [selected, setSelected] = useState<Emotion | null>(null)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="widget-card">
        <p className="widget-title">Mood check-in</p>
        <p className="widget-sub" style={{ color: 'var(--sage)' }}>
          Thank you for sharing. I hear you.
        </p>
      </div>
    )
  }

  const handleSubmit = () => {
    if (!selected) return
    const label = EMOTION_LABELS.en?.[selected] ?? selected
    const msg = note.trim()
      ? `I'm feeling ${label}. ${note.trim()}`
      : `I'm feeling ${label}.`
    setSubmitted(true)
    onAction(msg)
  }

  return (
    <div className="widget-card" role="region" aria-label="Mood check-in">
      <p className="widget-title">How are you feeling?</p>
      <p className="widget-sub">Pick what resonates most.</p>

      <div className="widget-mood-grid" role="group" aria-label="Emotion options">
        {EMOTION_ORDER.map(emo => {
          const color = EMOTION_COLORS[emo]
          const label = EMOTION_LABELS.en?.[emo] ?? emo
          const isSelected = selected === emo
          return (
            <button
              key={emo}
              className={`widget-mood-chip${isSelected ? ' widget-mood-chip--on' : ''}`}
              style={{ '--chip-color': color } as unknown as React.CSSProperties}
              onClick={() => setSelected(emo)}
              aria-pressed={isSelected}
            >
              <span
                className="widget-mood-swatch"
                style={{ background: color }}
                aria-hidden
              />
              {label}
            </button>
          )
        })}
      </div>

      <textarea
        className="widget-textarea"
        placeholder="Anything you'd like to add? (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        aria-label="Optional note"
      />

      <button
        className="widget-btn"
        onClick={handleSubmit}
        disabled={!selected}
        aria-disabled={!selected}
      >
        Share with Sakina
      </button>
    </div>
  )
}
