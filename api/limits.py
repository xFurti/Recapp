import time
from collections import defaultdict, deque

from fastapi import Request

_hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "?")


def allow(key: str, limit: int, window_seconds: int) -> bool:
    """Sliding-window counter kept in memory (single web instance)."""
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > window_seconds:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def reset() -> None:
    _hits.clear()
