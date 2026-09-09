"""Activity tracking service — Postgres-backed (existing Supabase DB).

Deliberately not named "persona" anywhere (see app/models/activity.py's
module docstring). All writes go through the request-scoped AsyncSession,
same as every other write path in this codebase — no separate client to
lazily initialize (unlike app/services/s3.py's boto3 pattern), since
there's no external service here anymore. An earlier version of this
service used DynamoDB; that was replaced with plain Postgres because this
feature doesn't need AWS's scale, doesn't need a credit-card-bearing
account, and performance isn't a priority here — see the implementation
plan for the full reasoning.

Events reference other tables by entity_type/entity_id only — never raw
message/post text.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.activity import ActivityEvent, ActivitySession

logger = logging.getLogger(__name__)


class ActivityService:
    """Service for writing/reading activity events and sessions."""

    def is_configured(self) -> bool:
        """Gate for writes — the tracking kill switch. No external
        credentials to check anymore; this is just a feature flag."""
        return settings.activity_tracking_enabled

    async def emit(
        self,
        db: AsyncSession,
        *,
        user_id: str | None,
        session_id: str | None,
        event_type: str,
        category: str,
        source: str = "backend_route",
        entity_type: str | None = None,
        entity_id: str | None = None,
        properties: dict[str, Any] | None = None,
        ip_address: str | None = None,
        request_path: str | None = None,
        request_method: str | None = None,
        status_code: int | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Write a single event. Never raises — a tracking failure must
        never break the request it's attached to (same principle as the
        rest of this codebase's fire-and-forget logging: see
        SignupAttempt's try/except in auth.py). Metadata only: entity_id
        references the source table's row by ID — this function is never
        passed message/post body text."""
        if not self.is_configured():
            return

        try:
            event = ActivityEvent(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id) if user_id else None,
                session_id=uuid.UUID(session_id) if session_id else None,
                event_type=event_type,
                category=category,
                source=source,
                entity_type=entity_type,
                entity_id=uuid.UUID(entity_id) if entity_id else None,
                properties=properties,
                ip_address=ip_address,
                request_path=request_path,
                request_method=request_method,
                status_code=status_code,
                duration_ms=duration_ms,
            )
            db.add(event)
            await db.commit()
        except Exception as e:
            logger.warning("Activity event write failed: %s", e)
            await db.rollback()

    async def batch_emit(self, db: AsyncSession, events: list[dict[str, Any]]) -> None:
        """Write multiple events in one commit — used by the frontend
        batched-ingestion route. Never raises."""
        if not self.is_configured() or not events:
            return
        try:
            for e in events:
                db.add(ActivityEvent(**e))
            await db.commit()
        except Exception as e:
            logger.warning("Activity batch write failed: %s", e)
            await db.rollback()

    async def start_session(
        self,
        db: AsyncSession,
        session_id: str,
        *,
        user_id: str | None,
        product_analytics_consented: bool,
        replay_consented: bool,
        consent_version: str | None,
        device_type: str | None = None,
        browser: str | None = None,
        landing_path: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        if not self.is_configured():
            return
        try:
            session = ActivitySession(
                id=uuid.UUID(session_id),
                user_id=uuid.UUID(user_id) if user_id else None,
                product_analytics_consented=product_analytics_consented,
                replay_consented=replay_consented,
                consent_version=consent_version,
                device_type=device_type,
                browser=browser,
                landing_path=landing_path,
                ip_address=ip_address,
            )
            db.add(session)
            await db.commit()
        except Exception as e:
            logger.warning("Activity session start failed: %s", e)
            await db.rollback()

    async def record_replay_chunk(
        self, db: AsyncSession, session_id: str, chunk: Any, byte_size: int
    ) -> None:
        """Appends a replay chunk to the session's replay_chunks JSON list.
        No object storage involved — chunks are stored inline in Postgres,
        which is fine at this app's scale and given performance isn't a
        priority for this feature."""
        if not self.is_configured():
            return
        try:
            from sqlalchemy import select

            result = await db.execute(
                select(ActivitySession).where(ActivitySession.id == uuid.UUID(session_id))
            )
            session = result.scalar_one_or_none()
            if not session:
                return
            chunks = session.replay_chunks or []
            chunks.append(chunk)
            session.replay_chunks = chunks
            session.replay_byte_size = (session.replay_byte_size or 0) + byte_size
            await db.commit()
        except Exception as e:
            logger.warning("Activity replay chunk record failed: %s", e)
            await db.rollback()


async def purge_old_activity_data(db: AsyncSession) -> dict:
    """Retention enforcement — deletes rows past their configured window.
    Called from cleanup_handler.py, the existing scheduled job in this
    codebase, rather than standing up any new infrastructure. Session
    replay gets the shorter window (activity_sessions_ttl_days) since it's
    the most invasive category tracked; everything else uses
    activity_events_ttl_days."""
    now = datetime.now(UTC)
    events_cutoff = now - timedelta(days=settings.activity_events_ttl_days)
    sessions_cutoff = now - timedelta(days=settings.activity_sessions_ttl_days)

    events_result = await db.execute(
        delete(ActivityEvent).where(ActivityEvent.occurred_at <= events_cutoff).returning(ActivityEvent.id)
    )
    events_deleted = len(events_result.fetchall())

    sessions_result = await db.execute(
        delete(ActivitySession).where(ActivitySession.started_at <= sessions_cutoff).returning(ActivitySession.id)
    )
    sessions_deleted = len(sessions_result.fetchall())

    await db.commit()
    return {"events_deleted": events_deleted, "sessions_deleted": sessions_deleted}


# Singleton instance
activity_service = ActivityService()
