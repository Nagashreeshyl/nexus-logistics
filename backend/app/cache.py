"""Fast cache: Redis when available, otherwise in-process TTL store."""

from __future__ import annotations

import json
import os
import threading
import time
from typing import Any

_REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
_PREFIX = os.getenv("CACHE_PREFIX", "jp019:")


class _MemoryBackend:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._store: dict[str, tuple[float, str]] = {}

    def get(self, key: str) -> str | None:
        with self._lock:
            row = self._store.get(key)
            if not row:
                return None
            expires, raw = row
            if expires and expires < time.time():
                self._store.pop(key, None)
                return None
            return raw

    def set(self, key: str, value: str, ttl: int) -> None:
        with self._lock:
            expires = time.time() + ttl if ttl > 0 else 0.0
            self._store[key] = (expires, value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def ping(self) -> bool:
        return True


class Cache:
    def __init__(self) -> None:
        self.backend: Any = _MemoryBackend()
        self.mode = "memory"
        try:
            import redis  # type: ignore

            client = redis.Redis.from_url(_REDIS_URL, decode_responses=True, socket_connect_timeout=0.4)
            client.ping()
            self.backend = client
            self.mode = "redis"
        except Exception:
            self.backend = _MemoryBackend()
            self.mode = "memory"

    def get_json(self, key: str) -> Any | None:
        raw = self.backend.get(_PREFIX + key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    def set_json(self, key: str, value: Any, ttl: int = 300) -> None:
        raw = json.dumps(value)
        full = _PREFIX + key
        if self.mode == "redis":
            self.backend.setex(full, ttl, raw)
        else:
            self.backend.set(full, raw, ttl)

    def delete(self, key: str) -> None:
        self.backend.delete(_PREFIX + key)

    def info(self) -> dict[str, Any]:
        return {"mode": self.mode, "prefix": _PREFIX, "redis_url": _REDIS_URL if self.mode == "redis" else None}


cache = Cache()
