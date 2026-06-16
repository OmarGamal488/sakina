"""Core-logic tests for the crisis-safety gate (app/safety.py).

The gate is model-free and recall-first (false positives acceptable, false
negatives not). We assert it FIRES on known crisis phrasings (EN + AR) and stays
QUIET on benign mental-health talk.
"""

from __future__ import annotations

import pytest

from app import safety

CRISIS_EN = [
    "I want to kill myself",
    "I don't want to be here anymore",
    "everyone would be better off without me",
    "no reason to go on",
    "I want to end my life",
]

CRISIS_AR = [
    "أنا تعبت من الحياة ونفسي أموت",
    "نفسي أنام وما أصحى",
    "محدش محتاجني",
]

BENIGN = [
    "I had a really hard day at work",
    "I feel a bit sad today",
    "Can you help me sleep better?",
    "",  # empty must never trigger
]


@pytest.mark.parametrize("text", CRISIS_EN)
def test_crisis_en_triggers(text):
    res = safety.check_crisis(text)
    assert res.triggered is True
    assert res.lang_hint == "en"


@pytest.mark.parametrize("text", CRISIS_AR)
def test_crisis_ar_triggers(text):
    res = safety.check_crisis(text)
    assert res.triggered is True
    assert res.lang_hint == "ar"


@pytest.mark.parametrize("text", BENIGN)
def test_benign_does_not_trigger(text):
    assert safety.check_crisis(text).triggered is False


def test_supportive_line_present_for_both_langs():
    assert safety.SUPPORTIVE_LINE["en"]
    assert safety.SUPPORTIVE_LINE["ar"]
