/**
 * Composer — the message input area (English UI; LTR).
 * - Autogrowing textarea (max 144px); `dir="auto"` so typed Arabic still reads RTL
 * - Enter to send, Shift+Enter for newline
 * - Send ↔ Stop button swap based on status
 * - Voice input (mic → backend /stt → fills the input)
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { Loader2, Mic, Send, Square } from 'lucide-react'
import type { ChatStatus } from '../lib/types'
import { useSpeechInput } from '../hooks/useSpeechInput'

interface ComposerProps {
  status: ChatStatus
  onSend: (text: string) => void
  onStop: () => void
}

export function Composer({ status, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const isStreaming = status === 'streaming' || status === 'submitted'

  // Voice input: record → backend /stt (Groq Whisper) → append transcript for review.
  const speech = useSpeechInput(t => setValue(v => (v ? v.trimEnd() + ' ' : '') + t))

  // Auto-resize textarea
  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }, [value])

  const submit = () => {
    const v = value.trim()
    if (!v || isStreaming) return
    onSend(v)
    setValue('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !isStreaming

  return (
    <div className="composer-wrap">
      <div className="composer-box">
        <textarea
          ref={taRef}
          className="composer-input"
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Take your time…"
          aria-label="Send a message to Sakina"
          aria-multiline="true"
          dir="auto"
        />
        {isStreaming ? (
          <button
            className="send-btn stop"
            onClick={onStop}
            aria-label="Stop generation"
            title="Stop"
          >
            <Square size={16} aria-hidden />
          </button>
        ) : (
          <button
            className={`send-btn${canSend ? ' live' : ''}`}
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <Send size={16} aria-hidden />
          </button>
        )}
      </div>
      <div className="composer-foot">
        <div className="composer-foot-left">
          {speech.supported && (
            <button
              className={`foot-btn${speech.recording ? ' rec' : ''}`}
              onClick={speech.toggle}
              disabled={isStreaming || speech.transcribing}
              aria-pressed={speech.recording}
              title={speech.recording ? 'Stop recording' : 'Speak'}
              aria-label={speech.recording ? 'Stop recording' : 'Record a voice message'}
            >
              {speech.transcribing ? (
                <Loader2 size={12} className="spin" aria-hidden />
              ) : speech.recording ? (
                <Square size={12} aria-hidden />
              ) : (
                <Mic size={12} aria-hidden />
              )}
              <span>
                {speech.transcribing ? 'Transcribing…' : speech.recording ? 'Listening…' : 'Voice'}
              </span>
            </button>
          )}
        </div>
        <span>
          {speech.error
            ? speech.error
            : value.length > 0
              ? value.length
              : 'Enter ⏎ · Shift+⏎ newline'}
        </span>
      </div>
    </div>
  )
}
