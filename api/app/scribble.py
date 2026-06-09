"""Scribble reflection via Gemini image understanding."""

from __future__ import annotations

import base64
import json
import re
from urllib import error as urlerror
from urllib import request as urlrequest

import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

_DATA_URL_RE = re.compile(r"^data:(?P<mime>image\/[a-zA-Z0-9.+-]+);base64,(?P<data>.+)$")

# Locked DAIR emotion vocabulary (same 6 labels + order used across the app).
EMOTIONS = ("sadness", "joy", "love", "anger", "fear", "surprise")
_DEFAULT_EMOTION = "love"

_PROMPT = (
    "You are Sakina, a warm mental-health support companion. The user made a quick emotional "
    "scribble or abstract drawing to express how they feel. Gently reflect on what visual "
    "qualities you notice, what feelings or inner state the drawing might suggest, and offer "
    "one or two kind, grounding suggestions. Be tentative, never claim certainty, never "
    "diagnose, and keep the reflection to 3 to 5 sentences. Also classify the overall feeling "
    f"the drawing conveys as exactly one of these emotions: {', '.join(EMOTIONS)}."
)

# Force structured output so we get both the reflection and a single DAIR emotion.
_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reflection": {"type": "STRING"},
        "emotion": {"type": "STRING", "enum": list(EMOTIONS)},
    },
    "required": ["reflection", "emotion"],
    "propertyOrdering": ["reflection", "emotion"],
}


class ScribbleError(Exception):
    """Raised when scribble reflection cannot be completed safely."""


def _parse_data_url(image_data_url: str) -> tuple[str, str]:
    match = _DATA_URL_RE.match(image_data_url.strip())
    if not match:
        raise ScribbleError("The scribble image format was not valid.")
    mime_type = match.group("mime")
    data = match.group("data")
    try:
        base64.b64decode(data, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ScribbleError("The scribble image could not be decoded.") from exc
    return mime_type, data


def reflect_scribble(image_data_url: str) -> tuple[str, str]:
    """Return ``(reflection, emotion)`` — emotion is one of the 6 DAIR labels."""
    if not settings.gemini_api_key:
        raise ScribbleError("Gemini is not configured on the server.")

    mime_type, encoded = _parse_data_url(image_data_url)
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _RESPONSE_SCHEMA,
        },
    }

    req = urlrequest.Request(
        (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
        ),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=45) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        logger.warning("scribble_gemini_http_error", status=exc.code, detail=detail[:300])
        raise ScribbleError("Sakina could not reflect on the scribble right now.") from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("scribble_gemini_request_error", error=str(exc)[:200])
        raise ScribbleError("Sakina could not reach the reflection service.") from exc

    try:
        parts = raw["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts).strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("scribble_gemini_parse_error", payload=str(raw)[:400])
        raise ScribbleError("Sakina could not understand the reflection response.") from exc

    if not text:
        raise ScribbleError("Sakina did not receive a usable reflection.")

    # responseSchema makes `text` a JSON object; parse it. Fall back gracefully to
    # treating the whole text as the reflection with a neutral default emotion.
    reflection, emotion = text, _DEFAULT_EMOTION
    try:
        data = json.loads(text)
        reflection = str(data.get("reflection", "")).strip() or text
        candidate = str(data.get("emotion", "")).strip().lower()
        emotion = candidate if candidate in EMOTIONS else _DEFAULT_EMOTION
    except (ValueError, TypeError):
        logger.warning("scribble_emotion_parse_fallback", text=text[:200])

    return reflection, emotion
