/**
 * App.tsx — root component (AI SDK v6 migration).
 *
 * Wiring:
 *   transport  →  DefaultChatTransport → POST /chat/ui (AI SDK UI message stream)
 *   useChat    →  @ai-sdk/react useChat<SakinaUIMessage>
 *   state      →  messages, status, setMessages (clear), stop (abort)
 *
 * English UI (LTR). Message *content* keeps its own language direction
 * (Arabic reply reads RTL inside a left-anchored bubble).
 */

import { useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isDataUIPart } from 'ai'
import { TopBar } from './components/TopBar'
import { PresenceHeader } from './components/PresenceHeader'
import { MessageBubble } from './components/MessageBubble'
import { TypingIndicator } from './components/TypingIndicator'
import { Composer } from './components/Composer'
import { IdleNudge, IdlePresence } from './components/IdlePresence'
import { useTextToSpeech } from './hooks/useTextToSpeech'
import { useIdlePresence } from './hooks/useIdlePresence'
import { API_URL } from './lib/api'
import type { SakinaDataTypes, SakinaUIMessage, Emotion, LangCode } from './lib/types'
import { EMOTION_COLORS, DEFAULT_EMOTION } from './lib/emotion'

const SESSION_KEY = 'sakina_session_id'

/** Stable, unguessable per-browser session id for server-side conversation memory. */
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

const STARTER_PROMPTS = [
  "I've been feeling anxious lately",
  "I can't sleep and my mind won't stop",
  "I feel disconnected from everyone",
  "I just need someone to talk to",
]

/** Extract meta.emotion from an assistant message's parts */
function extractEmotion(msg: SakinaUIMessage): Emotion {
  for (const p of msg.parts) {
    if (isDataUIPart(p) && p.type === 'data-meta') {
      return (p.data as SakinaDataTypes['meta']).emotion
    }
  }
  return DEFAULT_EMOTION
}

/** Extract detected language from the meta part */
function extractLang(msg: SakinaUIMessage): LangCode {
  for (const p of msg.parts) {
    if (isDataUIPart(p) && p.type === 'data-meta') {
      return (p.data as SakinaDataTypes['meta']).language
    }
  }
  return 'en'
}

/** Extract the best TTS text: AR → data-text.ar, else → data-text.en, else streaming text */
function extractTTSText(msg: SakinaUIMessage, lang: LangCode): string {
  for (const p of msg.parts) {
    if (isDataUIPart(p) && p.type === 'data-text') {
      const d = p.data as SakinaDataTypes['text']
      return d[lang] ?? d.en ?? ''
    }
  }
  for (const p of msg.parts) {
    if (p.type === 'text') return p.text
  }
  return ''
}

export default function App() {
  // Unguessable session id (persisted) → sent with every /chat/ui request so the
  // backend keys Redis conversation memory. Held in a ref so request-building always
  // reads the current value (survives rotation when the user starts a new chat).
  const sessionIdRef = useRef<string>(getSessionId())
  const { messages, sendMessage, status, setMessages, stop } = useChat<SakinaUIMessage>({
    transport: new DefaultChatTransport({
      api: `${API_URL}/chat/ui`,
      // Server is the source of truth for history → send only the latest message +
      // the session id; prior turns are loaded from Redis by session_id.
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages: messages.slice(-1), session_id: sessionIdRef.current },
      }),
    }),
  })

  // Text-to-speech — shared instance so only one clip plays at a time
  const { speakingId, speak, stop: stopSpeaking } = useTextToSpeech()

  const bottomRef = useRef<HTMLDivElement>(null)
  const hasMessages = messages.length > 0

  // Derive current emotion from the latest assistant message (direct, no useEffect)
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const currentEmotion: Emotion = lastAssistant ? extractEmotion(lastAssistant) : DEFAULT_EMOTION

  // Session emotion array for MoodChart — one entry per assistant message in order
  const sessionEmotions: Emotion[] = messages
    .filter(m => m.role === 'assistant')
    .map(m => extractEmotion(m))

  const isSpeaking = status === 'streaming' || status === 'submitted' || speakingId !== null

  // Idle "presence" check-in: only while there are messages and nothing is streaming.
  const { stage: idleStage, reset: dismissIdle } = useIdlePresence({
    enabled: hasMessages && status === 'ready',
  })
  const idleLang: LangCode = lastAssistant ? extractLang(lastAssistant) : 'en'

  const onSpeak = (msg: SakinaUIMessage) => {
    if (speakingId === msg.id) {
      stopSpeaking()
      return
    }
    const lang = extractLang(msg)
    const text = extractTTSText(msg, lang)
    if (!text) return
    // Orpheus covers en + ar; for other languages fall back to English TTS
    void speak(msg.id, text, lang === 'ar' ? 'ar' : 'en')
  }

  const onAction = (text: string) => {
    void sendMessage({ text })
  }

  const onClear = () => {
    void stop()
    setMessages([])
    // Start a fresh server-side conversation (don't bleed memory across "New chat").
    const fresh = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, fresh)
    sessionIdRef.current = fresh
  }

  // Auto-scroll on new content, respecting prefers-reduced-motion
  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [messages])

  const emoColor = EMOTION_COLORS[currentEmotion] ?? '#E4B363'
  const appStyle = {
    '--emo': emoColor,
    '--emo-soft': `${emoColor}22`,
  } as unknown as React.CSSProperties

  return (
    <div className="app-shell" style={appStyle} dir="ltr" lang="en">
      <div className={`chat-card${idleStage >= 1 ? ' idle-attentive' : ''}`}>
        <TopBar onClear={onClear} />
        <PresenceHeader emotion={currentEmotion} isSpeaking={isSpeaking} />

        {hasMessages ? (
          <div
            className="messages-region"
            role="log"
            aria-label="Chat with Sakina"
            aria-live="polite"
            aria-atomic={false}
          >
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                status={status}
                speakingId={speakingId}
                onSpeak={onSpeak}
                onAction={onAction}
                sessionEmotions={sessionEmotions}
              />
            ))}
            {/* Show typing dots during the submitted→streaming gap (LLM TTFT).
                Only needed when the last visible message is still the user's bubble,
                i.e. the assistant message hasn't appeared in the stream yet. */}
            {status === 'submitted' &&
              messages.length > 0 &&
              messages[messages.length - 1].role === 'user' && (
                <TypingIndicator />
              )}
            <div ref={bottomRef} aria-hidden />
          </div>
        ) : (
          <div className="messages-region" style={{ flex: 1, overflow: 'hidden' }}>
            <div className="empty-state">
              <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 320, margin: 0 }}>
                Hi. I&apos;m here to listen. You can start with whatever you&apos;re feeling right
                now.
              </p>
              <div className="empty-prompts" role="group" aria-label="Conversation starters">
                {STARTER_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    className="prompt-chip"
                    onClick={() => void sendMessage({ text: prompt })}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stage 1 idle nudge — quiet line just above the composer */}
        {idleStage === 1 && <IdleNudge lang={idleLang} />}

        <Composer
          status={status}
          onSend={text => void sendMessage({ text })}
          onStop={() => void stop()}
        />

        {/* Stage 2 idle presence — centered-avatar overlay; any interaction dismisses.
            Always the warm (joy) presence — a caring "I'm still here", NOT a mirror of
            the user's last mood (which may be sad/anxious). */}
        {idleStage === 2 && (
          <IdlePresence lang={idleLang} emotion={DEFAULT_EMOTION} onDismiss={dismissIdle} />
        )}
      </div>
    </div>
  )
}
