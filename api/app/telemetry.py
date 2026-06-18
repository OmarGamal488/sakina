"""OpenTelemetry metrics for Sakina — exported via OTLP to a Collector → Axiom.

Five instruments across the three rubric categories:

  model/NLP  : ``sakina.chat.requests`` (counter, by intent)  -> intent distribution
               ``sakina.chat.latency``  (histogram, ms)        -> response latency
  data       : ``sakina.message.length``(histogram, chars)     -> input size distribution
               ``sakina.feedback.votes``(counter, by vote)      -> feedback up/down ratio
  server     : ``sakina.http.errors``   (counter, by status)   -> error rate / reliability

Everything degrades gracefully: if ``OTEL_EXPORTER_OTLP_ENDPOINT`` is empty (local
dev, CI, unit tests), ``setup_telemetry`` installs in-memory no-op instruments so
the record_* helpers are always safe to call and never raise.
"""

from __future__ import annotations

import time
from contextlib import contextmanager

import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

# Module-level instrument handles; populated by setup_telemetry().
_chat_requests = None
_chat_latency = None
_message_length = None
_feedback_votes = None
_http_errors = None
_enabled = False


def setup_telemetry() -> bool:
    """Initialise the OTel MeterProvider + OTLP exporter and create instruments.

    Returns True if a real OTLP exporter was wired up, False if telemetry is
    disabled (no endpoint configured) — in which case no-op instruments are used.
    Safe to call once at startup.
    """
    global _chat_requests, _chat_latency, _message_length, _feedback_votes
    global _http_errors, _enabled

    try:
        from opentelemetry import metrics
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
    except ImportError:
        # OpenTelemetry not installed → telemetry stays a no-op; app runs normally.
        _enabled = False
        logger.warning("telemetry_unavailable", reason="opentelemetry_not_installed")
        return False

    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

    axiom_token = settings.axiom_token.strip()
    axiom_dataset = settings.axiom_dataset.strip()
    endpoint = settings.otel_exporter_otlp_endpoint.strip()

    exporter = None
    if axiom_token and axiom_dataset:
        # HF Space path: no collector running there, so export directly to Axiom
        # via OTLP HTTP with bearer-token auth.
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
            OTLPMetricExporter as HTTPMetricExporter,
        )

        # Axiom routes OTLP *metrics* via the X-Axiom-Metrics-Dataset header
        # (logs/traces use X-Axiom-Dataset) and requires a dedicated Metrics-kind
        # dataset. The exporter appends /v1/metrics to the base endpoint.
        exporter = HTTPMetricExporter(
            endpoint="https://api.axiom.co",
            headers={
                "Authorization": f"Bearer {axiom_token}",
                "X-Axiom-Metrics-Dataset": axiom_dataset,
            },
        )
        _enabled = True
        logger.info("telemetry_enabled", mode="axiom_direct", dataset=axiom_dataset)
    elif endpoint:
        # Local docker-compose path: API → gRPC → OTel Collector → Axiom.
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
            OTLPMetricExporter,
        )

        exporter = OTLPMetricExporter(endpoint=endpoint, insecure=True)
        _enabled = True
        logger.info("telemetry_enabled", mode="otlp_grpc", endpoint=endpoint)

    if exporter is not None:
        reader = PeriodicExportingMetricReader(
            exporter, export_interval_millis=settings.otel_metric_export_interval_ms
        )
        provider = MeterProvider(
            resource=Resource.create({SERVICE_NAME: settings.otel_service_name}),
            metric_readers=[reader],
        )
    else:
        # No config → a provider with no readers. Instruments still record into
        # the void, so the record_* helpers are always safe to call.
        provider = MeterProvider(
            resource=Resource.create({SERVICE_NAME: settings.otel_service_name})
        )
        _enabled = False
        logger.info("telemetry_disabled", reason="no_axiom_token_or_otlp_endpoint")

    metrics.set_meter_provider(provider)
    meter = metrics.get_meter("sakina")

    _chat_requests = meter.create_counter(
        "sakina.chat.requests", unit="1", description="Chat turns, tagged by intent"
    )
    _chat_latency = meter.create_histogram(
        "sakina.chat.latency", unit="ms", description="End-to-end chat latency"
    )
    _message_length = meter.create_histogram(
        "sakina.message.length", unit="char", description="Inbound message length"
    )
    _feedback_votes = meter.create_counter(
        "sakina.feedback.votes", unit="1", description="Feedback votes, tagged up/down"
    )
    _http_errors = meter.create_counter(
        "sakina.http.errors", unit="1", description="HTTP error responses by status"
    )
    return _enabled


def instrument_app(app) -> None:
    """Attach OpenTelemetry's FastAPI auto-instrumentation (request count/latency).

    No-ops if instrumentation isn't installed; never blocks app startup.
    """
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        logger.info("fastapi_instrumented")
    except Exception as exc:  # noqa: BLE001
        logger.warning("fastapi_instrument_failed", error=str(exc)[:200])


# --- record helpers — always safe to call (guard against pre-setup use) ------


def record_chat(intent: str | None, message_chars: int, latency_ms: float) -> None:
    """One chat turn: intent distribution + latency + message length."""
    label = {"intent": intent or "unknown"}
    if _chat_requests is not None:
        _chat_requests.add(1, label)
    if _chat_latency is not None:
        _chat_latency.record(latency_ms, label)
    if _message_length is not None:
        _message_length.record(message_chars, label)


def record_feedback(vote: str) -> None:
    """One feedback vote (up/down) for the helpfulness ratio."""
    if _feedback_votes is not None:
        _feedback_votes.add(1, {"vote": vote})


def record_http_error(status_code: int) -> None:
    """One HTTP error response, tagged by status code (server reliability)."""
    if _http_errors is not None:
        _http_errors.add(1, {"status": str(status_code)})


@contextmanager
def measure_latency():
    """Context manager yielding a callable that returns elapsed ms."""
    start = time.perf_counter()
    yield lambda: (time.perf_counter() - start) * 1000.0
