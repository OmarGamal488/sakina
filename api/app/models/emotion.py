"""Emotion classification for Sakina — translate-then-classify (no fine-tuning).

Non-English text is translated to English via NLLB-200-distilled-1.3B (FLORES
codes), then classified by a pretrained DistilBERT model into one of the 6 DAIR
labels; English passes through untranslated. All local — zero API calls. NLLB is
exposed via :meth:`translate` so the composer reuses this instance (no second load).
Config + model ids come from ``artifacts/emotion_config.json`` (NB02).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import structlog

from app.config import ARTIFACTS_DIR, settings

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class EmotionResult:
    """Immutable emotion result: one of the 6 DAIR labels, its DistilBERT softmax
    confidence, and the English text actually classified (== input if English)."""

    emotion: str
    confidence: float
    translated_text: str


class EmotionClassifier:
    """Translate-then-classify emotion model.  Loads NLLB-1.3B + DistilBERT once."""

    def __init__(self, config_path: Path | str | None = None) -> None:
        if config_path is None:
            config_path = ARTIFACTS_DIR / "emotion_config.json"
        cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))

        self._labels: list[str] = cfg["labels"]
        self._flores: dict[str, str] = cfg["flores_codes"]
        self._eng_code: str = cfg["translator_target_english_code"]
        self._max_len: int = int(cfg.get("emotion_model_max_length", 256))
        emo_id: str = cfg["emotion_model"]
        nllb_id: str = cfg["translator_model"]

        import torch
        from transformers import (
            AutoModelForSeq2SeqLM,
            AutoModelForSequenceClassification,
            AutoTokenizer,
            pipeline,
        )

        self._torch = torch
        logger.info("emotion_loading", emotion_model=emo_id, translator=nllb_id)

        self._clf = pipeline(
            "text-classification",
            model=AutoModelForSequenceClassification.from_pretrained(
                emo_id,
                cache_dir=settings.hf_hub_cache_dir,
                low_cpu_mem_usage=True,
            ),
            tokenizer=AutoTokenizer.from_pretrained(emo_id, cache_dir=settings.hf_hub_cache_dir),
            device=-1,  # CPU
            truncation=True,
            max_length=self._max_len,
            top_k=None,
        )
        self._nllb_tok = AutoTokenizer.from_pretrained(nllb_id, cache_dir=settings.hf_hub_cache_dir)
        self._nllb = AutoModelForSeq2SeqLM.from_pretrained(
            nllb_id,
            cache_dir=settings.hf_hub_cache_dir,
            low_cpu_mem_usage=True,
        ).eval()

        logger.info("emotion_loaded", n_labels=len(self._labels))

    def translate(self, text: str, src_code: str, tgt_code: str | None = None) -> str:
        """Translate *text* from FLORES *src_code* to *tgt_code* (default English).

        Reused by the response composer to fill the other-language pane.
        """
        tgt_code = tgt_code or self._eng_code
        self._nllb_tok.src_lang = src_code
        bos = self._nllb_tok.convert_tokens_to_ids(tgt_code)
        enc = self._nllb_tok(text, return_tensors="pt", truncation=True, max_length=self._max_len)
        with self._torch.no_grad():
            gen = self._nllb.generate(
                **enc, forced_bos_token_id=bos, max_length=self._max_len, num_beams=1
            )
        return self._nllb_tok.batch_decode(gen, skip_special_tokens=True)[0]

    def flores_code(self, lang: str) -> str | None:
        """FLORES-200 code for an ISO 639-1 lang, or None if unsupported."""
        return self._flores.get(lang)

    def classify(self, text: str, lang: str = "en") -> EmotionResult:
        """Classify *text* (written in *lang*) into one of the 6 DAIR emotions."""
        english = text
        if lang != "en":
            code = self._flores.get(lang)
            if code is not None:
                english = self.translate(text, code, self._eng_code)
        scores = self._clf(english, truncation=True, max_length=self._max_len)[0]
        best = max(scores, key=lambda d: d["score"])
        emotion = best["label"] if best["label"] in self._labels else self._labels[0]
        return EmotionResult(
            emotion=emotion,
            confidence=float(best["score"]),
            translated_text=english,
        )


_instance: EmotionClassifier | None = None


def get_classifier() -> EmotionClassifier:
    """Module-level lazy singleton.  Loads ~5.5 GB NLLB + DistilBERT on first call —
    warm it once at FastAPI startup, never per request."""
    global _instance
    if _instance is None:
        _instance = EmotionClassifier()
    return _instance


if __name__ == "__main__":
    clf = get_classifier()
    for txt, lang in [
        ("I feel hopeless and tired", "en"),
        ("je suis tellement heureux aujourd'hui", "fr"),
        ("أنا خائف جداً", "ar"),
    ]:
        r = clf.classify(txt, lang)
        print(f"[{r.emotion:<8} {r.confidence:.3f}] ({lang}) {txt!r} -> {r.translated_text!r}")
