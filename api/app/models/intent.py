"""Intent classification for Sakina — plain few-shot prompting (no DSPy).

Loads prompt + demos from ``artifacts/intent_few_shot.json`` (NB03) and calls the
Lightning ``gpt-oss`` LLM. Returns one of the 5 intents (one LLM call per message).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import structlog
from openai import OpenAI

from app.config import ARTIFACTS_DIR, settings

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class IntentResult:
    """Immutable intent result — one of the 5 brief intents."""

    intent: str


class IntentClassifier:
    """Few-shot intent classifier backed by the Lightning LLM."""

    def __init__(self, config_path: Path | str | None = None) -> None:
        if config_path is None:
            config_path = ARTIFACTS_DIR / "intent_few_shot.json"
        cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))

        self._system: str = cfg["system_prompt"]
        self._template: str = cfg["user_template"]
        self._intents: list[str] = cfg["intents"]
        self._model: str = cfg.get("model", settings.lightning_model)
        self._max_tokens: int = int(cfg.get("max_tokens", 512))
        self._client = OpenAI(
            base_url=settings.lightning_base_url, api_key=settings.lightning_api_key
        )
        logger.info("intent_loaded", model=self._model, n_intents=len(self._intents))

    def classify(self, message: str) -> IntentResult:
        """Classify *message* into one of the 5 intents (default ``out_of_scope``)."""
        try:
            r = self._client.chat.completions.create(
                model=self._model,
                temperature=0.0,
                max_tokens=self._max_tokens,
                messages=[
                    {"role": "system", "content": self._system},
                    {"role": "user", "content": self._template.format(message=message)},
                ],
            )
            out = (r.choices[0].message.content or "").lower()
            # parse: the intent label that appears LAST wins (robust to reasoning prose)
            hits = [(out.rfind(i), i) for i in self._intents if i in out]
            return IntentResult(intent=max(hits)[1] if hits else "out_of_scope")
        except Exception as e:  # noqa: BLE001 — never let intent crash the turn
            logger.warning("intent_error", error=str(e)[:100])
            return IntentResult(intent="out_of_scope")


_instance: IntentClassifier | None = None


def get_classifier() -> IntentClassifier:
    """Module-level lazy singleton (cheap — no local model, just an HTTP client)."""
    global _instance
    if _instance is None:
        _instance = IntentClassifier()
    return _instance


if __name__ == "__main__":
    clf = get_classifier()
    for q in [
        "hello there",
        "thanks so much",
        "I can't stop feeling anxious",
        "what's the weather tomorrow?",
        "bye",
    ]:
        print(f"[{clf.classify(q).intent:<32}] {q!r}")
