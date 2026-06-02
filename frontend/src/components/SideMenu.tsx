import { useEffect, useMemo, useState } from 'react'
import { Mail, Save, Send, Settings2, Trash2, X } from 'lucide-react'
import {
  getSavedTrustedPersonEmail,
  getSavedUserEmail,
  getSavedUserName,
  TRUSTED_PERSON_EMAIL_KEY,
  USER_EMAIL_KEY,
  USER_NAME_KEY,
} from '../lib/userSettings'

const WEBHOOK_URL = 'https://ahmedgamal7207.app.n8n.cloud/webhook/letter-forward'

type DrawerView = 'settings' | 'letter-forward'
type DeliveryOption = '1m' | '1d' | '1mo'

interface SideMenuProps {
  isOpen: boolean
  onClose: () => void
}

const DELIVERY_OPTIONS: Record<DeliveryOption, string> = {
  '1m': 'in 1 minute',
  '1d': 'in a day',
  '1mo': 'in a month',
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function addInterval(base: Date, when: DeliveryOption): Date {
  const next = new Date(base)
  if (when === '1m') {
    next.setMinutes(next.getMinutes() + 1)
    return next
  }
  if (when === '1d') {
    next.setDate(next.getDate() + 1)
    return next
  }
  next.setMonth(next.getMonth() + 1)
  return next
}

function formatOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  const minutes = String(abs % 60).padStart(2, '0')
  return `${sign}${hours}:${minutes}`
}

function toWebhookDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${formatOffset(date)}`
}

function formatReadable(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const [activeView, setActiveView] = useState<DrawerView>('settings')
  const [now, setNow] = useState(() => new Date())
  const [emailDraft, setEmailDraft] = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [trustedEmailDraft, setTrustedEmailDraft] = useState('')
  const [savedTrustedEmail, setSavedTrustedEmail] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [savedName, setSavedName] = useState('')
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null)
  const [letter, setLetter] = useState('')
  const [when, setWhen] = useState<DeliveryOption>('1m')
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  useEffect(() => {
    const email = getSavedUserEmail()
    const trustedEmail = getSavedTrustedPersonEmail()
    const userName = getSavedUserName()
    setSavedEmail(email)
    setEmailDraft(email)
    setSavedTrustedEmail(trustedEmail)
    setTrustedEmailDraft(trustedEmail)
    setSavedName(userName)
    setNameDraft(userName)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setSubmitState('idle')
      setSubmitMessage(null)
    }
  }, [isOpen])

  useEffect(() => {
    const updateNow = () => setNow(new Date())

    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  const normalizedEmail = emailDraft.trim()
  const normalizedTrustedEmail = trustedEmailDraft.trim()
  const normalizedName = nameDraft.trim()
  const isEmailDirty = normalizedEmail !== savedEmail
  const isTrustedEmailDirty = normalizedTrustedEmail !== savedTrustedEmail
  const isNameDirty = normalizedName !== savedName
  const canSaveSettings =
    (isEmailDirty && isValidEmail(normalizedEmail)) ||
    (isTrustedEmailDirty && isValidEmail(normalizedTrustedEmail)) ||
    isNameDirty
  const canSeal = !!letter.trim() && !!savedEmail && submitState !== 'saving'

  const deliveryDate = useMemo(() => addInterval(now, when), [now, when])

  const handleSaveSettings = () => {
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setSettingsNotice('Enter a valid email address before saving.')
      return
    }
    if (normalizedTrustedEmail && !isValidEmail(normalizedTrustedEmail)) {
      setSettingsNotice('Enter a valid trusted person email before saving.')
      return
    }

    localStorage.setItem(USER_EMAIL_KEY, normalizedEmail)
    localStorage.setItem(TRUSTED_PERSON_EMAIL_KEY, normalizedTrustedEmail)
    localStorage.setItem(USER_NAME_KEY, normalizedName)

    setSavedEmail(normalizedEmail)
    setEmailDraft(normalizedEmail)
    setSavedTrustedEmail(normalizedTrustedEmail)
    setTrustedEmailDraft(normalizedTrustedEmail)
    setSavedName(normalizedName)
    setNameDraft(normalizedName)
    setSettingsNotice('Settings saved. You can update them any time.')
  }

  const handleClearEmail = () => {
    localStorage.removeItem(USER_EMAIL_KEY)
    setSavedEmail('')
    setEmailDraft('')
    setSettingsNotice('Your email was cleared.')
  }

  const handleClearTrustedEmail = () => {
    localStorage.removeItem(TRUSTED_PERSON_EMAIL_KEY)
    setSavedTrustedEmail('')
    setTrustedEmailDraft('')
    setSettingsNotice('Trusted person email was cleared.')
  }

  const handleClearName = () => {
    localStorage.removeItem(USER_NAME_KEY)
    setSavedName('')
    setNameDraft('')
    setSettingsNotice('Your name was cleared.')
  }

  const handleSeal = async () => {
    if (!savedEmail) {
      setActiveView('settings')
      setSubmitState('error')
      setSubmitMessage('Save your email in Settings first.')
      return
    }

    const sendAt = addInterval(new Date(), when)
    setSubmitState('saving')
    setSubmitMessage(null)

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: savedEmail,
          intent: 'letter',
          letter: letter.trim(),
          sendAt: toWebhookDate(sendAt),
        }),
      })

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`)
      }

      setLetter('')
      setSubmitState('success')
      setSubmitMessage(`Your letter was sealed. It will be sent ${formatReadable(sendAt)}.`)
    } catch {
      setSubmitState('error')
      setSubmitMessage('Could not seal the letter right now. Please try again.')
    }
  }

  return (
    <div className={`side-menu-shell${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
      <button
        type="button"
        className="side-menu-backdrop"
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={isOpen ? 0 : -1}
      />

      <aside className="side-menu" role="dialog" aria-modal="true" aria-label="Sakina menu">
        <div className="side-menu__header">
          <div>
            <p className="side-menu__eyebrow">Space for gentle tools</p>
            <h2 className="side-menu__title">Personal corner</h2>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="side-menu__tabs" role="tablist" aria-label="Menu sections">
          <button
            type="button"
            className={`side-menu__tab${activeView === 'settings' ? ' is-active' : ''}`}
            onClick={() => setActiveView('settings')}
            role="tab"
            aria-selected={activeView === 'settings'}
          >
            <Settings2 size={16} aria-hidden />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className={`side-menu__tab${activeView === 'letter-forward' ? ' is-active' : ''}`}
            onClick={() => setActiveView('letter-forward')}
            role="tab"
            aria-selected={activeView === 'letter-forward'}
          >
            <Mail size={16} aria-hidden />
            <span>Letter Forward</span>
          </button>
        </div>

        <div className="side-menu__body">
          {activeView === 'settings' ? (
            <section className="panel-card">
              <div className="panel-card__intro">
                <p className="panel-card__label">Settings</p>
                <h3 className="panel-card__title">Personal and safety details</h3>
                <p className="panel-card__text">
                  These details stay on this device. Your saved email is used for letter
                  delivery, and your trusted person can be contacted if you are in danger.
                </p>
              </div>

              <label className="field-block">
                <span className="field-block__label">Your name</span>
                <input
                  type="text"
                  className="field-input"
                  value={nameDraft}
                  onChange={event => {
                    setNameDraft(event.target.value)
                    setSettingsNotice(null)
                  }}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>

              <div className="panel-card__row panel-card__row--tight">
                <button
                  type="button"
                  className="drawer-btn drawer-btn--ghost"
                  onClick={handleClearName}
                  disabled={!savedName && !nameDraft}
                >
                  <Trash2 size={15} aria-hidden />
                  <span>Clear name</span>
                </button>
                {savedName ? <p className="inline-note">Saved for crisis support.</p> : null}
              </div>

              <label className="field-block field-block--spaced">
                <span className="field-block__label">Your email address</span>
                <input
                  type="email"
                  className="field-input"
                  value={emailDraft}
                  onChange={event => {
                    setEmailDraft(event.target.value)
                    setSettingsNotice(null)
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <div className="panel-card__row panel-card__row--tight">
                <button
                  type="button"
                  className="drawer-btn drawer-btn--ghost"
                  onClick={handleClearEmail}
                  disabled={!savedEmail && !emailDraft}
                >
                  <Trash2 size={15} aria-hidden />
                  <span>Clear email</span>
                </button>
                {savedEmail ? <p className="inline-note">Used for future letters.</p> : null}
              </div>

              <label className="field-block field-block--spaced">
                <span className="field-block__label">Trusted person email</span>
                <input
                  type="email"
                  className="field-input"
                  value={trustedEmailDraft}
                  onChange={event => {
                    setTrustedEmailDraft(event.target.value)
                    setSettingsNotice(null)
                  }}
                  placeholder="closest-person@example.com"
                  autoComplete="email"
                />
                <span className="field-block__hint">
                  This person may be contacted if you are in danger. By saving this email, you
                  agree to that.
                </span>
              </label>

              <div className="panel-card__row panel-card__row--tight">
                <button
                  type="button"
                  className="drawer-btn drawer-btn--ghost"
                  onClick={handleClearTrustedEmail}
                  disabled={!savedTrustedEmail && !trustedEmailDraft}
                >
                  <Trash2 size={15} aria-hidden />
                  <span>Clear trusted email</span>
                </button>
                {savedTrustedEmail ? (
                  <p className="inline-note">Ready for emergency contact use.</p>
                ) : null}
              </div>

              <div className="panel-card__row">
                <button
                  type="button"
                  className="drawer-btn drawer-btn--primary"
                  onClick={handleSaveSettings}
                  disabled={!canSaveSettings}
                >
                  <Save size={15} aria-hidden />
                  <span>Save settings</span>
                </button>
              </div>

              {settingsNotice ? <p className="status-note">{settingsNotice}</p> : null}
            </section>
          ) : (
            <section className="letter-card" aria-label="Letter to future self">
              <div className="letter-card__header">
                <div className="letter-card__title-wrap">
                  <div className="letter-card__title-icon-wrap">
                    <Mail size={18} className="letter-card__title-icon" aria-hidden />
                  </div>
                  <div>
                    <p className="panel-card__label">Letter Forward</p>
                    <h3 className="letter-card__title">A letter to your future self</h3>
                  </div>
                </div>
              </div>

              <p className="letter-card__sub">
                Write quietly. Sakina will hold the letter and send it back when you choose.
              </p>

              <div className="letter-card__saved-email">
                <span className="letter-card__saved-email-label">Sending to</span>
                <strong>{savedEmail || 'Add your email in Settings first'}</strong>
              </div>

              <textarea
                className="letter-card__textarea"
                value={letter}
                onChange={event => {
                  setLetter(event.target.value)
                  if (submitState !== 'idle') {
                    setSubmitState('idle')
                    setSubmitMessage(null)
                  }
                }}
                placeholder="Dear future me..."
              />

              <div className="letter-card__when">
                <span className="letter-card__when-label">Deliver</span>

                <div className="letter-card__radio-row">
                  {Object.entries(DELIVERY_OPTIONS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`letter-card__radio-pill${when === key ? ' is-active' : ''}`}
                      onClick={() => setWhen(key as DeliveryOption)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="inline-note">Expected delivery: {formatReadable(deliveryDate)}</p>

              <div className="letter-card__actions">
                <button
                  type="button"
                  className="letter-card__btn letter-card__btn--ghost"
                  onClick={() => {
                    setActiveView('settings')
                    setSubmitState('idle')
                    setSubmitMessage(null)
                  }}
                >
                  Settings
                </button>

                <button
                  type="button"
                  className="letter-card__btn letter-card__btn--primary"
                  disabled={!canSeal}
                  onClick={() => void handleSeal()}
                >
                  <Send size={15} aria-hidden />
                  <span>{submitState === 'saving' ? 'Sealing...' : 'Seal it'}</span>
                </button>
              </div>

              {submitMessage ? (
                <p className={`status-note${submitState === 'error' ? ' is-error' : ' is-success'}`}>
                  {submitMessage}
                </p>
              ) : null}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}
