"""Blocage temporaire d'un compte après trop d'échecs de connexion (anti force brute).

Gardé en mémoire : simple et suffisant pour un seul processus. Avec plusieurs instances
du service, il faudrait un stockage partagé (Redis par exemple).
"""

import time
from dataclasses import dataclass
from threading import Lock

from . import config


@dataclass
class _Entry:
    failures: int = 0
    locked_until: float = 0.0


_entries: dict[str, _Entry] = {}
_lock = Lock()


def _key(username: str) -> str:
    return username.strip().lower()


def seconds_locked(username: str) -> int:
    """Secondes restantes de blocage (0 si le compte n'est pas bloqué)."""
    with _lock:
        entry = _entries.get(_key(username))
        remaining = entry.locked_until - time.monotonic() if entry else 0
        return max(0, round(remaining))


def record_failure(username: str) -> None:
    with _lock:
        entry = _entries.setdefault(_key(username), _Entry())
        entry.failures += 1
        if entry.failures >= config.LOGIN_MAX_FAILURES:
            entry.locked_until = time.monotonic() + config.LOGIN_LOCK_MINUTES * 60
            entry.failures = 0


def record_success(username: str) -> None:
    with _lock:
        _entries.pop(_key(username), None)


def reset() -> None:
    """Pour les tests."""
    with _lock:
        _entries.clear()
