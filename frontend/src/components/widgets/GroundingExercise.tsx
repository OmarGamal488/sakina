/**
 * GroundingExercise — interactive 5-4-3-2-1 sensory exercise.
 * User taps through each sense step, optionally jotting a note,
 * and on completion an onAction message is sent.
 */

import { useState } from 'react'

const STEPS = [
  { count: 5, sense: 'see',   prompt: 'Name 5 things you can see right now.' },
  { count: 4, sense: 'hear',  prompt: 'Name 4 things you can hear.' },
  { count: 3, sense: 'touch', prompt: 'Name 3 things you can touch or feel.' },
  { count: 2, sense: 'smell', prompt: 'Name 2 things you can smell.' },
  { count: 1, sense: 'taste', prompt: 'Name 1 thing you can taste.' },
]

interface GroundingExerciseProps {
  onAction: (text: string) => void
}

export function GroundingExercise({ onAction }: GroundingExerciseProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="widget-card">
        <p className="widget-title">5-4-3-2-1 grounding</p>
        <p className="widget-sub" style={{ color: 'var(--sage)' }}>
          Well done. You're right here, right now.
        </p>
      </div>
    )
  }

  const step = STEPS[stepIdx]
  const progress = stepIdx / STEPS.length

  const handleNext = () => {
    const next = stepIdx + 1
    setNote('')
    if (next >= STEPS.length) {
      setDone(true)
      onAction('I just finished the 5-4-3-2-1 grounding exercise.')
    } else {
      setStepIdx(next)
    }
  }

  return (
    <div className="widget-card" role="region" aria-label="5-4-3-2-1 grounding exercise">
      <p className="widget-title">5-4-3-2-1 grounding</p>

      {/* Progress bar */}
      <div className="widget-progress-track" aria-hidden>
        <div
          className="widget-progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="widget-step-count" aria-live="polite">
        Step {stepIdx + 1} of {STEPS.length} · {step.count} {step.sense}
      </p>

      <p className="widget-prompt">{step.prompt}</p>

      <textarea
        className="widget-textarea"
        placeholder="Type here (optional)…"
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        aria-label={`Your ${step.sense} observations`}
      />

      <button className="widget-btn" onClick={handleNext}>
        {stepIdx + 1 < STEPS.length ? 'Next →' : 'Finish'}
      </button>
    </div>
  )
}
