"""Generative-UI widget selection.

The LLM (not a hard-coded rule) decides whether the one active widget — a mood chart
of the session's emotions — would help this turn, or none. The choice is emitted as a
``widget`` SSE event. Runs only on ``asking_mental_health_question`` turns, concurrent
with streaming.
"""

from __future__ import annotations

import structlog
from openai import OpenAI

from app.config import settings

logger = structlog.get_logger(__name__)

# DEACTIVATED widgets — kept out of this list so the selector can never pick them
# (frontend components stay dormant for easy reactivation):
#   - mood_checkin ("How are you feeling?")
#   - grounding    (5-4-3-2-1 grounding exercise)
#   - actions      (suggested next-step replies / "What would help most?")
WIDGETS = ["mood_chart", "breathing"]

_SYSTEM = """You decide whether to show ONE interactive support widget alongside Sakina's reply, based on the user's message and emotional state. Pick the single most helpful, or "none".

Widgets:
- mood_chart — a chart of the user's emotions across this conversation. Pick ONLY when the user asks about their mood, patterns, trends, or how they've been.
- breathing — a guided box-breathing exercise. Pick ONLY when the detected emotion is fear AND the user sounds acutely anxious, panicking, or overwhelmed right now (racing heart, can't calm down, spiraling). Do NOT pick it for sadness, grief, anger, or calm reflection.
- none — most of the time. Prefer "none" unless a widget clearly helps; plain conversation is usually best.

Reply with EXACTLY one word: mood_chart, breathing, or none."""

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
