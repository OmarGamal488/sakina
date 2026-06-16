"""Tests for POST /chat — the rubric single-JSON contract.

The orchestrator is mocked (see conftest.py) so these exercise OUR endpoint
logic: request validation, the crisis short-circuit, and the response shape the
provided frontend reads (``response``).
"""

from __future__ import annotations

from app.orchestrator import PipelineResult


def test_chat_happy_path(client, fake_pipeline):
    """Happy path: a normal message returns the assembled reply + metadata."""
    r = client.post("/chat", json={"message": "I feel anxious lately"})
    assert r.status_code == 200
    body = r.json()
    # The frontend reads `response`; it must be the joined token stream.
    assert body["response"] == "I'm here with you."
    assert body["intent"] == "asking_mental_health_question"
    assert body["emotion"] == "sadness"
    assert body["language"] == "en"
    assert body["kind"] is None
    assert fake_pipeline["analyze"] == 1  # pipeline ran exactly once


def test_chat_empty_message_rejected(client):
    """Error case: empty message violates min_length=1 -> 422."""
    r = client.post("/chat", json={"message": ""})
    assert r.status_code == 422


def test_chat_missing_body_rejected(client):
    """Error case: no body at all -> 422."""
    r = client.post("/chat", json={})
    assert r.status_code == 422


def test_chat_crisis_short_circuits(client, fake_pipeline):
    """Safety: a crisis message returns kind='crisis' and NEVER calls the pipeline."""
    r = client.post("/chat", json={"message": "I want to kill myself"})
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "crisis"
    assert body["emotion"] == "sadness"
    assert body["response"]  # a supportive line is present
    # The model-free gate must fire BEFORE any analyze/LLM/RAG call.
    assert fake_pipeline["analyze"] == 0


def test_chat_out_of_scope(client, fake_pipeline):
    """An out-of-scope intent still returns a normal 200 JSON reply."""
    fake_pipeline["result"] = PipelineResult(
        language="en", emotion="joy", intent="out_of_scope", english_query="weather?"
    )
    r = client.post("/chat", json={"message": "what's the weather tomorrow?"})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "out_of_scope"
    assert body["response"]
