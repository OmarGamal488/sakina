"""Redis-backed session memory and cache for Sakina.

History, per-session prior language, and a short-lived response cache live in Redis when
available; if ``settings.redis_url`` is empty or the server is unreachable at startup, the
module silently falls back to an in-process dict implementation (TTLs honoured via lazy
expiry on read).

Graceful-fallback contract: no public method ever raises — a Redis error is logged and
treated as a miss (reads) / no-op (writes) so a cache/memory failure can never break a chat
turn.

PII/TTL: history holds sensitive mental-health content, so every key is TTL'd (hist/lang =
session_ttl_seconds; cache = cache_ttl_seconds, overridable per call) and cannot accumulate
indefinitely.
"""

from __future__ import annotations

import json
import secrets
import time
from typing import TYPE_CHECKING

import structlog

from app.config import settings

if TYPE_CHECKING:
    import redis as redis_module

logger = structlog.get_logger(__name__)


def new_session_id() -> str:
    """Return a new unguessable, URL-safe session identifier (128-bit entropy)."""
    return secrets.token_urlsafe(16)


class _InProcessBackend:
    """Pure-Python in-memory store that honours TTLs via lazy expiry on read.

    Values are ``(value, expiry_ts)`` tuples; an expired value is treated as absent.
    """

    def __init__(self) -> None:
        # sid → list of {"role": str, "text": str}
        self._hist: dict[str, list[dict]] = {}
        # sid → (lang, expiry_ts)
        self._lang: dict[str, tuple[str, float]] = {}
        # key → (value, expiry_ts)
        self._cache: dict[str, tuple[str, float]] = {}

    # -- history --

    def hist_append(self, sid: str, entry: dict, max_turns: int, ttl: int) -> None:
        lst = self._hist.setdefault(sid, [])
        lst.append(entry)
        # trim from the front so only the newest max_turns entries remain
        if len(lst) > max_turns:
            del lst[: len(lst) - max_turns]
        # session expiry is stored in the lang slot and checked at get_history time
        self._lang.setdefault(sid, ("", time.time() + ttl))

    def hist_get(self, sid: str, max_turns: int) -> list[dict]:
        if not sid or sid not in self._hist:
            return []
        # Prune expired history via the lang-slot TTL heuristic.
        if sid in self._lang:
            _, exp = self._lang[sid]
            if time.time() > exp:
                self._hist.pop(sid, None)
                self._lang.pop(sid, None)
                return []
        lst = self._hist.get(sid, [])
        return lst[-max_turns:] if max_turns else lst

    def hist_expire(self, sid: str, ttl: int) -> None:
        """Refresh the session TTL (called after every append)."""
        if sid in self._lang:
            lang, _ = self._lang[sid]
            self._lang[sid] = (lang, time.time() + ttl)

    # -- prior lang --

    def lang_get(self, sid: str) -> str | None:
        if not sid or sid not in self._lang:
            return None
        lang, exp = self._lang[sid]
        if time.time() > exp:
            self._lang.pop(sid, None)
            self._hist.pop(sid, None)
            return None
        return lang or None

    def lang_set(self, sid: str, lang: str, ttl: int) -> None:
        self._lang[sid] = (lang, time.time() + ttl)

    # -- cache --

    def cache_get(self, key: str) -> str | None:
        if key not in self._cache:
            return None
        val, exp = self._cache[key]
        if time.time() > exp:
            del self._cache[key]
            return None
        return val

    def cache_set(self, key: str, value: str, ttl: int) -> None:
        self._cache[key] = (value, time.time() + ttl)


_HIST_PREFIX = "sakina:hist:"
_LANG_PREFIX = "sakina:lang:"
_CACHE_PREFIX = "sakina:cache:"


