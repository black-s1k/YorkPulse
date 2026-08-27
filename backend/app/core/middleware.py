"""FastAPI middleware for rate limiting and other cross-cutting concerns."""

import json
import time
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.services.redis import rate_limiter, redis_service

# Cached set for O(1) origin lookup
_CORS_ORIGINS: set[str] = set()


def _cors_headers(request: Request) -> dict[str, str]:
    """Return CORS headers for the request origin if it's in the allowed list."""
    global _CORS_ORIGINS
    if not _CORS_ORIGINS:
        _CORS_ORIGINS = set(settings.cors_origins)
    origin = request.headers.get("origin", "")
    if origin in _CORS_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}

logger = logging.getLogger(__name__)

# Auth endpoints get a much stricter per-IP limit.
AUTH_ENDPOINTS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/resend-otp",
    "/api/v1/auth/verify-otp",
    "/api/v1/auth/admin-login",
}

# Endpoints that trigger an outbound email (Gmail SMTP) or Supabase Auth
# call — the scarce, externally-limited resources. These get the tighter
# global ceiling. The remainder of AUTH_ENDPOINTS (OTP verification, admin
# password login) don't send email but still hit the DB/JWT signing, so they
# get a separate, higher global ceiling instead of being unlimited.
OTP_SEND_ENDPOINTS = {
    "/api/v1/auth/signup",
    "/api/v1/auth/login",
    "/api/v1/auth/resend-otp",
}

# Health check is always exempt — ALB probes should never be rate-limited.
EXEMPT_ENDPOINTS = {"/api/v1/health"}

# In-process fallback for when Redis is unavailable
_ip_request_counts: dict[str, list[float]] = {}


def _get_real_ip(request: Request) -> str:
    """
    Extract the real client IP.
    Priority: CF-Connecting-IP (Cloudflare) → X-Forwarded-For first entry → direct.
    CF-Connecting-IP is the most trustworthy when behind Cloudflare.
    X-Forwarded-For first entry is used when behind ALB only.
    """
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _parse_whitelist() -> set[str]:
    """Parse whitelisted IPs from config (comma-separated)."""
    raw = settings.rate_limit_whitelist_ips
    return {ip.strip() for ip in raw.split(",") if ip.strip()}


def _parse_blocklist() -> set[str]:
    """Parse permanently blocked IPs from config (comma-separated)."""
    raw = settings.blocked_ips
    return {ip.strip() for ip in raw.split(",") if ip.strip()}


async def _get_email_from_body(request: Request) -> str | None:
    """
    Extract email from a JSON request body for per-email rate limiting.
    Starlette caches request.body() so downstream handlers can still read it.
    Returns None if body is not JSON, missing email, or any error occurs.
    """
    try:
        body = await request.body()
        if body:
            data = json.loads(body)
            email = str(data.get("email", "")).lower().strip()
            return email or None
    except Exception:
        pass
    return None


