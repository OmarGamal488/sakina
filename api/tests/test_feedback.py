"""Tests for POST /feedback (rubric: thumbs up/down)."""

from __future__ import annotations


def test_feedback_up_ok(client):
    """Happy path: a valid 'up' vote is accepted."""
    r = client.post(
        "/feedback",
        json={"vote": "up", "user_message": "hi", "bot_response": "hello"},
    )
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_feedback_down_ok(client):
    """Happy path: a valid 'down' vote is accepted (message fields optional)."""
    r = client.post("/feedback", json={"vote": "down"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_feedback_invalid_vote_rejected(client):
    """Error case: an out-of-enum vote is a 422 validation error."""
    r = client.post("/feedback", json={"vote": "sideways"})
    assert r.status_code == 422


def test_feedback_missing_vote_rejected(client):
    """Error case: omitting the required 'vote' field is a 422."""
    r = client.post("/feedback", json={"user_message": "hi"})
    assert r.status_code == 422
