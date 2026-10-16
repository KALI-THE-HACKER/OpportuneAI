import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config.settings import settings
from services.feed_service import get_redis_client
from utils.request_context import request_id_var


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_var.reset(token)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.api_rate_limit_enabled:
            return await call_next(request)

        path = request.url.path
        if path in {"/", "/health", "/ready", "/api/v1/health", "/api/v1/ready"}:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        window = settings.api_rate_limit_window_seconds
        limit = settings.api_rate_limit_requests
        current_bucket = int(time.time() // window)
        key = f"ratelimit:{client_ip}:{current_bucket}"

        try:
            redis_client = get_redis_client()
            current = redis_client.incr(key)
            if current == 1:
                redis_client.expire(key, window)
            if current > limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please retry shortly."},
                )
        except Exception:
            # Fail-open if Redis is unavailable
            pass

        return await call_next(request)