class TimingMiddleware(BaseHTTPMiddleware):
    """Log request timing and real client IP on every request."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        real_ip = _get_real_ip(request)

        # Store real IP on request state so routes can access it
        request.state.real_ip = real_ip

        response = await call_next(request)

        process_time = time.time() - start_time

        if process_time > 1.0:
            logger.warning(
                "SLOW REQUEST: %s %s took %.2fs (ip=%s)",
                request.method, request.url.path, process_time, real_ip,
            )

        response.headers["X-Process-Time"] = f"{process_time:.3f}"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Three-tier rate limiting:
      1. Whitelisted IPs (admin/dev): no limit at all.
      2. Auth endpoints: dual check —
           - Per-email: 5 req/60s (prevents brute-force on a single account)
           - Per-IP:    30 req/60s (allows shared campus/dorm networks)
      3. Everything else: 12 req/60s per IP.
    """

    def __init__(self, app):
        super().__init__(app)
        self._whitelist = _parse_whitelist()
        self._blocklist = _parse_blocklist()

    async def dispatch(self, request: Request, call_next) -> Response:
        real_ip = _get_real_ip(request)
        path = request.url.path

        # Health checks always pass through
        if path in EXEMPT_ENDPOINTS:
            return await call_next(request)

        # Permanently blocked IPs — hard 403, no further processing
        if real_ip in self._blocklist:
            logger.warning("BLOCKED IP REQUEST: ip=%s path=%s", real_ip, path)
            return Response(
                content='{"detail": "Access denied."}',
                status_code=403,
                media_type="application/json",
                headers=_cors_headers(request),
            )

        # Whitelisted IPs bypass all rate limits
        if real_ip in self._whitelist:
            return await call_next(request)

        # Dual-key limit on auth endpoints
        if path in AUTH_ENDPOINTS:
            # Dynamic auto-block: an IP that has repeatedly tripped auth rate
            # limits gets hard-blocked for a cooldown. Single Redis GET, no
            # further processing — the cheapest possible rejection for an
            # attacker IP still hammering us after being throttled.
            try:
                if await redis_service.get(f"auto_block:{real_ip}"):
                    return Response(
                        content='{"detail": "Too many requests. Please wait before trying again."}',
                        status_code=429,
                        media_type="application/json",
                        headers={"Retry-After": str(settings.auto_block_duration_seconds), **_cors_headers(request)},
                    )
            except Exception:
                pass  # Redis unavailable — fall through to the checks below

            # Sitewide aggregate ceiling — checked before the per-IP/per-email
            # checks because it's what actually stops a botnet. Rotating
            # through thousands of source IPs (or a fresh fake email per
            # request) never raises this counter, since it has no identity
            # dimension at all.
            if await self._check_global_limit(path):
                logger.warning("GLOBAL AUTH RATE LIMIT EXCEEDED: path=%s ip=%s", path, real_ip)
                await self._record_violation(real_ip)
                return Response(
                    content='{"detail": "Too many requests right now. Please try again shortly."}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(settings.rate_limit_auth_window_seconds), **_cors_headers(request)},
                )

            email = await _get_email_from_body(request)
            blocked, reason = await self._check_auth_limit(real_ip, path, email)
            if blocked:
                logger.warning(
                    "AUTH RATE LIMIT EXCEEDED: ip=%s email=%s path=%s reason=%s",
                    real_ip, email or "unknown", path, reason,
                )
                await self._record_violation(real_ip)
                return Response(
                    content='{"detail": "Too many requests. Please wait before trying again."}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(settings.rate_limit_auth_window_seconds), **_cors_headers(request)},
                )

        # Global limit for all other endpoints
        identifier = self._get_identifier(request, real_ip)
        is_allowed, info = await rate_limiter.is_allowed(identifier, path)

        if not is_allowed:
            logger.warning(
                "GLOBAL RATE LIMIT EXCEEDED: ip=%s path=%s", real_ip, path
            )
            return Response(
                content='{"detail": "Rate limit exceeded. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(info["reset_in"]),
                    "Retry-After": str(info["reset_in"]),
                    **_cors_headers(request),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset_in"])
        return response

    async def _check_auth_limit(self, ip: str, path: str, email: str | None) -> tuple[bool, str]:
        """
        Dual-key auth rate limiting.
        Returns (blocked: bool, reason: str).

        Per-email limit (rate_limit_auth_requests / window):
          Prevents an attacker from brute-forcing a specific account.
          Key is the email address — unaffected by shared IPs.

        Per-IP limit (rate_limit_auth_ip_requests / window):
          Broad cap to prevent mass account enumeration from one IP.
          Set high enough (30/60s) that a campus WiFi full of students
          logging in simultaneously never hits it.
        """
        window = settings.rate_limit_auth_window_seconds
        email_limit = settings.rate_limit_auth_requests      # 5 per email
        ip_limit = settings.rate_limit_auth_ip_requests      # 30 per IP

        try:
            # --- Per-email check (only when email is present) ---
            if email:
                email_key = f"auth_rate:email:{window}:{email}"
                email_count = await redis_service.incr(email_key)
                if email_count == 1:
                    await redis_service.expire(email_key, window)
                if email_count > email_limit:
                    logger.warning(
                        "AUTH EMAIL FLOOD: email=%s count=%d path=%s", email, email_count, path
                    )
                    return True, "email"

            # --- Per-IP check ---
            ip_key = f"auth_rate:ip:{window}:{ip}"
            ip_count = await redis_service.incr(ip_key)
            if ip_count == 1:
                await redis_service.expire(ip_key, window)
            if ip_count > ip_limit:
                logger.warning(
                    "AUTH IP FLOOD: ip=%s count=%d path=%s", ip, ip_count, path
                )
                return True, "ip"

            return False, ""

        except Exception:
            # In-process fallback when Redis is unavailable — IP-only sliding window
            now = time.time()
            window_start = now - window
            times = _ip_request_counts.get(ip, [])
            times = [t for t in times if t > window_start]
            times.append(now)
            _ip_request_counts[ip] = times
            blocked = len(times) > ip_limit
            return blocked, "ip_fallback"

    async def _check_global_limit(self, path: str) -> bool:
        """
        Sitewide aggregate ceiling(s) with no per-IP or per-email dimension —
        the actual defence against a distributed botnet, since per-IP/per-
        email limits are trivially bypassed by rotating source IPs or
        generating a fresh fake email each request. Returns True if this
        request should be blocked.

        OTP-send endpoints check two windows (burst + hourly): a lone short
        window lets an attacker sustain just-under-threshold traffic
        indefinitely and still exhaust the mailbox's daily send quota in
        minutes. The hourly tier is what actually catches that.
        """
        if path in OTP_SEND_ENDPOINTS:
            tiers = [
                ("otp_burst", settings.rate_limit_global_otp_burst_requests, settings.rate_limit_global_otp_burst_window_seconds),
                ("otp_hourly", settings.rate_limit_global_otp_hourly_requests, settings.rate_limit_global_otp_hourly_window_seconds),
            ]
        else:
            tiers = [
                ("auth", settings.rate_limit_global_auth_requests, settings.rate_limit_global_auth_window_seconds),
            ]

        try:
            for bucket, limit, window in tiers:
                key = f"global_rate:{bucket}:{window}"
                count = await redis_service.incr(key)
                if count == 1:
                    await redis_service.expire(key, window)
                if count > limit:
                    return True
            return False
        except Exception:
            return False  # Redis unavailable — fail open, rely on per-IP/email checks

    async def _record_violation(self, ip: str) -> None:
        """
        Track repeated rate-limit violations per IP. Once an IP trips
        auth_violation_threshold limits within the violation window, it gets
        auto-blocked for auto_block_duration_seconds — each burner IP in a
        botnet only gets a handful of tries before it's benched, instead of
        being able to retry indefinitely at just-under-the-limit rates.
        """
        try:
            key = f"auth_violations:{ip}"
            count = await redis_service.incr(key)
            if count == 1:
                await redis_service.expire(key, settings.auth_violation_window_seconds)
            if count >= settings.auth_violation_threshold:
                await redis_service.set(
                    f"auto_block:{ip}", "1", expire_seconds=settings.auto_block_duration_seconds
                )
                logger.warning("AUTO-BLOCKED IP: ip=%s violations=%d", ip, count)
        except Exception:
            pass  # Redis unavailable — no auto-block this round, not fatal

    def _get_identifier(self, request: Request, real_ip: str) -> str:
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return f"ip:{real_ip}"
