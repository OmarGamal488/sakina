/**
 * useTextToSpeech — speak a specific message via the backend `/tts` endpoint
 * (Groq Orpheus, server-side). The hook owns `speakingId` (the message currently
 * loading/playing) and clears it on EVERY outcome — playback end, audio error,
 * a non-OK response (e.g. 502), or an explicit stop — so the per-message button
 * never gets stuck. Only one clip plays at a time. The Groq key stays server-side.
 */

import { useCallback, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export interface TextToSpeech {
  /** id of the message currently loading/playing, or null */
  speakingId: string | null
  speak: (id: string, text: string, lang: string) => Promise<void>
  stop: () => void
}

export function useTextToSpeech(): TextToSpeech {
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setSpeakingId(null)
  }, [])

  const speak = useCallback(
    async (id: string, text: string, lang: string) => {
      stop()
      const clean = text.trim()
      if (!clean) return
      setSpeakingId(id) // mark active immediately (covers the loading phase)
      try {
        const res = await fetch(`${API_URL}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, lang }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = stop
        audio.onerror = stop
        await audio.play()
      } catch {
        stop() // 502 / network / autoplay-block → clear the indicator
      }
    },
    [stop],
  )

  return { speakingId, speak, stop }
}
