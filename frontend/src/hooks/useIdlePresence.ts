/**
 * useIdlePresence — two-stage idle "presence" timer.
 *
 * stage 0 → 1 after `stage1Ms` of no interaction (a soft nudge),
 * stage 1 → 2 after `stage2Ms` (the centered-avatar presence overlay).
 *
 * ANY user interaction (pointer / key / touch / wheel) resets to stage 0 and
 * re-arms — so the overlay dismisses on interaction and never nags on a loop:
 * the timers fire once per arm, and re-arming only happens on real activity (or
 * when `enabled` flips back on after a reply). Ported from claude-design/idle.jsx;
 * the global activity listener lives here so the component tree stays declarative.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface IdleOptions {
  stage1Ms?: number
  stage2Ms?: number
  /** Gate the timer off while there are no messages or a reply is streaming. */
  enabled?: boolean
}

export function useIdlePresence({
  stage1Ms = 60_000,
  stage2Ms = 120_000,
  enabled = true,
}: IdleOptions = {}) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (t1.current) clearTimeout(t1.current)
    if (t2.current) clearTimeout(t2.current)
    t1.current = null
    t2.current = null
  }, [])

  const arm = useCallback(() => {
    clear()
    if (!enabled) return
    t1.current = setTimeout(() => setStage(1), stage1Ms)
    t2.current = setTimeout(() => setStage(2), stage2Ms)
  }, [clear, enabled, stage1Ms, stage2Ms])

  const reset = useCallback(() => {
    setStage(0)
    arm()
  }, [arm])

  // Arm when enabled; tear down on disable/unmount.
  useEffect(() => {
    if (enabled) arm()
    else {
      clear()
      setStage(0)
    }
    return clear
  }, [enabled, arm, clear])

  // Any interaction resets the idle timer (and so dismisses the overlay).
  useEffect(() => {
    if (!enabled) return
    const onActivity = () => reset()
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel']
    for (const ev of events) window.addEventListener(ev, onActivity, { passive: true })
    return () => {
      for (const ev of events) window.removeEventListener(ev, onActivity)
    }
  }, [enabled, reset])

  return { stage, reset }
}
