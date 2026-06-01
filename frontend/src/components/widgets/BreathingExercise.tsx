/**
 * BreathingExercise — animated box-breathing guide (4-4-4-4).
 * An expanding/contracting circle shows the current phase.
 * Starts stopped; user taps to begin.
 */

import { useEffect, useRef, useState } from 'react'

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out'

const PHASES: { phase: Phase; label: string; duration: number }[] = [
  { phase: 'inhale',   label: 'Breathe in',  duration: 4000 },
  { phase: 'hold-in',  label: 'Hold',         duration: 4000 },
  { phase: 'exhale',   label: 'Breathe out',  duration: 4000 },
  { phase: 'hold-out', label: 'Hold',         duration: 4000 },
]

const CIRCLE_SCALE: Record<Phase, number> = {
  'inhale':   1,
  'hold-in':  1,
  'exhale':   0.45,
  'hold-out': 0.45,
}
// Resting size when stopped — small, so the first inhale visibly grows the circle.
const REST_SCALE = 0.45

export function BreathingExercise() {
  const [active, setActive] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const phase = PHASES[phaseIdx]

  useEffect(() => {
    if (!active) return
    timerRef.current = setTimeout(() => {
      setPhaseIdx(i => (i + 1) % PHASES.length)
    }, phase.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, phaseIdx, phase.duration])

  const scale = active ? CIRCLE_SCALE[phase.phase] : REST_SCALE
  const transMs = active ? phase.duration : 600

  return (
    <div className="widget-card" role="region" aria-label="Box breathing exercise">
      <p className="widget-title">Box breathing</p>
      <p className="widget-sub">4 counts each · slow and even</p>

      <div className="breathing-stage" aria-hidden>
        <div
          className="breathing-circle"
          style={{
            transform: `scale(${scale})`,
            transition: `transform ${transMs}ms ease-in-out`,
          }}
        />
      </div>
      <p className="breathing-phase">{active ? phase.label : 'Tap begin to follow along'}</p>

      <button
        className={`widget-btn${active ? ' widget-btn-ghost' : ''}`}
        onClick={() => {
          if (active) {
            setActive(false)
            setPhaseIdx(0)
          } else {
            setPhaseIdx(0)
            setActive(true)
          }
        }}
        aria-pressed={active}
      >
        {active ? 'Stop' : 'Begin'}
      </button>
    </div>
  )
}
