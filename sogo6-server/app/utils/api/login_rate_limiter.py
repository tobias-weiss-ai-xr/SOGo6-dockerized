"""Login rate-limiter and brute-force protection using Redis.

Tracks failed login attempts per user UID and optionally per source IP.
Uses the same Redis connection as the session cache, keyed under a
dedicated namespace.

Settings (from domain AuthSettings):
  SOGO_D_LOGIN_CHECK_MAX_ATTEMPT — max failed attempts before blocking
  SOGO_D_LOGIN_CHECK_TIME_SPAN   — window (seconds) for counting failures
  SOGO_D_LOGIN_CHECK_BLOCK_TIME  — how long (seconds) the block lasts

When MAX_ATTEMPT == 0 (the default), the limiter is disabled.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.utils.logger.logger import logger_api

if TYPE_CHECKING:
    from app.manager.cache.ClientRedis import ClientRedis

# Redis key prefixes
_PREFIX_FAIL = "login:fail:"
_PREFIX_BLOCK = "login:block:"


class LoginRateLimiter:
    """Check and record failed login attempts backed by Redis."""

    def __init__(self, redis_client: ClientRedis) -> None:
        self._redis = redis_client

    @property
    def _r(self):
        """Return the raw Redis connection from the ClientRedis wrapper."""
        return self._redis.redis

    # ── Public API ─────────────────────────────────────────────────────────

    def is_blocked(self, uid: str, max_attempt: int, block_time: int) -> bool:
        """Return ``True`` if *uid* is currently blocked."""
        if max_attempt <= 0:
            return False
        blocked = self._r.get(self._block_key(uid))
        return blocked is not None

    def record_failure(self, uid: str, time_span: int) -> int:
        """Increment the failure counter for *uid* and return the new count.

        The counter lives for *time_span* seconds, after which it
        auto-expires.
        """
        key = self._fail_key(uid)
        count = self._r.incr(key)
        if count == 1:
            self._r.expire(key, time_span)
        return count

    def block(self, uid: str, block_time: int) -> None:
        """Mark *uid* as blocked for *block_time* seconds."""
        self._r.setex(self._block_key(uid), block_time, "1")
        logger_api.warning("Login blocked for uid=%s (%d seconds)", uid, block_time)

    def reset_failures(self, uid: str) -> None:
        """Clear the failure counter (e.g. after a successful login)."""
        self._r.delete(self._fail_key(uid))
        self._r.delete(self._block_key(uid))

    def get_fail_count(self, uid: str) -> int:
        """Return the current number of consecutive failures."""
        val = self._r.get(self._fail_key(uid))
        return int(val) if val else 0

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _fail_key(uid: str) -> str:
        return f"{_PREFIX_FAIL}{uid}"

    @staticmethod
    def _block_key(uid: str) -> str:
        return f"{_PREFIX_BLOCK}{uid}"
