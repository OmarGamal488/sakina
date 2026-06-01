"""Crisis-safety gate for Sakina — a model-free regex pre-filter (English + Arabic).

Runs on **every** message **before** any model call (language / emotion / intent /
RAG / LLM).  On a match the pipeline short-circuits to a crisis card with hotlines —
no retrieval, no generation.

Design principle (from the brief): **false positives are ACCEPTABLE, false negatives
are NOT.**  The patterns therefore lean toward recall; we do *not* do negation/context
handling ("I don't want to kill myself" firing is fine — missing a real one is not).

The check is intentionally **dependency- and model-free** so the crisis path keeps
working even if Lightning AI / Qdrant are down or slow.  The matched pattern's script
also tells us which localized card to show (Arabic vs English) without running the
language detector.

Scope: **English + Arabic only** — the two languages with localized hotlines.  A crisis
expressed in the other 18 supported languages will **not** fire here.  This is a
conscious limitation that keeps the gate instant and model-free.

Arabic matching first **normalizes** both the input and the lexicon (NFKC, strip
harakat/tatweel, unify alef/yaa/teh variants) so undiacritized and hamza-variant
spellings still match — NFKC alone is insufficient for Arabic.

KNOWN LIMITATIONS: misses Arabizi / Latin-script Arabic ("3ayez amoot", "bdy moot"),
novel metaphor, risk implied across multiple turns without keywords, and Maghrebi /
Sudanese dialect gaps.  The Arabic lexicon was drafted with an Arabic-NLP specialist but
**must be reviewed by a native-speaker licensed clinician before production**, alongside
verifying the regional AR hotline number in ``config.py`` (currently a placeholder).
This is one layer of a defense-in-depth system, never the sole safeguard.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

import structlog

logger = structlog.get_logger(__name__)

# --------------------------------------------------------------------------- #
# Supportive copy shown with the crisis card (reused verbatim from the
# frontend CrisisCard component — already-reviewed wording).
# --------------------------------------------------------------------------- #
SUPPORTIVE_LINE: dict[str, str] = {
    "en": (
        "I'm really glad you told me. You don't have to go through this alone — "
        "if you'd like, I can connect you with someone who can help right now."
    ),
    "ar": (
        "يسعدني أنّك أخبرتني. لست مضطرًا لتمرّ بهذا وحدك. "
        "لو أحببت، يمكنني أن أصلك بمن يقدر يساعدك الآن."
    ),
}

# --------------------------------------------------------------------------- #
# Normalization — applied to BOTH the input and the Arabic lexicon so they
# match consistently.  harakat (U+064B–U+0652), superscript alef (U+0670),
# Quranic marks (U+0653–U+0655), tatweel (U+0640).
# --------------------------------------------------------------------------- #
_AR_DIACRITICS = re.compile(r"[ـً-ْٰٓ-ٕ]")


def _normalize(text: str) -> str:
    """NFKC + strip Arabic diacritics/tatweel + unify alef/yaa/teh + lowercase.

    Diacritized / hamza-variant Arabic and any-case English both collapse to the
    form the patterns are written in.  Letter swaps only touch Arabic characters.
    """
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("’", "'")  # curly → straight apostrophe (don't/can't)
    text = _AR_DIACRITICS.sub("", text)
    text = (
        text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا")
        .replace("ى", "ي").replace("ة", "ه")
    )
    return text.lower()


# --------------------------------------------------------------------------- #
# English patterns — recall-first, including indirect/passive phrasings that
# naive keyword lists miss (death-wish, burdensomeness, "can't go on").
# Operate on the normalized (lowercased) input.
# --------------------------------------------------------------------------- #
_EN_PARTS: list[str] = [
    r"kill(?:ing)?\s+my\s*self",
    r"end(?:ing)?\s+my\s+life",
    r"take\s+my\s+(?:own\s+)?life",
    r"end\s+it\s+all",
    r"suicid",                                  # suicide / suicidal
    r"want(?:ing)?\s+to\s+die",
    r"wanna\s+die",
    r"want\s+to\s+be\s+dead",
    r"better\s+off\s+dead",
    r"wish\s+i\s+(?:was|were)\s+(?:dead|gone|never\s+born)",
    r"don'?t\s+want\s+to\s+(?:live|be\s+here|be\s+alive|exist|wake\s+up)",
    r"do\s+not\s+want\s+to\s+(?:live|be\s+here|exist)",
    r"no\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|go\s+on|going\s+on|exist)",
    r"no\s+longer\s+want\s+to\s+(?:live|be\s+here)",
    r"better\s+off\s+without\s+me",
    r"everyone\s+would\s+be\s+better\s+off\s+without\s+me",
    r"want\s+to\s+disappear",
    r"want\s+to\s+vanish",
    r"can'?t\s+(?:do\s+this|go\s+on|keep\s+going|take\s+it)\s*(?:any\s*more)?",
    r"cannot\s+(?:go\s+on|keep\s+going)",
    r"tired\s+of\s+(?:living|life|being\s+alive)",
    r"give\s+up\s+on\s+life",
    r"hurt\s+my\s*self",
    r"harm\s+my\s*self",
    r"self[\s-]*harm",
    r"cut(?:ting)?\s+my\s*self",
]
_EN_PATTERN = re.compile("|".join(_EN_PARTS), re.IGNORECASE)

# --------------------------------------------------------------------------- #
# Arabic lexicon — drafted with the arabic-nlp-specialist.  MSA + Egyptian/Gulf/
# Levant; includes high-risk indirect phrasings.  Each phrase is run through the
# SAME normalizer at build time (so ى/ة/أ etc. align with normalized input), and
# spaces are matched flexibly.
# --------------------------------------------------------------------------- #
_AR_PHRASES: list[str] = [
    # explicit suicide
    "انتحار", "انتحر", "انتحاري", "ينتحر", "هانتحر", "هنتحر", "بنتحر", "بانتحر",
    "اقتل نفسي", "هاقتل نفسي", "هقتل نفسي", "بقتل نفسي", "راح اقتل نفسي",
    "انهي حياتي", "اريد انهاء حياتي", "ابغى انهي حياتي", "عايز انهي حياتي",
    "عايزه انهي حياتي", "بدي انهي حياتي", "اضع حدا لحياتي", "اخذ حياتي",
    # "I want to die"
    "اريد الموت", "اريد ان اموت", "ابغى اموت", "ابي اموت",
    "عايز اموت", "عايزه اموت", "بدي اموت", "بدي موت", "نفسي اموت", "نفسي الموت",
    "يريتني مت", "ياريتني مت", "يريتني ميت", "تمنيت الموت", "تمنيت لو كنت ميت",
    # passive death-wish / indirect (high clinical weight)
    "مش عايز اعيش", "مش عايزه اعيش", "ما اريد العيش", "لا اريد الاستمرار",
    "ما ابي اعيش", "ما ابغى اعيش", "ما بقى بدي اعيش", "ما عاد بدي اعيش",
    "مليت من الحياه", "مليت من الدنيا", "تعبت من الحياه", "تعبت من الدنيا",
    "تعبت من العيش", "طفشت من الحياه", "زهقت من الحياه", "زهقت من الدنيا",
    "مش لاقي سبب اعيش", "ما لقيت سبب للعيش", "ما لقيت سبب اكمل",
    "ما في سبب للاستمرار", "ليش اكمل", "ليش استمر",
    "لا معنى للحياه", "لا معنى للاستمرار", "مفيش معنى لحياتي",
    "نفسي انام وما اصحى", "عايز انام وما اصحى", "اتمنى انام وما اصحى",
    "نفسي اختفي", "اريد ان اختفي", "ابغى اختفي", "عايز اختفي", "بدي اختفي",
    "الجميع افضل بدوني", "الكل احسن بدوني", "احسن لو ما كنت موجود",
    "احسن لو اختفيت", "لو اختفيت احسن", "محدش محتاجني", "ما في احد يحتاجني",
    "عبء على عيلتي", "اعباء على الكل", "ما اقدر اكمل", "مش قادر اكمل",
    "مش قادره اعيش", "مش قادر اعيش", "مش قادر اتحمل", "حياتي خلصت",
    # self-harm
    "اذي نفسي", "اؤذي نفسي", "ايذاء النفس", "ايذاء الذات",
    "اجرح نفسي", "احرق نفسي", "بجرح نفسي", "بحرق نفسي",
    "بعاقب نفسي", "اعاقب نفسي",
]
_AR_PATTERN = re.compile(
    "|".join(_normalize(p).replace(" ", r"\s+") for p in _AR_PHRASES)
)


@dataclass(frozen=True)
class CrisisResult:
    """Outcome of the crisis check.

    Attributes
    ----------
    triggered:
        True when a self-harm / suicide pattern matched.
    lang_hint:
        ``"ar"`` when an Arabic pattern matched, else ``"en"``.  Drives which
        localized crisis card is shown — derived from the match, no detector.
    pattern:
        The matched substring (for logging; never user-facing).
    """

    triggered: bool
    lang_hint: str = "en"
    pattern: str = ""


def check_crisis(text: str) -> CrisisResult:
    """Scan *text* for crisis language.  Arabic is checked first (script-decisive),
    then English.  Returns a :class:`CrisisResult`; never raises."""
    if not text:
        return CrisisResult(triggered=False)
    norm = _normalize(text)

    m = _AR_PATTERN.search(norm)
    if m:
        return CrisisResult(triggered=True, lang_hint="ar", pattern=m.group(0))

    m = _EN_PATTERN.search(norm)
    if m:
        return CrisisResult(triggered=True, lang_hint="en", pattern=m.group(0))

    return CrisisResult(triggered=False)


if __name__ == "__main__":
    samples = [
        "I want to kill myself",
        "I don't want to be here anymore",
        "everyone would be better off without me",
        "no reason to go on",
        "أنا تعبت من الحياة ونفسي أموت",
        "نفسي أنام وما أصحى",
        "محدش محتاجني",
        "I had a really hard day at work",   # benign
        "I feel a bit sad today",            # benign
    ]
    for s in samples:
        r = check_crisis(s)
        print(f"[{'CRISIS' if r.triggered else 'ok    '} {r.lang_hint}] {s!r}  <- {r.pattern!r}")
