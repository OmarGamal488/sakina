"""Pydantic schemas for the Sakina ``/chat`` API and its SSE event payloads.

SSE contract: meta → {emotion, intent, language, sources, kind};
delta → {text}; done → {id, role, emotion, time, text, kind}.
The reply is generated in the user's DETECTED language (20-language scope); the
``text`` dict is keyed by that language code and also carries an ``"en"`` fallback.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# 6 DAIR emotions + 5 intents — the locked label sets across the whole system.
Emotion = Literal["sadness", "joy", "love", "anger", "fear", "surprise"]
Intent = Literal[
    "greeting", "goodbye", "gratitude", "asking_mental_health_question", "out_of_scope"
]


class ChatRequest(BaseModel):
    """Incoming user message."""

    message: str = Field(..., min_length=1)
    lang: str | None = None          # optional UI language hint (ISO 639-1)
    session_lang: str | None = None  # the previous turn's detected language (robustness prior)
    session_id: str | None = None    # session key for Redis conversation memory + prior_lang
    trusted_person_email: str | None = None
    user_name: str | None = None


class TTSRequest(BaseModel):
    """Text to speak aloud via Groq Orpheus TTS."""

    text: str = Field(..., min_length=1)
    lang: str = "en"  # 'ar' → Saudi Arabic voice; anything else → English voice


class Source(BaseModel):
    """A retrieved RAG passage surfaced in the ``meta`` frame."""

    text: str
    context: str
    score: float


class MetaEvent(BaseModel):
    """First SSE frame — everything known before generation."""

    emotion: Emotion
    intent: Intent | None = None
    language: str
    sources: list[Source] = Field(default_factory=list)
    kind: Literal["crisis", "journal"] | None = None


class DeltaEvent(BaseModel):
    """A streamed chunk of the English reply."""

    text: str


class DoneEvent(BaseModel):
    """Final SSE frame — the complete bilingual message (matches the demo contract)."""

    id: str
    role: Literal["assistant", "system"] = "assistant"
    emotion: Emotion
    time: str
    text: dict[str, str]  # {"en": ..., "ar": ...}
    kind: Literal["crisis", "journal"] | None = None
