#!/usr/bin/env bash
#
# start.sh — bring up the full Sakina stack: Redis (optional) + FastAPI + frontend.
#
# Usage:
#   ./start.sh                 # start everything
#   ./start.sh --no-redis      # skip the Redis container (API uses in-process memory)
#   API_PORT=8001 WEB_PORT=5173 ./start.sh   # override ports
#
# Press Ctrl+C once to stop the whole stack (the Redis container is left running
# so conversation memory survives between sessions — stop it with: docker rm -f sakina-redis).

set -euo pipefail

# --- resolve repo root (works regardless of where you run this from) ---------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

API_PORT="${API_PORT:-8001}"
WEB_PORT="${WEB_PORT:-5173}"
USE_REDIS=true
[[ "${1:-}" == "--no-redis" ]] && USE_REDIS=false

# --- pretty output -----------------------------------------------------------
c_blue=$'\033[34m'; c_green=$'\033[32m'; c_yellow=$'\033[33m'; c_red=$'\033[31m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
log()  { echo "${c_blue}▸${c_off} $*"; }
ok()   { echo "${c_green}✓${c_off} $*"; }
warn() { echo "${c_yellow}!${c_off} $*"; }
die()  { echo "${c_red}✗ $*${c_off}" >&2; exit 1; }

# --- prerequisites -----------------------------------------------------------
command -v uv   >/dev/null 2>&1 || die "uv not found. Install: https://docs.astral.sh/uv/"
command -v node >/dev/null 2>&1 || die "node not found. Install Node 18+."
[[ -f api/.env ]] || die "api/.env missing. Copy it:  cp api/.env.example api/.env  (then fill LIGHTNING_*, QDRANT_*)"

# frontend deps + env (auto-fix if missing)
if [[ ! -d frontend/node_modules ]]; then
  log "frontend deps missing — running npm install..."
  ( cd frontend && npm install )
fi
if [[ ! -f frontend/.env.local ]]; then
  log "frontend/.env.local missing — creating from example"
  cp frontend/.env.example frontend/.env.local
fi

# --- Redis (optional) --------------------------------------------------------
if $USE_REDIS; then
  if command -v docker >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' | grep -qx 'sakina-redis'; then
      ok "Redis already running (sakina-redis)"
    elif docker ps -a --format '{{.Names}}' | grep -qx 'sakina-redis'; then
      docker start sakina-redis >/dev/null && ok "Started existing Redis container (sakina-redis)"
    else
      docker run -d --name sakina-redis -p 6379:6379 redis:7-alpine >/dev/null \
        && ok "Launched Redis container (sakina-redis)"
    fi
  else
    warn "docker not found — skipping Redis (API falls back to in-process memory)"
  fi
else
  warn "--no-redis: skipping Redis (API falls back to in-process memory)"
fi

# --- teardown: kill the whole process group on exit / Ctrl+C -----------------
cleanup() {
  trap - INT TERM EXIT
  echo
  log "shutting down API + frontend..."
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# --- start API + frontend ----------------------------------------------------
log "starting API   → http://localhost:${API_PORT}  (first run downloads models — be patient)"
( cd "$ROOT/api" && exec uv run uvicorn app.main:app --reload --port "$API_PORT" ) &

log "starting web   → http://localhost:${WEB_PORT}"
( cd "$ROOT/frontend" && exec npm run dev -- --port "$WEB_PORT" ) &

echo
ok  "Sakina is starting. Open ${c_green}http://localhost:${WEB_PORT}${c_off}"
echo "${c_dim}   API docs: http://localhost:${API_PORT}/docs   ·   health: http://localhost:${API_PORT}/healthz${c_off}"
echo "${c_dim}   Press Ctrl+C to stop everything.${c_off}"
echo

# wait for both background jobs; Ctrl+C triggers cleanup()
wait
