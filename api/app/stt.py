"""Speech-to-text via Groq Whisper (OpenAI-compatible endpoint).

The browser records audio (MediaRecorder) and POSTs it to ``/stt``; this module
calls Groq's hosted Whisper **server-side** so the API key never reaches the
client.  Groq accepts common container formats (webm/ogg/wav/mp3/m4a/…), so the
browser's native ``audio/webm`` recording is sent through as-is — no transcoding.

Lightning's Omni model was evaluated first but its deployment 500s on audio input
(text-only serving), so STT is delegated to Groq.  Returns plain text; the existing
text pipeline (language → emotion → intent → RAG) runs on the transcript unchanged.
"""

from __future__ import annotations

import structlog
from openai import OpenAI

from app.config import settings

logger = structlog.get_logger(__name__)

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """Lazy Groq client (OpenAI SDK pointed at Groq's base URL)."""
    global _client
    if _client is None:
        _client = OpenAI(base_url=settings.groq_base_url, api_key=settings.groq_api_key)
        logger.info("stt_client_ready", model=settings.groq_stt_model)
    return _client


def transcribe(audio: bytes, filename: str = "audio.webm") -> str:
    """Transcribe recorded audio bytes to text via Groq Whisper."""
    r = _get_client().audio.transcriptions.create(
        model=settings.groq_stt_model,
        file=(filename, audio),
        temperature=0.0,  # deterministic transcription
        # `language` intentionally omitted → Whisper auto-detects (Sakina spans 20 languages).
    )
    return (r.text or "").strip()
