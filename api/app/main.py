"""Sakina FastAPI app — ``/chat`` (SSE) + ``/healthz``.

Pipeline: language → emotion → intent → RAG → LLM compose. A model-free crisis
regex gate runs FIRST in ``/chat`` and ``/chat/ui``, short-circuiting to a crisis
card with no RAG/LLM call.
"""

from __future__ import annotations

import asyncio
import json
from urllib import request as urlrequest
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import structlog
from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from starlette.concurrency import run_in_threadpool

from app import memory, orchestrator, safety, widgets
from app import stt as stt_service
from app import tts as tts_service
from app.config import settings
from app.schemas import ChatRequest, TTSRequest

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifespan — warm the model singletons once at startup."""
    logger.info("sakina_api_start", model=settings.lightning_model)
    await run_in_threadpool(orchestrator.warmup)
    logger.info("sakina_api_ready")
    yield
    logger.info("sakina_api_stop")


app = FastAPI(title="Sakina API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now() -> str:
    return datetime.now(UTC).strftime("%H:%M")


def _sse(event: str, payload: dict) -> dict:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _post_crisis_help_webhook(name: str, email: str) -> None:
    payload = json.dumps(
        {"intent": "help", "name": name, "email": email}, ensure_ascii=False
    ).encode("utf-8")
    req = urlrequest.Request(
        settings.crisis_help_webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=10) as response:
        response.read()
        logger.info("crisis_help_webhook_sent", status=response.status, email=email)


async def _notify_trusted_person(name: str | None, email: str | None) -> None:
    clean_name = _clean(name)
    clean_email = _clean(email)
    if not clean_name or not clean_email:
        logger.info(
            "crisis_help_webhook_skipped",
            has_name=bool(clean_name),
            has_email=bool(clean_email),
        )
        return
    try:
        await run_in_threadpool(_post_crisis_help_webhook, clean_name, clean_email)
    except Exception as exc:  # noqa: BLE001
        logger.warning("crisis_help_webhook_error", error=str(exc)[:200], email=clean_email)


@app.get("/healthz")
async def healthz() -> dict:
    """Liveness probe — no models touched, returns instantly."""
    return {"status": "ok", "service": "sakina-api", "version": "0.1.0"}


@app.post("/stt")
async def stt(audio: UploadFile = File(...)) -> dict:
    """Transcribe an uploaded audio recording → text via Groq Whisper."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio upload")
    try:
        text = await run_in_threadpool(
            stt_service.transcribe, data, audio.filename or "audio.webm"
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("stt_error", error=str(e)[:200])
        raise HTTPException(status_code=502, detail="transcription failed") from e
    logger.info("stt_ok", chars=len(text))
    return {"text": text}


@app.post("/tts")
async def tts(req: TTSRequest) -> Response:
    """Synthesize an assistant reply to speech via Groq Orpheus. Returns ``audio/wav``."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty text")
    try:
        audio = await run_in_threadpool(tts_service.synthesize, text, req.lang)
    except Exception as e:  # noqa: BLE001
        logger.warning("tts_error", error=str(e)[:200])
        raise HTTPException(status_code=502, detail="speech synthesis failed") from e
    return Response(content=audio, media_type="audio/wav")


@app.post("/chat")
async def chat(req: ChatRequest):
    """Stream the assistant turn as Server-Sent Events: meta → delta* → done."""

    async def gen():
        # Crisis-safety gate — fires BEFORE any model call. Model-free.
        # FALSE POSITIVES ACCEPTABLE, FALSE NEGATIVES NOT. See app/safety.py.
        crisis = safety.check_crisis(req.message)
        if crisis.triggered:
            lang = crisis.lang_hint
            line = safety.SUPPORTIVE_LINE.get(lang, safety.SUPPORTIVE_LINE["en"])
            logger.info("crisis_gate", source="chat", lang=lang, pattern=crisis.pattern[:40])
            yield _sse(
                "meta",
                {"emotion": "sadness", "intent": None, "language": lang,
                 "sources": [], "kind": "crisis"},
            )
            words = line.split(" ")
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i:i + 3])
                yield _sse("delta", {"text": chunk + (" " if i + 3 < len(words) else "")})
            text = {lang: line}
            if lang != "en":
                text["en"] = safety.SUPPORTIVE_LINE["en"]
            yield _sse(
                "done",
                {"id": "a-" + uuid.uuid4().hex[:8], "role": "assistant",
                 "emotion": "sadness", "time": _now(), "text": text, "kind": "crisis"},
            )
            asyncio.create_task(_notify_trusted_person(req.user_name, req.trusted_person_email))
            return

        # Session memory: prior language + prior turns (empty session_id is a no-op).
        mem = memory.get_memory()
        sid = req.session_id or ""
        session_lang = req.session_lang or mem.get_prior_lang(sid)
        history = mem.get_history(sid)
        result = await orchestrator.analyze(
            req.message, lang_hint=req.lang, session_lang=session_lang
        )
        # meta — everything known before generation.
        yield _sse(
            "meta",
            {
                "emotion": result.emotion,
                "intent": result.intent,
                "language": result.language,
                "sources": result.sources,
                "kind": None,
            },
        )
        # delta — stream the reply in the user's language.
        parts: list[str] = []
        async for tok in orchestrator.stream_reply(req.message, result, history):
            parts.append(tok)
            yield _sse("delta", {"text": tok})
        # done — the complete, language-keyed message.
        full = "".join(parts)
        text = await orchestrator.build_text(full, result.language)
        yield _sse(
            "done",
            {
                "id": "a-" + uuid.uuid4().hex[:8],
                "role": "assistant",
                "emotion": result.emotion,
                "time": _now(),
                "text": text,
                "kind": None,
            },
        )
        # Persist this turn AFTER the reply completes.
        if sid:
            mem.append_turn(sid, "user", req.message)
            mem.append_turn(sid, "assistant", full)
            mem.set_prior_lang(sid, result.language)

    return EventSourceResponse(gen())


@app.post("/chat/ui")
async def chat_ui(request: Request) -> StreamingResponse:
    """Vercel AI SDK (v5) UI-message-stream variant of /chat for the generative-UI frontend.

    Emits a streamed ``text`` part plus custom ``data-*`` parts for emotion/intent/sources,
    the bilingual text dict, and the LLM-selected widget.
    """
    body = await request.json()
    msgs = body.get("messages", [])
    user_text = ""
    for m in reversed(msgs):
        if m.get("role") == "user":
            parts = m.get("parts") or []
            user_text = (
                " ".join(p.get("text", "") for p in parts if p.get("type") == "text").strip()
                or m.get("content", "")
            )
            break
    if not user_text:
        raise HTTPException(status_code=400, detail="no user message")
    session_id = (body.get("session_id") or "").strip()
    trusted_person_email = _clean(body.get("trusted_person_email"))
    user_name = _clean(body.get("user_name"))

    def _ai(obj: dict) -> bytes:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode()

    async def gen():
        mid = "msg-" + uuid.uuid4().hex[:10]
        tid = "txt-" + uuid.uuid4().hex[:8]
        yield _ai({"type": "start", "messageId": mid})

        # Crisis-safety gate — model-free, fires before analyze (no RAG/LLM on a
        # crisis turn). Mirrors the happy-path frame sequence so it renders reliably.
        crisis = safety.check_crisis(user_text)
        if crisis.triggered:
            lang = crisis.lang_hint
            line = safety.SUPPORTIVE_LINE.get(lang, safety.SUPPORTIVE_LINE["en"])
            logger.info("crisis_gate", source="chat_ui", lang=lang, pattern=crisis.pattern[:40])
            yield _ai({
                "type": "data-meta", "id": "meta",
                "data": {"emotion": "sadness", "intent": None, "language": lang,
                         "sources": [], "kind": "crisis"},
            })
            yield _ai({"type": "text-start", "id": tid})
            yield _ai({"type": "text-delta", "id": tid, "delta": line})
            yield _ai({"type": "text-end", "id": tid})
            text = {lang: line}
            if lang != "en":
                text["en"] = safety.SUPPORTIVE_LINE["en"]
            yield _ai({"type": "data-text", "id": "txt", "data": text})
            yield _ai({"type": "finish"})
            yield b"data: [DONE]\n\n"
            asyncio.create_task(_notify_trusted_person(user_name, trusted_person_email))
            return

        # Session memory: prior language + prior turns (empty session_id is a no-op).
        mem = memory.get_memory()
        prior_lang = mem.get_prior_lang(session_id)
        history = mem.get_history(session_id)
        result = await orchestrator.analyze(user_text, session_lang=prior_lang)
        yield _ai({
            "type": "data-meta",
            "id": "meta",
            "data": {
                "emotion": result.emotion,
                "intent": result.intent,
                "language": result.language,
                "sources": result.sources,
            },
        })

        # The LLM picks a generative-UI widget (mental-health turns only), concurrently.
        widget_task = None
        if result.intent == "asking_mental_health_question":
            widget_task = asyncio.create_task(
                run_in_threadpool(widgets.select_widget, user_text, result.emotion, result.intent)
            )

        yield _ai({"type": "text-start", "id": tid})
        parts: list[str] = []
        async for tok in orchestrator.stream_reply(user_text, result, history):
            parts.append(tok)
            yield _ai({"type": "text-delta", "id": tid, "delta": tok})
        yield _ai({"type": "text-end", "id": tid})

        if widget_task is not None:
            widget = await widget_task
            if widget:
                yield _ai({"type": "data-widget", "id": "widget", "data": {"type": widget}})

        full = "".join(parts)
        text_dict = await orchestrator.build_text(full, result.language)
        yield _ai({"type": "data-text", "id": "txt", "data": text_dict})

        # Persist this turn AFTER the reply completes.
        if session_id:
            mem.append_turn(session_id, "user", user_text)
            mem.append_turn(session_id, "assistant", full)
            mem.set_prior_lang(session_id, result.language)

        yield _ai({"type": "finish"})
        yield b"data: [DONE]\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"x-vercel-ai-ui-message-stream": "v1", "x-accel-buffering": "no"},
    )
