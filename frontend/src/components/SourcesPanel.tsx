/**
 * SourcesPanel — collapsible disclosure showing RAG sources attached to a message.
 * Appears only on asking_mental_health_question intent (where sources.length > 0).
 */

import { useState } from 'react'
import type { LangCode, Source } from '../lib/types'
import { RTL_LANGS } from '../lib/types'

interface SourcesPanelProps {
  sources: Source[]
  lang: string
}

export function SourcesPanel({ sources, lang }: SourcesPanelProps) {
  const [open, setOpen] = useState(false)
  if (!sources.length) return null

  const isAr = lang === 'ar'
  const isRtl = RTL_LANGS.has(lang as LangCode)
  const label = isAr
    ? `المصادر (${sources.length})`
    : `Sources (${sources.length})`

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <button
        className="sources-summary"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={label}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && (
        <div className="sources-list" role="list">
          {sources.map((s, i) => (
            <div className="source-item" key={i} role="listitem">
              <div>{s.text}</div>
              {s.context && (
                <div style={{ color: 'var(--ink-fade)', marginTop: 3, fontSize: 11 }}>
                  {s.context}
                </div>
              )}
              <div className="source-score">
                {isAr ? 'الصلة:' : 'Relevance:'}{' '}
                {Math.round(Math.min(1, Math.max(0, s.score)) * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
