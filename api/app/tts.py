"""Text-to-speech via Groq Orpheus (OpenAI-compatible ``/audio/speech``).

Orpheus offers an expressive English voice and an authentic Saudi-Arabic voice —
the two UI/reply-priority languages for Sakina.  For any other detected language
the caller sends the English translation, spoken by the English voice.

Two Orpheus constraints handled here:
  * **200-character input limit** — replies are split into <=200-char chunks on
    sentence boundaries, synthesized separately, and the WAV segments are merged.
  * model + voice are chosen by language (``ar`` → Saudi model/voice, else English).

The Groq key stays server-side; the browser only receives the finished audio.
"""

from __future__ import annotations

import io
import re
import wave

import structlog
from openai import OpenAI

from app.config import settings

logger = structlog.get_logger(__name__)

_MAX_CHARS = 200
# Split after sentence enders (Latin + Arabic) or newlines, keeping the delimiter.
_SENT_SPLIT = re.compile(r"(?<=[.!?؟…\n])\s+")

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=settings.groq_base_url, api_key=settings.groq_api_key)
        logger.info("tts_client_ready")
    return _client


def _chunk(text: str, limit: int = _MAX_CHARS) -> list[str]:
    """Pack text into <=limit-char chunks on sentence boundaries (hard-split if needed)."""
    text = text.strip()
    if len(text) <= limit:
        return [text] if text else []
    chunks: list[str] = []
    current = ""
    for sentence in _SENT_SPLIT.split(text):
        piece = sentence.strip()
        if not piece:
            continue
        if len(current) + len(piece) + 1 <= limit:
            current = f"{current} {piece}".strip()
            continue
        if current:
            chunks.append(current)
            current = ""
        while len(piece) > limit:  # a single sentence longer than the limit
            chunks.append(piece[:limit])
            piece = piece[limit:]
        current = piece
    if current:
        chunks.append(current)
    return chunks


def _merge_wavs(segments: list[bytes]) -> bytes:
    """Concatenate same-format WAV byte blobs into one WAV (PCM frame join)."""
    if len(segments) == 1:
        return segments[0]
    out = io.BytesIO()
    writer: wave.Wave_write | None = None
    try:
        for seg in segments:
            with wave.open(io.BytesIO(seg), "rb") as r:
                if writer is None:
                    # writer spans the loop (header from the first segment); closed in finally.
                    writer = wave.open(out, "wb")  # noqa: SIM115
                    writer.setnchannels(r.getnchannels())
                    writer.setsampwidth(r.getsampwidth())
                    writer.setframerate(r.getframerate())
                writer.writeframes(r.readframes(r.getnframes()))
    finally:
        if writer is not None:
            writer.close()
    return out.getvalue()


def synthesize(text: str, lang: str = "en") -> bytes:
    """Synthesize *text* to WAV audio bytes via Groq Orpheus (model/voice by *lang*)."""
    is_ar = lang == "ar"
    model = settings.groq_tts_model_ar if is_ar else settings.groq_tts_model_en
    voice = settings.groq_tts_voice_ar if is_ar else settings.groq_tts_voice_en
    client = _get_client()

    segments: list[bytes] = []
    for chunk in _chunk(text):
        resp = client.audio.speech.create(
            model=model, voice=voice, input=chunk, response_format="wav"
        )
        segments.append(resp.content)
    if not segments:
        return b""
    logger.info("tts_ok", lang=lang, chunks=len(segments))
    return _merge_wavs(segments)
