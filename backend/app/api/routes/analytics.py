"""Activity tracking ingestion routes.

Uses CurrentUserOptional throughout — pre-auth page views (landing page,
login/signup flow) must still be capturable, tied to a session_id rather
than a user_id until the session is later "claimed" by a login.
"""

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import CurrentUserOptional
from app.models.activity import TrackingConsent
from app.schemas.activity import (
    ConsentRequest,
    ConsentResponse,
    ReplayChunkRequest,
    StartSessionRequest,
    StartSessionResponse,
    TrackEventsRequest,
)
from app.services.activity import activity_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Activity Tracking"])


@router.post("/sessions", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest,
    http_request: Request,
    user: CurrentUserOptional,
):
    """Start a new browser session. Called once per tab/session by the
    frontend's <ActivityTracker />, before any events are sent."""
    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else None)
    session_id = str(uuid.uuid4())

    await activity_service.start_session(
        session_id,
        user_id=str(user.id) if user else None,
        product_analytics_consented=False,  # set via /analytics/consent, not assumed here
        replay_consented=False,
        consent_version=None,
        device_type=request.device_type,
        browser=request.browser,
        landing_path=request.landing_path,
        ip_address=real_ip,
    )
    return StartSessionResponse(session_id=session_id)


@router.post("/events")
async def track_events(
    request: TrackEventsRequest,
    user: CurrentUserOptional,
):
    """Batched event ingestion — the frontend flushes its buffer here
    (periodic timer + sendBeacon on pagehide), not one request per event."""
    items = []
    now = datetime.now(UTC).isoformat()
    expires_at = int(time.time()) + settings.activity_events_ttl_days * 86400
    for event in request.events:
        event_id = str(uuid.uuid4())
        occurred_at = event.occurred_at or now
        pk = str(user.id) if user else request.session_id
        item = {
            "pk": pk,
            "sk": f"{occurred_at}#{event_id}",
            "event_id": event_id,
            "occurred_at": occurred_at,
            "user_id": str(user.id) if user else None,
            "session_id": request.session_id,
            "event_type": event.event_type,
            "category": event.category,
            "source": "frontend_explicit",
            "expires_at": expires_at,
        }
        if event.entity_type:
            item["entity_type"] = event.entity_type
        if event.entity_id:
            item["entity_id"] = event.entity_id
        if event.properties:
            item["properties"] = event.properties
        items.append(item)

    await activity_service.batch_emit(items)
    return {"accepted": len(items)}


@router.post("/sessions/{session_id}/replay-chunk")
async def record_replay_chunk(session_id: str, request: ReplayChunkRequest):
    """Records that a replay chunk landed in DynamoDB — the chunk itself is
    written directly by the client (see ActivitySessions in the DynamoDB
    schema); this is just the metadata pointer, mirroring how S3Service's
    presigned-upload flow works elsewhere in this codebase."""
    await activity_service.record_replay_chunk(session_id, request.chunk_key, request.byte_size)
    return {"recorded": True}


@router.post("/consent", response_model=ConsentResponse)
async def record_consent(
    request: ConsentRequest,
    http_request: Request,
    user: CurrentUserOptional,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Append-only consent ledger write — never overwrites a prior row, so
    there's always an audit trail of exactly what was agreed to and when.
    Requires an authenticated user (consent is tied to an account, not an
    anonymous session)."""

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else None)

    consent = TrackingConsent(
        id=uuid.uuid4(),
        user_id=user.id,
        policy_version=request.policy_version,
        consent_scope=request.consent_scope,
        action=request.action,
        ip_address=real_ip,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(consent)

    return ConsentResponse(
        id=str(consent.id),
        consent_scope=consent.consent_scope,
        action=consent.action,
        recorded_at=consent.recorded_at.isoformat(),
    )


@router.get("/consent/status")
async def get_consent_status(
    user: CurrentUserOptional,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Current consent state per scope — the *latest* action per
    consent_scope, derived from the append-only ledger. Used by the
    "Privacy & Activity" profile section to show what's currently granted."""

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    result = await db.execute(
        select(TrackingConsent)
        .where(TrackingConsent.user_id == user.id)
        .order_by(TrackingConsent.recorded_at.desc())
    )
    rows = result.scalars().all()

    latest_by_scope: dict[str, str] = {}
    for row in rows:
        if row.consent_scope not in latest_by_scope:
            latest_by_scope[row.consent_scope] = row.action

    return {
        "product_analytics": latest_by_scope.get("product_analytics", "withdrawn") == "granted",
        "session_replay": latest_by_scope.get("session_replay", "withdrawn") == "granted",
    }
