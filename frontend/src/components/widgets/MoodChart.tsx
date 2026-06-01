/**
 * MoodChart — pure SVG/CSS inline chart of session emotions over time.
 * No Recharts. Dots colored by EMOTION_COLORS, connected by a polyline.
 * Shows only when there are at least 2 data points.
 */

import type { Emotion } from '../../lib/types'
import { EMOTION_COLORS, EMOTION_ORDER, EMOTION_LABELS } from '../../lib/emotion'

interface MoodChartProps {
  emotions: Emotion[]
}

// Map emotion to a numeric Y value (0 = top = positive, 1 = bottom = distress)
const EMOTION_Y: Record<Emotion, number> = {
  joy:      0.05,
  love:     0.2,
  surprise: 0.35,
  fear:     0.55,
  anger:    0.7,
  sadness:  0.9,
}

const WIDTH = 340
const HEIGHT = 100
const DOT_R = 5
const PAD_X = 16
const PAD_Y = 10

export function MoodChart({ emotions }: MoodChartProps) {
  if (emotions.length < 2) return null

  const usableW = WIDTH - PAD_X * 2
  const usableH = HEIGHT - PAD_Y * 2

  const points = emotions.map((emo, i) => ({
    x: PAD_X + (i / (emotions.length - 1)) * usableW,
    y: PAD_Y + EMOTION_Y[emo] * usableH,
    color: EMOTION_COLORS[emo],
    label: EMOTION_LABELS.en?.[emo] ?? emo,
    emo,
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="widget-card" role="region" aria-label="Session mood chart">
      <p className="widget-title">Mood over this session</p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        style={{ display: 'block', maxWidth: WIDTH }}
        aria-hidden
      >
        {/* Connecting line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={DOT_R}
            fill={p.color}
            stroke="var(--cream)"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      {/* Legend: unique emotions in order */}
      <div className="widget-legend" aria-label="Emotion legend">
        {EMOTION_ORDER.filter(e => emotions.includes(e)).map(emo => (
          <span key={emo} className="widget-legend-item">
            <span
              className="widget-legend-dot"
              style={{ background: EMOTION_COLORS[emo] }}
              aria-hidden
            />
            {EMOTION_LABELS.en?.[emo] ?? emo}
          </span>
        ))}
      </div>
    </div>
  )
}
