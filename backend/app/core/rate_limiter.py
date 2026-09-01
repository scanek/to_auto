import time
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    def __init__(self):
        self._records = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str, max_requests: int, window_seconds: int, error_message: str = "Слишком много запросов. Пожалуйста, подождите."):
        now = time.time()
        with self._lock:
            # Purge expired timestamps
            timestamps = [t for t in self._records[key] if now - t < window_seconds]
            if len(timestamps) >= max_requests:
                retry_after = int(window_seconds - (now - timestamps[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"{error_message} Попробуйте снова через {retry_after} сек.",
                    headers={"Retry-After": str(retry_after)}
                )
            timestamps.append(now)
            self._records[key] = timestamps

limiter = InMemoryRateLimiter()

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"
