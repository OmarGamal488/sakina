"""Generative-UI widget selection.

After the reply is composed, the LLM decides whether ONE interactive support widget
would help this turn — a breathing exercise, a 5-4-3-2-1 grounding tool, a mood
check-in, a mood chart, or suggested next-step replies — or none.  The chosen type is
emitted as a ``widget`` SSE event; the frontend maps it to a React component.

This is the "generative" part: the model (not a hard-coded rule) chooses what to render,
informed by the user's message + the detected emotion/intent.  Runs only on
``asking_mental_health_question`` turns and concurrently with streaming, so it adds no
visible latency.
"""

from __future__ import annotations

import structlog
from openai import OpenAI

from app.config import settings

logger = structlog.get_logger(__name__)

WIDGETS = ["breathing", "grounding", "mood_checkin", "mood_chart", "actions"]

_SYSTEM = """You decide whether to show ONE interactive support widget alongside Sakina's reply, based on the user's message and emotional state. Pick the single most helpful, or "none".

Widgets:
- breathing — a guided breathing exercise. Pick when the user is anxious, panicked, stressed, has racing thoughts, or can't calm down / can't sleep from worry.
- grounding — an interactive 5-4-3-2-1 grounding exercise. Pick when the user feels overwhelmed, detached/dissociated, or in a panic spiral.
- mood_checkin — a gentle "how are you feeling?" check-in. Pick when the user is sad, numb, low, or unsure how they feel.
- mood_chart — a chart of the user's emotions across this conversation. Pick ONLY when the user asks about their mood, patterns, trends, or how they've been.
- actions — a few suggested next-step replies. Pick when the user seems unsure what to say or is low-energy and could use gentle prompts.
- none — most of the time. Prefer "none" unless a widget clearly helps; plain conversation is usually best.

Reply with EXACTLY one word: breathing, grounding, mood_checkin, mood_chart, actions, or none."""

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=settings.lightning_base_url, api_key=settings.lightning_api_key)
    return _client


def select_widget(message: str, emotion: str, intent: str | None) -> str | None:
    """Pick one support widget for this turn, or None.  Never raises."""
    try:
        user = (
            f"User message: {message!r}\n"
            f"Detected emotion: {emotion}\n"
            f"Intent: {intent}\n\n"
            "Which widget (one word)?"
        )
        r = _get_client().chat.completions.create(
            model=settings.lightning_model,
            temperature=0.0,
            max_tokens=256,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user},
            ],
        )
        out = (r.choices[0].message.content or "").lower()
        # last-matching keyword wins (robust to any reasoning prose)
        hits = [(out.rfind(w), w) for w in WIDGETS if w in out]
        choice = max(hits)[1] if hits else None
        logger.info("widget_select", emotion=emotion, intent=intent, widget=choice)
        return choice
    except Exception as e:  # noqa: BLE001
        logger.warning("widget_error", error=str(e)[:120])
        return None


if __name__ == "__main__":
    cases = [
        ("I can't stop worrying and my heart is racing", "fear"),
        ("everything feels too much, I can't focus, I'm panicking", "fear"),
        ("I just feel so empty and sad lately", "sadness"),
        ("how have my moods been this week?", "sadness"),
        ("i don't even know what to say", "sadness"),
        ("thanks, that helps a lot", "joy"),
    ]
    for msg, emo in cases:
        print(f"[{select_widget(msg, emo, 'asking_mental_health_question')!s:<12}] ({emo}) {msg!r}")
