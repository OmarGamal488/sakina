"""Shared pytest fixtures for the Sakina API tests.

These tests are *unit* tests of our HTTP layer and core logic — they must run
fast, offline, and deterministically (no Lightning LLM, no Qdrant, no model
weights, no network). To achieve that we patch the orchestrator seam:

  * ``orchestrator.warmup``      -> no-op  (so the app lifespan loads no models)
  * ``orchestrator.analyze``     -> a canned :class:`PipelineResult`
  * ``orchestrator.stream_reply``-> a fixed token stream

The crisis gate (``safety.check_crisis``) is model-free and is NOT mocked — we
test it for real, both directly and through ``/chat``.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from app import main, orchestrator
from app.orchestrator import PipelineResult
from fastapi.testclient import TestClient

# A canned non-crisis analysis result the fake ``analyze`` returns by default.
_FAKE_RESULT = PipelineResult(
    language="en",
    emotion="sadness",
    intent="asking_mental_health_question",
    english_query="i feel anxious",
    sources=[],
)


@pytest.fixture
def fake_pipeline(monkeypatch):
    """Replace the heavy orchestrator calls with fast in-memory fakes.

    Records how many times ``analyze`` ran on ``calls['analyze']`` so a test can
    assert the crisis gate short-circuits BEFORE the pipeline is ever touched.
    Yields the mutable ``calls`` dict; override ``calls['result']`` to change the
    analysis a given test sees.
    """
    calls = {"analyze": 0, "result": _FAKE_RESULT}

    async def fake_analyze(message, lang_hint=None, session_lang=None):
        calls["analyze"] += 1
        return calls["result"]

    async def fake_stream_reply(message, result, history=None) -> AsyncIterator[str]:
        for chunk in ["I'm ", "here ", "with ", "you."]:
            yield chunk

    monkeypatch.setattr(orchestrator, "warmup", lambda: None)
    monkeypatch.setattr(orchestrator, "analyze", fake_analyze)
    monkeypatch.setattr(orchestrator, "stream_reply", fake_stream_reply)
    return calls


@pytest.fixture
def client(fake_pipeline):
    """A ``TestClient`` whose app lifespan runs with the fakes in place.

    Using the context-manager form triggers startup/shutdown so the lifespan
    (and our no-op ``warmup``) is exercised exactly like production.
    """
    with TestClient(main.app) as c:
        yield c
