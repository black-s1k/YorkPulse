"""Redis service for caching and rate limiting."""

from typing import Any

import redis.asyncio as redis

from app.core.config import settings


class RedisService:
    """Service for Redis operations."""

    def __init__(self):
        self.redis_url = settings.upstash_redis_url
        self._client: redis.Redis | None = None

    async def get_client(self) -> redis.Redis:
        """Get or create Redis client."""
        if self._client is None:
            self._client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._client

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None

    async def get(self, key: str) -> str | None:
        """Get a value from Redis."""
        client = await self.get_client()
        return await client.get(key)

    async def set(
        self,
        key: str,
        value: str,
        expire_seconds: int | None = None,
    ) -> bool:
        """Set a value in Redis."""
        client = await self.get_client()
        if expire_seconds:
            return await client.setex(key, expire_seconds, value)
        return await client.set(key, value)

    async def delete(self, key: str) -> int:
        """Delete a key from Redis."""
        client = await self.get_client()
        return await client.delete(key)

    async def incr(self, key: str) -> int:
        """Increment a counter."""
        client = await self.get_client()
        return await client.incr(key)

    async def expire(self, key: str, seconds: int) -> bool:
        """Set expiration on a key."""
        client = await self.get_client()
        return await client.expire(key, seconds)

    async def ttl(self, key: str) -> int:
        """Get time to live for a key."""
        client = await self.get_client()
        return await client.ttl(key)


class RateLimiter:
    """Rate limiter using Redis sliding window."""

    def __init__(
        self,
        redis_service: RedisService,
        max_requests: int = 100,
        window_seconds: int = 60,
    ):
        self.redis = redis_service
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def is_allowed(self, identifier: str, endpoint: str = "default") -> tuple[bool, dict]:
        """Check if request is allowed under rate limit.

        Args:
            identifier: User ID or IP address
            endpoint: Optional endpoint identifier for per-endpoint limits

        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        key = f"rate_limit:{endpoint}:{identifier}"

        try:
            client = await self.redis.get_client()

            # Increment counter
            current = await client.incr(key)

            # Set expiry on first request
            if current == 1:
                await client.expire(key, self.window_seconds)

            # Get TTL
            ttl = await client.ttl(key)

            info = {
                "limit": self.max_requests,
                "remaining": max(0, self.max_requests - current),
                "reset_in": ttl if ttl > 0 else self.window_seconds,
            }

            return current <= self.max_requests, info

        except Exception:
            # On Redis error, allow the request
            return True, {
                "limit": self.max_requests,
                "remaining": self.max_requests,
                "reset_in": self.window_seconds,
            }

    async def get_remaining(self, identifier: str, endpoint: str = "default") -> int:
        """Get remaining requests for an identifier."""
        key = f"rate_limit:{endpoint}:{identifier}"

        try:
            current = await self.redis.get(key)
            if current is None:
                return self.max_requests
            return max(0, self.max_requests - int(current))
        except Exception:
            return self.max_requests


# Singleton instances
redis_service = RedisService()
rate_limiter = RateLimiter(
    redis_service,
    max_requests=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
)
