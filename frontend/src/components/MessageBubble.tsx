/**
 * MessageBubble — renders a single chat message from the AI SDK v6 UIMessage type.
 *
 * User messages  → right-aligned, dir="auto" on bubble content.
 * Assistant msgs → always LEFT-aligned (never flip the row for Arabic).
 *                  dir="auto" on the bubble so Arabic content reads RTL inside.
 *
 * Each assistant bubble renders:
 *   - SakinaAvatar (xs, emotion from data-meta part)
 *   - Reply text   (streaming text-part while live; data-text for multilingual after done)
 *   - Emotion tag
 *   - Listen + EN-toggle action row
 *   - SourcesPanel when RAG sources are present
 *   - WidgetRenderer when a data-widget part is present
 */

import { useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { isDataUIPart } from 'ai'
import type { SakinaUIMessage, SakinaDataTypes, Emotion, LangCode, ChatStatus } from '../lib/types'
import { LANG_NAMES, INTENT_LABELS } from '../lib/types'
import { EMOTION_COLORS, EMOTION_LABELS } from '../lib/emotion'
import { SourcesPanel } from './SourcesPanel'
import { SakinaAvatar } from './SakinaAvatar'
import { WidgetRenderer } from './widgets/WidgetRenderer'
import { CrisisCard } from './CrisisCard'

interface MessageBubbleProps {
  message: SakinaUIMessage
  status: ChatStatus
  speakingId: string | null
  onSpeak: (msg: SakinaUIMessage) => void
  onAction: (text: string) => void
  sessionEmotions: Emotion[]
}

// ─── Part extractors ──────────────────────────────────────────────────────────
// isDataUIPart narrows p to DataUIPart<SakinaDataTypes>, giving us p.type and p.data.

function getMetaPart(msg: SakinaUIMessage): SakinaDataTypes['meta'] | undefined {
  for (const p of msg.parts) {
    if (isDataUIPart(p) && p.type === 'data-meta') {
      return p.data as SakinaDataTypes['meta']
    }
  }
  return undefined
}

function getTextPart(msg: SakinaUIMessage): SakinaDataTypes['text'] | undefined {
  for (const p of msg.parts) {
    if (isDataUIPart(p) && p.type === 'data-text') {
      return p.data as SakinaDataTypes['text']
    }
  }
  return undefined
}

function getWidgetPart(msg: SakinaUIMessage): SakinaDataTypes['widget'] | undefined {
  for (const p of msg.parts) {
    if (isDataUIPart(p) && p.type === 'data-widget') {
      return p.data as SakinaDataTypes['widget']
    }
  }
  return undefined
}

/** Accumulate the streaming text-part content */
function getStreamingText(msg: SakinaUIMessage): string {
  let out = ''
  for (const p of msg.parts) {
    if (p.type === 'text') out += p.text
  }
  return out
}

/**
 * Resolve what to display inside the bubble:
 *   - If data-text is present (stream done): pick the right language from the dict.
 *   - Otherwise: fall through to the live text-part accumulation.
 */
function getDisplayText(
  lang: LangCode,
  showEn: boolean,
  textData: SakinaDataTypes['text'] | undefined,
  streamingText: string,
): string {
  if (textData) {
    if (showEn && lang !== 'en' && textData.en) return textData.en
    return textData[lang] ?? textData.en ?? ''
  }
  return streamingText
}

// ─── User bubble ─────────────────────────────────────────────────────────────

function UserBubble({ msg }: { msg: SakinaUIMessage }) {
  const text = getStreamingText(msg)
  return (
    <div className="msg-row user">
      <div style={{ minWidth: 0 }}>
        <div className="msg-bubble" dir="auto">
          {text}
        </div>
      </div>
    </div>
  )
}

// ─── Assistant bubble ─────────────────────────────────────────────────────────

function AssistantBubble({
  msg,
  status,
  speakingId,
  onSpeak,
  onAction,
  sessionEmotions,
}: {
  msg: SakinaUIMessage
  status: ChatStatus
  speakingId: string | null
  onSpeak: (msg: SakinaUIMessage) => void
  onAction: (text: string) => void
  sessionEmotions: Emotion[]
}) {
  const [showEn, setShowEn] = useState(false)

  const meta = getMetaPart(msg)
  const textData = getTextPart(msg)
  const widgetData = getWidgetPart(msg)
  const streamingText = getStreamingText(msg)

  const emotion: Emotion = meta?.emotion ?? 'joy'
  const lang: LangCode = meta?.language ?? 'en'
  const sources = meta?.sources ?? []

  const emoColor = EMOTION_COLORS[emotion] ?? '#E4B363'
  const emoLabel = EMOTION_LABELS.en?.[emotion] ?? emotion
  const langLabel = LANG_NAMES[lang] ?? lang.toUpperCase()
  const intentLabel = meta?.intent ? (INTENT_LABELS[meta.intent] ?? meta.intent) : null

  const bodyText = getDisplayText(lang, showEn, textData, streamingText)

  const isActiveStream = status === 'streaming' || status === 'submitted'
  // Loading dots: stream is active and no text has arrived yet for this message
  const loading = isActiveStream && !bodyText

  // committed = data-text part arrived — multilingual text is fully available
  const committed = !!textData

  const canToggleEn = committed && lang !== 'en' && !!textData?.en
  const isSpeakingThis = speakingId === msg.id

  const bubbleStyle = {
    '--emo-c': emoColor,
    '--emo': emoColor,
  } as unknown as React.CSSProperties

  return (
    <div className="msg-row assistant">
      {/* Neutral size-placeholder until meta (emotion) arrives — prevents layout shift */}
      {!meta ? (
        <div className="msg-avatar-loading" aria-hidden />
      ) : (
        <SakinaAvatar emotion={emotion} size="xs" breathe={false} />
      )}

      <div style={{ minWidth: 0 }}>
        {/* dir="auto": Arabic content reads RTL inside the LEFT-anchored bubble */}
        <div className="msg-bubble" style={bubbleStyle} dir="auto" aria-busy={loading}>
          {loading ? (
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              aria-label="Sakina is composing"
            >
              <span className="typing-dot" style={{ animationDelay: '0ms' }} aria-hidden />
              <span className="typing-dot" style={{ animationDelay: '150ms' }} aria-hidden />
              <span className="typing-dot" style={{ animationDelay: '300ms' }} aria-hidden />
            </span>
          ) : (
            <>
              {bodyText}
              {/* Blinking caret while text is still streaming (before data-text lands) */}
              {isActiveStream && !committed && <span className="caret" aria-hidden />}
            </>
          )}
        </div>

        {/* Crisis hotline card — shown when the safety gate fired (meta.kind === 'crisis') */}
        {meta?.kind === 'crisis' && <CrisisCard lang={lang} />}

        {/* Emotion + detected-language chips — shown once meta arrives and loading dots are gone */}
        {meta && !loading && (
          <div className="meta-tags">
            <span
              className="emo-tag"
              style={{ '--emo-c': emoColor } as unknown as React.CSSProperties}
            >
              <span className="swatch" aria-hidden />
              <span>{emoLabel}</span>
            </span>
            <span className="lang-tag" title="Detected language">
              {langLabel}
            </span>
            {intentLabel && (
              <span className="intent-tag" title="Detected intent">
                {intentLabel}
              </span>
            )}
          </div>
        )}

        {/* Per-message action row: Listen (TTS) + English reveal. Always LTR chrome. */}
        {committed && (
          <div className="msg-actions" dir="ltr">
            <button
              className={`msg-action${isSpeakingThis ? ' on' : ''}`}
              onClick={() => onSpeak(msg)}
              aria-pressed={isSpeakingThis}
              title={isSpeakingThis ? 'Stop' : 'Listen'}
            >
              {isSpeakingThis ? (
                <Square size={13} aria-hidden />
              ) : (
                <Volume2 size={13} aria-hidden />
              )}
              <span>{isSpeakingThis ? 'Stop' : 'Listen'}</span>
            </button>

            {canToggleEn && (
              <button
                className="en-toggle"
                onClick={() => setShowEn(v => !v)}
                aria-pressed={showEn}
              >
                {showEn ? '↩ Original' : '🌐 EN'}
              </button>
            )}
          </div>
        )}

        {/* RAG sources panel */}
        {committed && sources.length > 0 && (
          <SourcesPanel sources={sources} lang={lang} />
        )}

        {/* Generative-UI widget, rendered below the bubble */}
        {widgetData && (
          <WidgetRenderer
            type={widgetData.type}
            onAction={onAction}
            sessionEmotions={sessionEmotions}
          />
        )}
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function MessageBubble({
  message,
  status,
  speakingId,
  onSpeak,
  onAction,
  sessionEmotions,
}: MessageBubbleProps) {
  if (message.role === 'user') return <UserBubble msg={message} />
  if (message.role === 'assistant') {
    return (
      <AssistantBubble
        msg={message}
        status={status}
        speakingId={speakingId}
        onSpeak={onSpeak}
        onAction={onAction}
        sessionEmotions={sessionEmotions}
      />
    )
  }
  return null
}
