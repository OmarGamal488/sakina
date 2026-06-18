"""Application settings for the Sakina API (env-driven via ``pydantic-settings``)."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _API_DIR.parent
_FRONTEND_DIR = _REPO_ROOT / "frontend"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "models" / "artifacts"


class Settings(BaseSettings):
    """Runtime configuration, read from environment / ``api/.env``."""

    model_config = SettingsConfigDict(
        env_file=(str(_API_DIR / ".env"), str(_FRONTEND_DIR / ".env.local")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Lightning AI (OpenAI-compatible) — intent + RAG generation ---
    lightning_base_url: str = "https://lightning.ai/api/v1/"
    lightning_api_key: str = ""
    lightning_model: str = "lightning-ai/gpt-oss-120b"

    # --- Groq (OpenAI-compatible) — STT + TTS ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_stt_model: str = "whisper-large-v3-turbo"
    groq_tts_model_en: str = "canopylabs/orpheus-v1-english"
    groq_tts_model_ar: str = "canopylabs/orpheus-arabic-saudi"
    groq_tts_voice_en: str = "daniel"  # male English voice
    groq_tts_voice_ar: str = "fahad"  # male Saudi voice

    # --- Qdrant Cloud (RAG vector store) ---
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "sakina_counseling"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # --- Hugging Face ─────────────────────────────────────────────────────────
    hf_token: str = ""

    # --- OpenTelemetry → Collector → Axiom ---
    # OTLP/gRPC endpoint of the Collector. Empty → telemetry no-ops (local/CI/tests).
    otel_exporter_otlp_endpoint: str = ""
    otel_service_name: str = "sakina-api"
    otel_metric_export_interval_ms: int = 15000  # how often metrics flush to the Collector
    # Direct Axiom export (HF Space path — no collector running there).
    # Set AXIOM_TOKEN + AXIOM_DATASET on HF Space secrets/variables; the API exports
    # directly via OTLP HTTP instead of routing through the local collector.
    axiom_token: str = ""
    axiom_dataset: str = ""

    # comma-separated str (pydantic-settings JSON-decodes list fields, tripping on plain values)
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    model_cache_dir: Path = _REPO_ROOT / "downloaded_models"

    use_reranker: bool = False

    # --- Redis (conversation memory + cache) ---
    redis_url: str = ""  # empty OR unreachable → in-process fallback
    memory_max_turns: int = 8
    session_ttl_seconds: int = 86400  # 24h
    cache_ttl_seconds: int = 3600  # 1h

    # --- Crisis hotlines ---
    # The AR number is a PLACEHOLDER from the project spec — VERIFY against a real
    # regional hotline before shipping (safety-critical, user-facing).
    crisis_en_number: str = "988"
    crisis_en_text: str = "Text HOME to 741741"
    crisis_ar_number: str = "8001717"  # TODO: verify regional AR crisis line
    crisis_help_webhook_url: str = "https://ahmedgamal7207.app.n8n.cloud/webhook/letter-forward"

    @property
    def artifacts_dir(self) -> Path:
        return ARTIFACTS_DIR

    @property
    def hf_home_dir(self) -> Path:
        return self.model_cache_dir / "huggingface"

    @property
    def hf_hub_cache_dir(self) -> Path:
        return self.hf_home_dir / "hub"

    @property
    def sentence_transformers_cache_dir(self) -> Path:
        return self.model_cache_dir / "sentence_transformers"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def crisis_hotline(self) -> dict:
        """Bilingual hotline payload for the crisis card."""
        return {
            "en": {"number": self.crisis_en_number, "text": self.crisis_en_text},
            "ar": {"number": self.crisis_ar_number},
        }


settings = Settings()
settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
settings.hf_home_dir.mkdir(parents=True, exist_ok=True)
settings.hf_hub_cache_dir.mkdir(parents=True, exist_ok=True)
settings.sentence_transformers_cache_dir.mkdir(parents=True, exist_ok=True)
os.environ["HF_HOME"] = str(settings.hf_home_dir)
os.environ["HF_HUB_CACHE"] = str(settings.hf_hub_cache_dir)
os.environ["TRANSFORMERS_CACHE"] = str(settings.hf_hub_cache_dir)
os.environ["SENTENCE_TRANSFORMERS_HOME"] = str(settings.sentence_transformers_cache_dir)
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
if settings.hf_token:
    os.environ["HF_TOKEN"] = settings.hf_token
