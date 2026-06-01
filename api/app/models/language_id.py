"""Language identification module for Sakina.

Loads a pre-trained sklearn TF-IDF + calibrated LinearSVC pipeline and wraps it
with a chat-input robustness guard.  The guard handles short tokens, non-Latin
scripts, and low-confidence cases that trip up the bare classifier on real chat
messages without touching the ~0.996 test accuracy on full-length text.

Public API
----------
LanguageResult
    Frozen dataclass: (lang, confidence, source).

LanguageDetector
    Wraps the joblib artifact.  Call `detect(text, prior_lang)` → LanguageResult.

get_detector() → LanguageDetector
    Module-level lazy singleton.  Lingua builds a compiled Rust model at init —
    call this once at FastAPI startup, not per request.

Algorithm: verbatim port of ``detect_with_fallback`` from
``notebooks/01_language_detection.ipynb`` §9 (cell 21).  Params are read from
``metadata["robustness_guard"]`` at load time so the module stays in sync with
the artifact version.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import joblib
import numpy as np
import structlog

if TYPE_CHECKING:
    from sklearn.pipeline import Pipeline

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Text preprocessing (must match the pipeline's training-time preprocessing)
# ---------------------------------------------------------------------------

_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_LETTERS_RE = re.compile(r"[^\W\d_]", re.UNICODE)


def _clean(text: str) -> str:
    """Strip URLs, apply NFKC normalisation, lowercase — matches training pipeline."""
    text = _URL_RE.sub(" ", text)
    text = unicodedata.normalize("NFKC", text)
    return text.lower()


# ---------------------------------------------------------------------------
# Script detection helpers
# ---------------------------------------------------------------------------


def _char_script(ch: str) -> str | None:
    """Return the Unicode script family of a single character, or None."""
    try:
        name = unicodedata.name(ch)
    except ValueError:
        return None
    for key, token in (
        ("arabic", "ARABIC"),
        ("cyrillic", "CYRILLIC"),
        ("greek", "GREEK"),
        ("thai", "THAI"),
        ("devanagari", "DEVANAGARI"),
    ):
        if token in name:
            return key
    if "CJK" in name or "HIRAGANA" in name or "KATAKANA" in name:
        return "han"
    if "LATIN" in name:
        return "latin"
    return "other"


def _dominant_script(
    text: str,
    script_map: dict[str, list[str]],
    ratio: float,
) -> str:
    """Return the dominant Unicode script in *text*, or ``"latin"``/``"none"``.

    Returns ``"none"`` when there are no letter characters at all.
    Returns a script key from *script_map* only when that script accounts for
    strictly more than *ratio* of all letter characters (handles code-switching).
    Falls back to ``"latin"`` in all other cases.
    """
    counts: dict[str, int] = {}
    total = 0
    for ch in text:
        if _LETTERS_RE.match(ch):
            s = _char_script(ch)
            if s is None:
                continue
            counts[s] = counts.get(s, 0) + 1
            total += 1
    if total == 0:
        return "none"
    best, best_n = max(counts.items(), key=lambda kv: kv[1])
    return best if (best in script_map and best_n / total > ratio) else "latin"


def _restricted_argmax(
    proba: np.ndarray,
    classes: np.ndarray,
    allowed: list[str],
) -> tuple[str, float]:
    """Return (lang, prob) for the highest-probability class in *allowed*."""
    pos = {c: i for i, c in enumerate(classes)}
    ids = [pos[c] for c in allowed if c in pos]
    best = max(ids, key=lambda i: proba[i])
    return str(classes[best]), float(proba[best])


# ---------------------------------------------------------------------------
# Public result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class LanguageResult:
    """Immutable detection result.

    Attributes
    ----------
    lang:
        ISO 639-1 code, always one of the 20 supported languages.
    confidence:
        Calibrated probability from the pipeline, or 0.0 when the result was
        determined by a guard rule (prior, script shortcut, no-signal).
    source:
        Which branch produced the prediction.  One of:
        ``no-signal``, ``script``, ``prior``, ``lingua-short``, ``default``,
        ``tfidf``, ``lingua``.
    """

    lang: str
    confidence: float
    source: str


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

# Default guard parameters (fallback values when keys are absent from metadata)
_DEFAULT_GUARD: dict = {
    "short_letters_threshold": 7,
    "lingua_min_confidence": 0.55,
    "no_signal_min_letters": 2,
    "no_signal_default": "en",
    "script_dominance_ratio": 0.5,
    "script_map": {
        "arabic": ["ar", "ur"],
        "cyrillic": ["bg", "ru"],
        "greek": ["el"],
        "thai": ["th"],
        "devanagari": ["hi"],
        "han": ["zh", "ja"],
    },
}


class LanguageDetector:
    """Wraps the Sakina language-identification artifact with a robustness guard.

    The guard adds three closed-set layers on top of the raw TF-IDF classifier:

    1. **No-signal** — emoji / digits only → return session language or default.
    2. **Script shortcut** — decisive non-Latin script → restrict to that script's
       languages so short tokens can never be mislabelled across scripts.
    3. **Short Latin guard** — fewer than ``short_letters_threshold`` letters →
       trust session prior first, then lingua, then default ``en``.
    4. **Normal-length** — TF-IDF above ``confidence_threshold`` → tfidf; else
       defer to lingua.

    All paths return one of the 20 supported ISO codes; ``"unknown"`` / ``None``
    are never returned.
    """

    def __init__(self, artifact_path: Path | str | None = None) -> None:
        """Load the joblib artifact and build the lingua detector.

        Parameters
        ----------
        artifact_path:
            Path to ``lang_id.joblib``.  Defaults to the ``artifacts/``
            directory co-located with this module.
        """
        if artifact_path is None:
            artifact_path = Path(__file__).parent / "artifacts" / "lang_id.joblib"
        artifact_path = Path(artifact_path)

        artifact: dict = joblib.load(artifact_path)
        self._pipeline: Pipeline = artifact["pipeline"]
        metadata: dict = artifact["metadata"]
        guard: dict = metadata.get("robustness_guard", {})

        # Classes come from the pipeline — authoritative for proba ordering.
        self._classes: np.ndarray = self._pipeline.named_steps["clf"].classes_

        # Confidence threshold lives at the top level of metadata.
        self._confidence_threshold: float = float(
            metadata.get("confidence_threshold", 0.6)
        )

        # All other tunables come from robustness_guard (fall back to literals).
        self._short_letters_threshold: int = int(
            guard.get(
                "short_letters_threshold",
                _DEFAULT_GUARD["short_letters_threshold"],
            )
        )
        self._lingua_min_confidence: float = float(
            guard.get(
                "lingua_min_confidence",
                _DEFAULT_GUARD["lingua_min_confidence"],
            )
        )
        self._no_signal_min_letters: int = int(
            guard.get(
                "no_signal_min_letters",
                _DEFAULT_GUARD["no_signal_min_letters"],
            )
        )
        self._no_signal_default: str = str(
            guard.get("no_signal_default", _DEFAULT_GUARD["no_signal_default"])
        )
        self._script_dominance_ratio: float = float(
            guard.get(
                "script_dominance_ratio",
                _DEFAULT_GUARD["script_dominance_ratio"],
            )
        )
        # script_map values may be lists or tuples in metadata; normalise to list[str].
        raw_script_map: dict = guard.get("script_map", _DEFAULT_GUARD["script_map"])
        self._script_map: dict[str, list[str]] = {
            k: list(v) for k, v in raw_script_map.items()
        }

        # Build lingua detector closed over the 20 supported languages.
        # This compiles Rust models — done once here, never at request time.
        from lingua import Language, LanguageDetectorBuilder

        fallback_codes: list[str] = metadata.get(
            "fallback_languages", self._classes.tolist()
        )
        iso_to_language = {
            lang.iso_code_639_1.name.lower(): lang for lang in Language.all()
        }
        lingua_langs = [iso_to_language[c] for c in fallback_codes if c in iso_to_language]
        self._lingua = (
            LanguageDetectorBuilder.from_languages(*lingua_langs)
            .with_preloaded_language_models()
            .build()
        )

        logger.info(
            "language_detector_loaded",
            artifact_path=str(artifact_path),
            version=metadata.get("version"),
            model_type=metadata.get("model_type"),
            n_classes=len(self._classes),
        )

    # ------------------------------------------------------------------
    # Core detection
    # ------------------------------------------------------------------

    def detect(self, text: str, prior_lang: str | None = None) -> LanguageResult:
        """Detect the language of *text* with a chat-input robustness guard.

        Verbatim port of ``detect_with_fallback`` from notebook §9 (cell 21).
        Param values are read from the artifact's metadata at init time.

        Parameters
        ----------
        text:
            Input string (raw, as received from the user).
        prior_lang:
            The session's already-established language (ISO 639-1 code from the
            previous turn).  Helps recover short non-English tokens.

        Returns
        -------
        LanguageResult
            Always one of the 20 supported ISO codes.  ``confidence`` is 0.0
            when a guard rule (not the classifier) decided the outcome.
        """
        # n_letters is computed on RAW text (before cleaning).
        n_letters = len(_LETTERS_RE.findall(text))

        # Step 1 — no real signal (emoji / digits / symbols).
        if n_letters < self._no_signal_min_letters:
            return LanguageResult(
                lang=prior_lang or self._no_signal_default,
                confidence=0.0,
                source="no-signal",
            )

        # Steps 2–4 need the cleaned text for the classifier.
        cleaned = _clean(text)
        proba: np.ndarray = self._pipeline.predict_proba([cleaned])[0]
        script = _dominant_script(cleaned, self._script_map, self._script_dominance_ratio)

        # Step 2 — decisive non-Latin script: restrict to that script's languages.
        if script in self._script_map:
            allowed = self._script_map[script]
            # Short token within the expected script: trust the session prior.
            if n_letters < self._short_letters_threshold and prior_lang in allowed:
                return LanguageResult(lang=prior_lang, confidence=0.0, source="prior")
            lang, conf = _restricted_argmax(proba, self._classes, allowed)
            return LanguageResult(lang=lang, confidence=conf, source="script")

        # Compute top prediction for normal / short Latin paths.
        top_idx = int(np.argmax(proba))
        top_lang = str(self._classes[top_idx])
        top_conf = float(proba[top_idx])

        # Step 3 — short Latin input: TF-IDF proba is unreliable here.
        #           Priority: session prior → lingua (if confident) → default.
        #           Lingua receives RAW text (not lowercased) for best accuracy.
        if n_letters < self._short_letters_threshold:
            if prior_lang:
                return LanguageResult(lang=prior_lang, confidence=0.0, source="prior")
            vals = self._lingua.compute_language_confidence_values(text)
            if vals and vals[0].value >= self._lingua_min_confidence:
                detected_lang = vals[0].language.iso_code_639_1.name.lower()
                return LanguageResult(
                    lang=detected_lang,
                    confidence=float(vals[0].value),
                    source="lingua-short",
                )
            return LanguageResult(
                lang=self._no_signal_default, confidence=0.0, source="default"
            )

        # Step 4 — normal-length text: trust TF-IDF above the threshold.
        if top_conf >= self._confidence_threshold:
            return LanguageResult(lang=top_lang, confidence=top_conf, source="tfidf")

        # Below threshold: defer to lingua.  Lingua receives RAW text.
        lang_obj = self._lingua.detect_language_of(text)
        if lang_obj is None:
            # lingua returned nothing — fall back to the TF-IDF prediction.
            return LanguageResult(lang=top_lang, confidence=top_conf, source="tfidf")
        detected_lang = lang_obj.iso_code_639_1.name.lower()
        return LanguageResult(lang=detected_lang, confidence=top_conf, source="lingua")


# ---------------------------------------------------------------------------
# Module-level lazy singleton
# ---------------------------------------------------------------------------

_detector_instance: LanguageDetector | None = None


def get_detector() -> LanguageDetector:
    """Return the module-level singleton ``LanguageDetector``.

    Builds the instance on first call (expensive: loads the joblib artifact and
    compiles the Rust lingua models).  Subsequent calls return the cached object.
    FastAPI startup should call this once; request handlers should not
    construct new instances.
    """
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = LanguageDetector()
    return _detector_instance


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    detector = get_detector()
    cases: list[tuple[str, str | None]] = [
        ("ok", None),
        ("hi", None),
        ("danke", "de"),
        ("لا", None),
        ("你好", None),
        ("😭😭 123", None),
        ("I am feeling really sad today", None),
    ]
    print("\nSmoke test results:")
    print(f"{'text':<30} {'prior':<6} {'lang':<6} {'conf':<8} {'source'}")
    print("-" * 65)
    for text, prior in cases:
        result = detector.detect(text, prior_lang=prior)
        print(
            f"{text!r:<30} {str(prior):<6} {result.lang:<6} "
            f"{result.confidence:<8.3f} {result.source}"
        )
