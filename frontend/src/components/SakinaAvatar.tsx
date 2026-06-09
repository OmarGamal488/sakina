/**
 * SakinaAvatar — renders the static emotion SVG with:
 * - Emotion-colored glow ring
 * - Gentle "breathe" scale loop
 * - Sonar "ping" while isSpeaking
 * - Fear gets the anxious tremor variant
 * - Opacity crossfade on emotion change
 * - Reduced-motion respects OS preference via CSS
 */

import { useEffect, useRef, useState } from 'react'
import type { Emotion } from '../lib/types'
import { EMOTION_COLORS, NEUTRAL_COLOR, SR_LABELS } from '../lib/emotion'

interface SizePreset {
  px: number
  ring: number
  glow: number
}

const SIZE_PRESETS: Record<string, SizePreset> = {
  xs:   { px: 38,  ring: 2, glow: 6 },
  sm:   { px: 56,  ring: 3, glow: 10 },
  md:   { px: 120, ring: 5, glow: 20 },
  lg:   { px: 160, ring: 6, glow: 28 },
}

interface SakinaAvatarProps {
  /** `null` → blank presence: a faceless neutral disc (reply pending, emotion
   *  not yet detected). `undefined` falls back to joy. */
  emotion?: Emotion | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  isSpeaking?: boolean
  label?: string
  /** Gentle breathing loop — disable for small per-message avatars. */
  breathe?: boolean
}

/** Crossfade between avatar SVGs when emotion changes */
function FaceCrossfade({ src, emotion, size }: { src: string; emotion: string; size: number }) {
  const [shownSrc, setShownSrc] = useState(src)
  const [fade, setFade] = useState<'in' | 'out'>('in')
  const lastEmotion = useRef(emotion)

  useEffect(() => {
    if (lastEmotion.current === emotion) return
    setFade('out')
    const t = setTimeout(() => {
      setShownSrc(src)
      setFade('in')
      lastEmotion.current = emotion
    }, 200)
    return () => clearTimeout(t)
  }, [src, emotion])

  return (
    <span
      className={`sakina-fade ${fade}`}
      style={{ transitionDuration: '200ms' }}
      aria-hidden
    >
      <img
        src={shownSrc}
        alt=""
        draggable={false}
        width={size}
        height={size}
        style={{
          display: 'block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#F0E6D2',
          userSelect: 'none',
        }}
      />
    </span>
  )
}

/** Faceless resting disc shown while no emotion has been detected yet. */
function BlankFace({ size }: { size: number }) {
  return (
    <span className="sakina-fade in" aria-hidden>
      <span
        style={{
          display: 'block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#F0E6D2',
          userSelect: 'none',
        }}
      />
    </span>
  )
}

export function SakinaAvatar({
  emotion = 'joy',
  size = 'md',
  isSpeaking = false,
  label,
  breathe = true,
}: SakinaAvatarProps) {
  const preset = SIZE_PRESETS[size] ?? SIZE_PRESETS.md
  const { px, ring, glow } = preset
  // Blank presence: no detected emotion yet → neutral color, faceless disc.
  const isBlank = emotion == null
  const color = isBlank ? NEUTRAL_COLOR : (EMOTION_COLORS[emotion] ?? EMOTION_COLORS.joy)
  const ringGap = Math.max(2, Math.round(px / 30))
  const faceSize = px - (ring + ringGap) * 2
  const srLabel = (!isBlank && SR_LABELS[emotion]) || 'Sakina'

  const breatheClass = !breathe
    ? ''
    : emotion === 'fear'
      ? 'avatar-breathe anxious'
      : 'avatar-breathe'

  // CSS custom props for the avatar sizing system
  const wrapStyle = {
    width: px,
    height: px,
    '--emo': color,
    '--glow': `${glow}px`,
    '--ring': `${ring}px`,
  } as unknown as React.CSSProperties
  // Cast required: custom CSS properties are not in React.CSSProperties type

  return (
    <div
      className="sakina-av"
      style={wrapStyle}
      role="img"
      aria-label={label ?? srLabel}
    >
      <span className="sr-only">{srLabel}</span>
      {isSpeaking && <span className="sakina-av-ping" aria-hidden />}
      <span className="sakina-av-glow" aria-hidden />
      <span className="sakina-av-ring" aria-hidden />
      <span className={`sakina-av-face ${breatheClass}`} aria-hidden>
        {isBlank ? (
          <BlankFace size={faceSize} />
        ) : (
          <FaceCrossfade src={`/avatars/sakina_${emotion}.svg`} emotion={emotion} size={faceSize} />
        )}
      </span>
    </div>
  )
}
