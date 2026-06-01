/**
 * CrisisCard — shown when done.kind === 'crisis' (or meta.kind === 'crisis').
 * Mint-accented inline card with emergency hotline links.
 * Phone numbers: 988 (US) / 8001717 (Egypt). SMS: 741741 (EN) / 16023 (AR).
 */

import { Phone } from 'lucide-react'
import { useState } from 'react'
import type { LangCode } from '../lib/types'
import { RTL_LANGS } from '../lib/types'

interface CrisisCardProps {
  lang: string
}

export function CrisisCard({ lang }: CrisisCardProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const isAr = lang === 'ar'
  const isRtl = RTL_LANGS.has(lang as LangCode)

  return (
    <div className="crisis-card-wrap" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="crisis-card" role="alert" aria-live="assertive">
        <div className="crisis-icon" aria-hidden>
          <Phone size={18} />
        </div>
        <h3>
          {isAr ? 'يسعدني أنّك أخبرتني.' : "I'm really glad you told me."}
        </h3>
        <p>
          {isAr
            ? 'لست مضطرًا لتمرّ بهذا وحدك. لو أحببت، يمكنني أن أصلك بمن يقدر يساعدك الآن.'
            : "You don't have to go through this alone. If you'd like, I can connect you with someone who can help right now."}
        </p>
        <div className="crisis-actions">
          {isAr ? (
            <a className="btn btn-primary" href="tel:8001717">
              <Phone size={15} aria-hidden />
              اتصل بـ 8001717
            </a>
          ) : (
            <a className="btn btn-primary" href="tel:988">
              <Phone size={15} aria-hidden />
              Call 988
              <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.85 }}>
                &nbsp;· US, free, 24/7
              </span>
            </a>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => setDismissed(true)}
          >
            {isAr ? 'ليس الآن' : 'Not right now'}
          </button>
        </div>
        <div className="crisis-foot">
          <span>
            {isAr
              ? 'أو راسل "أمان" على 16023'
              : 'Or text HOME to 741741'}
          </span>
        </div>
      </div>
    </div>
  )
}
