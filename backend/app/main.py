import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.core.middleware import RateLimitMiddleware, TimingMiddleware
from app.api.routes import admin_personas, auth, buddy, courses, dashboard, feedback, gigs, health, map, marketplace, messaging, push_notifications, reports, residences, reviews, transactions, vault
from app.services.redis import redis_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    logger.info("Starting %s...", settings.app_name)

    # NOTE: periodic quest cleanup used to run as an in-process asyncio loop here.
    # It now runs as a separate scheduled Lambda (app/cleanup_handler.py) invoked
    # hourly by EventBridge, since a long-lived in-process loop cannot survive
    # Lambda freezing the execution environment between invocations.

    yield

    # Shutdown
    logger.info("Shutting down %s...", settings.app_name)
    await redis_service.close()


app = FastAPI(
    title=settings.app_name,
    description="Community and safety platform for York University students",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Timing middleware (logs slow requests > 1s)
app.add_middleware(TimingMiddleware)

# Rate limiting
app.add_middleware(RateLimitMiddleware)

# Routes
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(vault.router, prefix=settings.api_prefix)
app.include_router(marketplace.router, prefix=settings.api_prefix)
app.include_router(buddy.router, prefix=settings.api_prefix)
app.include_router(messaging.router, prefix=settings.api_prefix)
app.include_router(reviews.router, prefix=settings.api_prefix)
app.include_router(transactions.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
app.include_router(courses.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
app.include_router(feedback.router, prefix=settings.api_prefix)
app.include_router(gigs.router, prefix=settings.api_prefix)
app.include_router(map.router, prefix=settings.api_prefix)
app.include_router(residences.router, prefix=settings.api_prefix)
app.include_router(push_notifications.router, prefix=settings.api_prefix)
app.include_router(admin_personas.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "message": "Welcome to YorkPulse API",
        "docs": "/api/docs",
        "version": "1.0.0",
    }