class SessionMemory:
    """Session history, prior language, and response cache backed by Redis or an
    in-process fallback.

    Use :func:`get_memory` rather than constructing directly. An empty or unreachable
    ``redis_url`` (default ``settings.redis_url``) activates the in-process fallback.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        url = redis_url if redis_url is not None else settings.redis_url
        self._redis: redis_module.Redis | None = None
        self._fallback: _InProcessBackend | None = None

        if url:
            try:
                import redis  # lazy — no hard dep at import time

                client: redis_module.Redis = redis.Redis.from_url(
                    url,
                    decode_responses=True,  # all responses are str, not bytes
                    socket_connect_timeout=1,  # fail fast if host is unreachable
                )
                client.ping()  # forces an actual connection attempt
                self._redis = client
                logger.info("memory_backend_active", memory_backend="redis", url=url)
            except Exception as exc:
                logger.warning(
                    "redis_unavailable_using_fallback",
                    error=str(exc),
                    memory_backend="memory",
                )
                self._fallback = _InProcessBackend()
        else:
            logger.info("memory_backend_active", memory_backend="memory", reason="redis_url_empty")
            self._fallback = _InProcessBackend()

    @property
    def _using_redis(self) -> bool:
        return self._redis is not None

    def _max_turns(self, max_turns: int | None) -> int:
        return max_turns if max_turns is not None else settings.memory_max_turns

    def get_history(self, session_id: str, max_turns: int | None = None) -> list[dict]:
        """Return conversation history for *session_id*, oldest first.

        Returns at most ``max_turns`` messages (default ``settings.memory_max_turns``).
        Returns an empty list for blank or unknown session IDs — never raises.
        """
        if not session_id:
            return []
        n = self._max_turns(max_turns)
        if self._using_redis:
            try:
                raw: list[str] = self._redis.lrange(  # type: ignore[union-attr]
                    _HIST_PREFIX + session_id, -n, -1
                )
                return [json.loads(item) for item in raw]
            except Exception as exc:
                logger.warning("memory_get_history_error", session_id=session_id, error=str(exc))
                return []
        # fallback
        assert self._fallback is not None
        return self._fallback.hist_get(session_id, n)

    def append_turn(self, session_id: str, role: str, text: str) -> None:
        """Append one ``{"role", "text"}`` message and refresh the session TTL.

        Silently trims the history to the ``memory_max_turns`` window.
        Never raises — a write failure is logged and swallowed.
        """
        if not session_id:
            return
        entry = json.dumps({"role": role, "text": text})
        n = settings.memory_max_turns
        ttl = settings.session_ttl_seconds
        if self._using_redis:
            try:
                key = _HIST_PREFIX + session_id
                self._redis.rpush(key, entry)  # type: ignore[union-attr]
                self._redis.ltrim(key, -n, -1)  # type: ignore[union-attr]
                self._redis.expire(key, ttl)  # type: ignore[union-attr]
            except Exception as exc:
                logger.warning("memory_append_turn_error", session_id=session_id, error=str(exc))
        else:
            assert self._fallback is not None
            self._fallback.hist_append(session_id, json.loads(entry), n, ttl)
            self._fallback.hist_expire(session_id, ttl)

    def get_prior_lang(self, session_id: str) -> str | None:
        """Return the previously detected language code for *session_id*, or None."""
        if not session_id:
            return None
        if self._using_redis:
            try:
                val: str | None = self._redis.get(_LANG_PREFIX + session_id)  # type: ignore[union-attr]
                return val  # already str because decode_responses=True
            except Exception as exc:
                logger.warning(
                    "memory_get_prior_lang_error", session_id=session_id, error=str(exc)
                )
                return None
        assert self._fallback is not None
        return self._fallback.lang_get(session_id)

    def set_prior_lang(self, session_id: str, lang: str) -> None:
        """Store *lang* as the session language with the session TTL."""
        if not session_id:
            return
        ttl = settings.session_ttl_seconds
        if self._using_redis:
            try:
                self._redis.setex(  # type: ignore[union-attr]
                    _LANG_PREFIX + session_id, ttl, lang
                )
            except Exception as exc:
                logger.warning(
                    "memory_set_prior_lang_error", session_id=session_id, error=str(exc)
                )
        else:
            assert self._fallback is not None
            self._fallback.lang_set(session_id, lang, ttl)

    def cache_get(self, key: str) -> str | None:
        """Return the cached string for *key*, or None on miss/error."""
        if not key:
            return None
        if self._using_redis:
            try:
                return self._redis.get(_CACHE_PREFIX + key)  # type: ignore[union-attr]
            except Exception as exc:
                logger.warning("memory_cache_get_error", key=key, error=str(exc))
                return None
        assert self._fallback is not None
        return self._fallback.cache_get(key)

    def cache_set(self, key: str, value: str, ttl: int | None = None) -> None:
        """Store *value* under *key* with an expiry of *ttl* seconds (default cache_ttl_seconds)."""
        if not key:
            return
        effective_ttl = ttl if ttl is not None else settings.cache_ttl_seconds
        if self._using_redis:
            try:
                self._redis.setex(  # type: ignore[union-attr]
                    _CACHE_PREFIX + key, effective_ttl, value
                )
            except Exception as exc:
                logger.warning("memory_cache_set_error", key=key, error=str(exc))
        else:
            assert self._fallback is not None
            self._fallback.cache_set(key, value, effective_ttl)


# Module-level lazy singleton
_memory_instance: SessionMemory | None = None


def get_memory() -> SessionMemory:
    """Return the module-level singleton :class:`SessionMemory`, constructing it on
    first call (connects to Redis or activates the in-process fallback)."""
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = SessionMemory()
    return _memory_instance


# Smoke test (in-process fallback only — no Redis required)
if __name__ == "__main__":
    import sys

    print("Smoke test — in-process fallback (redis_url='')")
    mem = SessionMemory(redis_url="")  # force fallback

    sid = new_session_id()
    print(f"\nnew_session_id():    {sid!r}")
    sid2 = new_session_id()
    print(f"second session_id:   {sid2!r}")
    assert sid != sid2, "session IDs must be distinct"

    # History: append a couple of turns, read them back.
    mem.append_turn(sid, "user", "Hello, I feel anxious today")
    mem.append_turn(sid, "assistant", "I'm sorry to hear that. Can you tell me more?")
    history = mem.get_history(sid)
    print(f"\nget_history ({len(history)} entries):")
    for entry in history:
        print(f"  {entry}")
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"

    # Prior language round-trip.
    assert mem.get_prior_lang(sid) is None, "should be None before set"
    mem.set_prior_lang(sid, "ar")
    lang = mem.get_prior_lang(sid)
    print(f"\nset_prior_lang 'ar' → get_prior_lang: {lang!r}")
    assert lang == "ar"

    # Cache miss → set → hit.
    assert mem.cache_get("test_key") is None, "should be cache miss"
    mem.cache_set("test_key", "cached_value")
    cached = mem.cache_get("test_key")
    print(f"\ncache miss → set 'cached_value' → cache_get: {cached!r}")
    assert cached == "cached_value"

    # Blank / unknown session ID is safe.
    assert mem.get_history("") == []
    assert mem.get_history("nonexistent-session") == []
    assert mem.get_prior_lang("") is None
    assert mem.get_prior_lang("nonexistent-session") is None
    print("\nBlank/unknown session IDs: safe (returned []/None as expected)")

    print("\nAll smoke-test assertions passed.")
    sys.exit(0)
