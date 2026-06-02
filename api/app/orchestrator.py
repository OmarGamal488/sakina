"""Pipeline orchestrator: language → emotion → intent → route(RAG) → compose.

Emotion (local) and intent (network) run concurrently; blocking inference is
offloaded to a threadpool. The reply is composed in the user's DETECTED language,
but RAG retrieves on the English query. RAG runs only for
``asking_mental_health_question``.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import structlog
from openai import OpenAI
from starlette.concurrency import run_in_threadpool

from app import memory
from app.config import settings
from app.models import emotion as emotion_mod
from app.models import intent as intent_mod
from app.models import language_id
from app.models import rag as rag_mod

logger = structlog.get_logger(__name__)

LANG_NAMES = {
    "ar": "Arabic", "bg": "Bulgarian", "de": "German", "el": "Greek", "en": "English",
    "es": "Spanish", "fr": "French", "hi": "Hindi", "it": "Italian", "ja": "Japanese",
    "nl": "Dutch", "pl": "Polish", "pt": "Portuguese", "ru": "Russian", "sw": "Swahili",
    "th": "Thai", "tr": "Turkish", "ur": "Urdu", "vi": "Vietnamese", "zh": "Chinese",
}

_INTENT_GUIDANCE = {
    "greeting": "The user is greeting you. Warmly greet them back and invite them to share how they're feeling.",
    "goodbye": "The user is leaving. Offer a warm, caring goodbye and remind them you're here whenever they return.",
    "gratitude": "The user is thanking you. Receive it warmly and keep the door gently open.",
    "asking_mental_health_question": "The user is sharing a feeling or asking for support. Validate their experience and offer gentle, grounded support.",
    "out_of_scope": "The user's message is outside mental-health support. Briefly, kindly acknowledge it, then gently steer back to how they're feeling.",
}

_FALLBACK = "I'm here with you. Would you like to tell me a little more about how you're feeling?"


@dataclass
class PipelineResult:
    """Everything known about a turn before generation (drives the ``meta`` frame)."""

    language: str
    emotion: str
    intent: str | None
    english_query: str = ""          # English version of the message (for grounding)
    sources: list[dict] = field(default_factory=list)


_llm: OpenAI | None = None


def _get_llm() -> OpenAI:
    global _llm
    if _llm is None:
        _llm = OpenAI(base_url=settings.lightning_base_url, api_key=settings.lightning_api_key)
    return _llm


def warmup() -> None:
    """Load all model singletons once (blocking).  Called from the app lifespan."""
    language_id.get_detector()
    emotion_mod.get_classifier()
    intent_mod.get_classifier()
    rag_mod.get_retriever()
    memory.get_memory()
    _get_llm()
    logger.info("orchestrator_warm")


async def analyze(
    message: str,
    lang_hint: str | None = None,
    session_lang: str | None = None,
) -> PipelineResult:
    """Detect language → emotion (local) + intent (LLM) concurrently → RAG (if needed)."""
    detector = language_id.get_detector()
    det = await run_in_threadpool(detector.detect, message, session_lang or lang_hint)
    lang = det.lang

    emo_clf = emotion_mod.get_classifier()
    int_clf = intent_mod.get_classifier()
    emo, intent_res = await asyncio.gather(
        run_in_threadpool(emo_clf.classify, message, lang),
        run_in_threadpool(int_clf.classify, message),
    )

    # RAG only for mental-health questions; retrieve on the English query.
    # Cache keyed by the English query skips the BM25+dense+RRF+rerank pass for
    # repeated questions (retrieval is deterministic; the reply is NOT cached).
    sources: list[dict] = []
    if intent_res.intent == "asking_mental_health_question":
        mem = memory.get_memory()
        cache_key = "rag:" + emo.translated_text.strip().lower()
        cached = mem.cache_get(cache_key)
        if cached is not None:
            sources = json.loads(cached)
        else:
            retriever = rag_mod.get_retriever()
            passages = await run_in_threadpool(retriever.retrieve, emo.translated_text)
            sources = [p.as_dict() for p in passages]
            mem.cache_set(cache_key, json.dumps(sources))

    logger.info(
        "analyze", language=lang, emotion=emo.emotion,
        intent=intent_res.intent, n_sources=len(sources),
    )
    return PipelineResult(
        language=lang, emotion=emo.emotion, intent=intent_res.intent,
        english_query=emo.translated_text, sources=sources,
    )


def _compose_messages(
    message: str, result: PipelineResult, history: list[dict] | None = None
) -> list[dict]:
    lang_name = LANG_NAMES.get(result.language, "the user's language")
    guidance = _INTENT_GUIDANCE.get(result.intent or "", _INTENT_GUIDANCE["asking_mental_health_question"])
    notes_block = ""
    if result.sources:
        notes = "\n".join(f"[{i + 1}] {s['text']}" for i, s in enumerate(result.sources))
        notes_block = (
            "\nGround any supportive suggestions ONLY in these counselor notes — "
            f"do not invent specifics:\n{notes}\n"
        )
    system = (
        "You are Sakina, a warm, careful, multilingual mental-health support companion. "
        f"Reply in {lang_name}. Keep it brief (2-4 sentences), empathetic, validating, and "
        f"human — never clinical or preachy. The user currently feels {result.emotion}. "
        f"{guidance}{notes_block} "
        "Do not diagnose, prescribe, or give medical advice. Gently invite them to share "
        "more. Never claim to be a licensed professional."
    )
    # Prior turns go between the system prompt and the current message for context.
    msgs: list[dict] = [{"role": "system", "content": system}]
    for turn in history or []:
        role = turn.get("role")
        content = turn.get("text", "")
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": message})
    return msgs


async def stream_reply(
    message: str, result: PipelineResult, history: list[dict] | None = None
) -> AsyncIterator[str]:
    """Compose an empathetic reply in the user's language (one LLM call), streamed as
    small word-chunks for the SSE ``delta`` UX. ``history`` injects prior turns."""
    messages = _compose_messages(message, result, history)

    def _call() -> str:
        try:
            r = _get_llm().chat.completions.create(
                model=settings.lightning_model, temperature=0.6, max_tokens=400, messages=messages
            )
            return (r.choices[0].message.content or "").strip() or _FALLBACK
        except Exception as e:  # noqa: BLE001
            logger.warning("compose_error", error=str(e)[:100])
            return _FALLBACK

    reply = await run_in_threadpool(_call)
    words = reply.split(" ")
    for i in range(0, len(words), 3):
        chunk = " ".join(words[i:i + 3])
        yield chunk + (" " if i + 3 < len(words) else "")


async def build_text(reply: str, language: str) -> dict[str, str]:
    """Reply keyed by the user's language + an English pane (via the emotion module's NLLB)."""
    if language == "en":
        return {"en": reply}
    emo_clf = emotion_mod.get_classifier()
    src = emo_clf.flores_code(language)
    if not src:
        return {language: reply, "en": reply}
    english = await run_in_threadpool(emo_clf.translate, reply, src)
    return {language: reply, "en": english}
