/**
 * useSpeechInput — record mic audio with MediaRecorder, then transcribe it via the
 * backend `/stt` endpoint (Groq Whisper, server-side). The transcript is handed to
 * `onTranscript` (the Composer fills it into the input for review before sending).
 *
 * The Groq key never reaches the browser — we only upload the recording.
 */

import { useCallback, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export interface SpeechInput {
  recording: boolean
  transcribing: boolean
  supported: boolean
  error: string | null
  toggle: () => void
}

export function useSpeechInput(onTranscript: (text: string) => void): SpeechInput {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  const start = useCallback(async () => {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone unavailable')
      return
    }
    const rec = new MediaRecorder(stream)
    recorderRef.current = rec
    chunksRef.current = []

    rec.ondataavailable = e => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setRecording(false)
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
      if (!blob.size) return
      setTranscribing(true)
      try {
        const ext = (rec.mimeType || '').includes('ogg') ? 'ogg' : 'webm'
        const fd = new FormData()
        fd.append('audio', blob, `speech.${ext}`)
        const res = await fetch(`${API_URL}/stt`, { method: 'POST', body: fd })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { text?: string }
        const text = data.text?.trim()
        if (text) onTranscript(text)
      } catch {
        setError('Transcription failed — try again')
      } finally {
        setTranscribing(false)
      }
    }

    rec.start()
    setRecording(true)
  }, [onTranscript])

  const toggle = useCallback(() => {
    if (recording) {
      recorderRef.current?.stop()
    } else if (!transcribing) {
      void start()
    }
  }, [recording, transcribing, start])

  return { recording, transcribing, supported, error, toggle }
}
