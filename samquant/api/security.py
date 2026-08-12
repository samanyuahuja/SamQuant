"""Small, dependency-free controls for the private research-engine boundary."""

from __future__ import annotations

from collections import defaultdict, deque
from hmac import compare_digest
from threading import Lock
from time import monotonic


class SlidingWindowLimiter:
    """Bound expensive work per process; edge limits remain the first layer."""

    def __init__(self, *, requests: int, window_seconds: int) -> None:
        self.requests = requests
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> tuple[bool, int]:
        now = monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.requests:
                retry_after = max(1, int(events[0] + self.window_seconds - now) + 1)
                return False, retry_after
            events.append(now)
            return True, 0


def valid_internal_key(supplied: str | None, expected: str | None) -> bool:
    """Compare the server-to-server secret without leaking match timing."""
    if not supplied or not expected:
        return False
    return compare_digest(supplied.encode(), expected.encode())
