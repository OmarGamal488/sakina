"""Pipeline orchestrator: language → emotion → intent → route(RAG) → compose.

Emotion (local) and intent (network) run concurrently; blocking inference is
offloaded to a threadpool. The reply is composed in the user's DETECTED language,
but RAG retrieves on the English query. RAG runs only for
``asking_mental_health_question``.
"""

from __future__ import annotations

import asyncio
import json
import random
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
    "ar": "Arabic",
    "bg": "Bulgarian",
    "de": "German",
    "el": "Greek",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "hi": "Hindi",
    "it": "Italian",
    "ja": "Japanese",
    "nl": "Dutch",
    "pl": "Polish",
    "pt": "Portuguese",
    "ru": "Russian",
    "sw": "Swahili",
    "th": "Thai",
    "tr": "Turkish",
    "ur": "Urdu",
    "vi": "Vietnamese",
    "zh": "Chinese",
}

_INTENT_GUIDANCE = {
    "greeting": "The user is greeting you. Warmly greet them back and invite them to share how they're feeling.",
    "goodbye": "The user is leaving. Offer a warm, caring goodbye and remind them you're here whenever they return.",
    "gratitude": "The user is thanking you. Receive it warmly and keep the door gently open.",
    "asking_mental_health_question": "The user is sharing a feeling or asking for support. Validate their experience and offer gentle, grounded support.",
    "out_of_scope": "The user's message is outside mental-health support. Briefly, kindly acknowledge it, then gently steer back to how they're feeling.",
}

_FALLBACK = "I'm here with you. Would you like to tell me a little more about how you're feeling?"

# Fixed replies per non-mental-health intent (random variant each turn for variety);
# language adapted via LLM/NLLB. Mental-health turns get the full compose, not these.
_CANNED = {
    "greeting": [
        "Hello, I'm really glad you're here. I'm Sakina — a calm, safe space to talk. "
        "How are you feeling right now?",
        "Hi, it's good to see you. I'm Sakina, and I'm here to listen. What's on your mind today?",
        "Welcome. I'm Sakina — there's no rush here. How are you doing right now?",
    ],
    "goodbye": [
        "Take gentle care of yourself. I'm here whenever you'd like to talk again — "
        "you're never alone.",
        "Be kind to yourself today. I'll be right here whenever you want to come back.",
        "Take care for now. Whenever you need a calm space, I'll be here waiting.",
    ],
    "gratitude": [
        "I'm really glad it helped. I'm here for you anytime — what you feel always matters.",
        "It means a lot that you shared that. I'm always here whenever you need me.",
        "I'm touched — thank you. You can come back anytime; your feelings always matter here.",
    ],
    "out_of_scope": [
        "I hear you, though that's a little outside what I'm here for. I'm Sakina — here to "
        "support how you're feeling. Is there anything on your mind you'd like to share?",
        "That's a bit beyond what I can help with, but I'm glad you're here. I'm Sakina — "
        "how are you feeling right now?",
        "I may not be the right place for that one. What I'm here for is you — is there "
        "something you'd like to talk through?",
    ],
}


def _localize_canned(intent: str, language: str) -> str:
    """A random variant for *intent*, rendered in *language* (LLM, NLLB fallback, base
    English last). Cached per (intent, variant, language)."""
    variants = _CANNED[intent]
    idx = random.randrange(len(variants))
    base = variants[idx]
    if language == "en":
        return base

    mem = memory.get_memory()
    cache_key = f"canned:{intent}:{idx}:{language}"
    cached = mem.cache_get(cache_key)
    if cached:
        return cached

    lang_name = LANG_NAMES.get(language, "the user's language")
    reply = ""
    try:
        r = _get_llm().chat.completions.create(
            model=settings.lightning_model,
            temperature=0.0,
            max_tokens=512,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"Translate the user's message into {lang_name}, preserving its warm, "
                        "gentle tone. Output ONLY the translated message — no quotes, no notes."
                    ),
                },
                {"role": "user", "content": base},
            ],
        )
        reply = (r.choices[0].message.content or "").strip()
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "canned_localize_llm_error", error=str(e)[:100], intent=intent, lang=language
        )

    if not reply:
        # LLM unavailable/empty → local NLLB (still localized, never English to a non-EN user).
        try:
            emo = emotion_mod.get_classifier()
            tgt = emo.flores_code(language)
            if tgt:
                reply = emo.translate(base, emo.flores_code("en"), tgt)
        except Exception as e:  # noqa: BLE001
            logger.warning("canned_localize_nllb_error", error=str(e)[:100], lang=language)

    reply = reply or base
    mem.cache_set(cache_key, reply)
    return reply


