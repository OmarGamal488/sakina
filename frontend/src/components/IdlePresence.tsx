/**
 * Idle-presence UI — Stage 1 nudge + Stage 2 presence overlay.
 *
 * Driven by useIdlePresence(); reuses the existing SakinaAvatar + the `--emo`
 * ambient color tokens. Copy is EN/AR (the two UI languages); the other 18
 * detected languages fall back to English. Dismissal is handled by the idle
 * hook's global activity listener — the overlay's onClick/button are explicit
 * affordances on top of that. Ported from claude-design/idle.jsx.
 */
import type { CSSProperties } from 'react'

import { EMOTION_COLORS } from '../lib/emotion'
import type { Emotion, LangCode } from '../lib/types'
import { RTL_LANGS } from '../lib/types'
import { SakinaAvatar } from './SakinaAvatar'

interface Copy {
  nudge: string
  title: string
  btn: string
  hint: string
}

const COPY: Record<'en' | 'ar', Copy> = {
  en: {
    nudge: "I'm here whenever you're ready.",
    title: "Are you still there? I'm right here beside you.",
    btn: "I'm here",
    hint: 'tap anywhere to continue',
  },
  ar: {
    nudge: 'أنا هنا وقتما تكون مستعدًا.',
    title: 'هل ما زلت هنا؟ أنا بجانبك.',
    btn: 'أنا هنا',
    hint: 'انقر في أي مكان للمتابعة',
  },
}

const copyFor = (lang: LangCode): Copy => (lang === 'ar' ? COPY.ar : COPY.en)

/** Stage 1 — a quiet, non-blocking line that sits just above the composer. */
export function IdleNudge({ lang }: { lang: LangCode }) {
  const t = copyFor(lang)
  return (
    <div className="idle-nudge show" dir={RTL_LANGS.has(lang) ? 'rtl' : 'ltr'}>
      <span className="idle-nudge-dot" aria-hidden />
      <span>{t.nudge}</span>
    </div>
  )
}

/** Stage 2 — the gentle, emotion-tinted presence overlay with the centered avatar. */
export function IdlePresence({
  lang,
  emotion,
  onDismiss,
}: {
  lang: LangCode
  emotion: Emotion
  onDismiss: () => void
}) {
  const t = copyFor(lang)
  const color = EMOTION_COLORS[emotion] ?? EMOTION_COLORS.joy
  const style = { '--emo': color } as unknown as CSSProperties
  return (
    <div
      className="idle-presence"
      dir={RTL_LANGS.has(lang) ? 'rtl' : 'ltr'}
      style={style}
      role="dialog"
      aria-label={t.title}
      onClick={onDismiss}
    >
      <div className="idle-presence-veil" aria-hidden />
      <div className="idle-presence-inner">
        <div className="idle-presence-avatar">
          <SakinaAvatar emotion={emotion} size="lg" />
        </div>
        <p className="idle-presence-title" aria-live="polite">
          {t.title}
        </p>
        <button className="idle-presence-btn" onClick={onDismiss}>
          {t.btn}
        </button>
        <div className="idle-presence-hint" aria-hidden>
          {t.hint}
        </div>
      </div>
    </div>
  )
}
