# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Sakina API container — multi-stage, CPU-only, layer-cache optimized.
#
# Build context is the REPO ROOT (the uv workspace lockfile lives there).
#   docker build -t sakina-api .
#
# Caching strategy: dependency manifests are copied and installed BEFORE the
# application source, so editing app code reuses the (heavy) dependency layer.
# ---------------------------------------------------------------------------

# ---- Stage 1: builder — resolve + install deps into a venv -----------------
FROM python:3.11-slim AS builder

# uv: fast, reproducible installs from the committed uv.lock.
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /build

# 1) Manifests only → this layer (the slow dependency install) caches until a
#    dependency actually changes. App-code edits never bust it.
COPY pyproject.toml uv.lock ./
COPY api/pyproject.toml api/pyproject.toml

# 2) Install ONLY the api package's deps (no dev group), CPU-only torch index.
#    --no-install-project: deps now; our own code is copied in the final stage.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project --package sakina-api

# ---- Stage 2: runtime — slim image with just the venv + app ----------------
FROM python:3.11-slim AS runtime

# Non-root user for safety; HF Spaces also expects a writable home.
RUN useradd -m -u 1000 app
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/app/.cache/huggingface \
    MODEL_CACHE_DIR=/home/app/downloaded_models

# Copy the resolved virtualenv from the builder (no build tools in runtime).
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# 3) App code + model artifacts last — the cheap, frequently-changing layer.
COPY --chown=app:app api/app ./app

USER app
EXPOSE 8000

# Liveness — model-free, fast.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