@dataclass
class PipelineResult:
    """Everything known about a turn before generation (drives the ``meta`` frame)."""

    language: str
    emotion: str
    intent: str | None
    english_query: str = ""  # English version of the message (for grounding)
    sources: list[dict] = field(default_factory=list)


_llm: OpenAI | None = None


def _get_llm() -> OpenAI:
    global _llm
    if _llm is None:
        # The OpenAI client refuses to construct with an empty api_key, which would
        # crash startup / health on a keyless container (CI, fresh deploy). Pass a
        # placeholder so it constructs; a real call still 401s clearly if the key is
        # genuinely missing — but /health and boot stay green without secrets.
        _llm = OpenAI(
            base_url=settings.lightning_base_url,
            api_key=settings.lightning_api_key or "missing-key",
        )
    return _llm


def warmup() -> None:
    """Warm the model singletons at startup.

    Default (``WARMUP_HEAVY`` unset/false): load only the CHEAP, local-artifact
    singletons (language detector + memory) so the container becomes healthy in
    seconds without any API keys. The LLM client and the heavy HF models —
    emotion+NLLB (~5 GB) and RAG
    bge-m3+reranker (~4.6 GB) — stay lazy and load on the first request that needs
    them. This keeps cold starts fast and the image small for free-tier hosting.

    Set ``WARMUP_HEAVY=1`` to pre-load everything (useful locally / on a warm box).
    """
    import os

    language_id.get_detector()
    memory.get_memory()
    if os.getenv("WARMUP_HEAVY", "").lower() in ("1", "true", "yes"):
        _get_llm()
        emotion_mod.get_classifier()
        intent_mod.get_classifier()
        rag_mod.get_retriever()
        logger.info("orchestrator_warm", heavy=True)
    else:
        logger.info("orchestrator_warm", heavy=False)


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

    # Non-mental-health turns keep a steady joy face (avatar doesn't mirror the mood).
    is_mh = intent_res.intent == "asking_mental_health_question"
    emotion_label = emo.emotion if is_mh else "joy"

    logger.info(
        "analyze",
        language=lang,
        emotion=emotion_label,
        intent=intent_res.intent,
        n_sources=len(sources),
    )
    return PipelineResult(
        language=lang,
        emotion=emotion_label,
        intent=intent_res.intent,
        english_query=emo.translated_text,
        sources=sources,
    )


def _compose_messages(
    message: str, result: PipelineResult, history: list[dict] | None = None
) -> list[dict]:
    lang_name = LANG_NAMES.get(result.language, "the user's language")
    guidance = _INTENT_GUIDANCE.get(
        result.intent or "", _INTENT_GUIDANCE["asking_mental_health_question"]
    )
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
    """Reply in the user's language, streamed as small word-chunks for the SSE ``delta``
    UX. Non-mental-health intents return a fixed (localized) message; mental-health turns
    get a full emotion- and RAG-shaped LLM compose. ``history`` injects prior turns."""
    # Non-mental-health intents → fixed, language-adapted message (no free composition).
    if result.intent in _CANNED:
        reply = await run_in_threadpool(_localize_canned, result.intent, result.language)
    else:
        messages = _compose_messages(message, result, history)

        def _call() -> str:
            try:
                r = _get_llm().chat.completions.create(
                    model=settings.lightning_model,
                    temperature=0.6,
                    max_tokens=400,
                    messages=messages,
                )
                return (r.choices[0].message.content or "").strip() or _FALLBACK
            except Exception as e:  # noqa: BLE001
                logger.warning("compose_error", error=str(e)[:100])
                return _FALLBACK

        reply = await run_in_threadpool(_call)
    words = reply.split(" ")
    for i in range(0, len(words), 3):
        chunk = " ".join(words[i : i + 3])
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
