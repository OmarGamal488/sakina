"""Tests for the health endpoints (rubric: GET /health)."""

from __future__ import annotations


def test_health_ok(client):
    """Happy path: /health returns 200 with the service status payload."""
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "sakina-api"


def test_healthz_alias_ok(client):
    """The original /healthz liveness probe still works (alias)."""
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
