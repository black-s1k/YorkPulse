"""User activity tracking models.

Deliberately named "Activity", never "Persona" — User.is_persona and
admin_personas.py already use that word for an unrelated concept (admin-seeded
synthetic accounts used to bootstrap content). See the feature's implementation
plan for the full reasoning.

Everything lives in the existing Supabase Postgres database — no separate
AWS/NoSQL store. That was a deliberate pivot away from an earlier DynamoDB
design: this feature doesn't need AWS's scale or its need-a-credit-card
account, and this app's own admin-stats convention (dashboard.py etc.) is
already "compute live from Postgres," not a cached/streamed pipeline.
Performance is explicitly not a priority for this feature.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin


class ActivityEvent(Base, UUIDMixin):
    """Append-only raw event log — one row per tracked event, both the
    "free" request-level capture (ActivityLogMiddleware) and explicit rich
    domain events (activity_service.emit(), called from route handlers like
    login/Vault-post/DM-send).

    user_id has a real FK with ON DELETE CASCADE — unlike an earlier
    DynamoDB-based design, which deliberately avoided FKs for a NoSQL store
    with no built-in cascade. In Postgres, CASCADE is the simpler and more
    correct choice: deleting a user automatically purges their activity
    data too, with no separate manual purge step to maintain (see
    admin_delete_user in api/routes/auth.py, which no longer needs any
    activity-specific cleanup code as a result).
    """

    __tablename__ = "activity_events"

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # "backend_route" | "backend_middleware" | "frontend_explicit" | "frontend_pageview"
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    request_method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    request_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    # Flexible metadata bag — length/category/has-attachment flags, never
    # raw message/post text. First JSON column in this codebase's models.
    properties: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<ActivityEvent {self.event_type} user={self.user_id}>"


class ActivitySession(Base, UUIDMixin):
    """One mutable row per browser session — looked up and updated as rrweb
    replay chunks arrive, unlike the append-only event log. Replay chunks
    are stored inline as JSON (a list of rrweb event batches) rather than
    in object storage, since there's no S3/blob store in this design and
    the volume at this app's scale is small enough that it doesn't matter."""

    __tablename__ = "activity_sessions"

    user_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    product_analytics_consented: Mapped[bool] = mapped_column(default=False, nullable=False)
    replay_consented: Mapped[bool] = mapped_column(default=False, nullable=False)
    consent_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    browser: Mapped[str | None] = mapped_column(String(200), nullable=True)
    landing_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    event_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # List of rrweb event-batch chunks, appended as they arrive.
    replay_chunks: Mapped[list | None] = mapped_column(JSON, nullable=True)
    replay_byte_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<ActivitySession {self.id} user={self.user_id}>"


class TrackingConsent(Base, UUIDMixin):
    """Append-only consent ledger — one row per grant/withdrawal, never overwritten.

    An audit trail (not just a current-state flag) is a PIPEDA-meaningful-consent
    requirement: it must be possible to show exactly what a user agreed to and
    when, even after they later change their mind.
    """

    __tablename__ = "tracking_consents"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    policy_version: Mapped[str] = mapped_column(String(50), nullable=False)
    # "essential" | "product_analytics" | "session_replay"
    consent_scope: Mapped[str] = mapped_column(String(50), nullable=False)
    # "granted" | "withdrawn"
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    def __repr__(self) -> str:
        return f"<TrackingConsent user={self.user_id} scope={self.consent_scope} action={self.action}>"


class UserActivityProfile(Base, UUIDMixin):
    """Per-user aggregate summary. Refreshed synchronously whenever the
    admin "Activity" tab is opened (see admin_activity.py) rather than by a
    scheduled job — this app's own admin-stats convention is already
    "compute live," and at ~1,000 users a handful of grouped queries costs
    a few hundred ms at most, which is a non-issue for an admin-only view.

    Excludes is_persona=True (admin-seeded synthetic) accounts.
    """

    __tablename__ = "user_activity_profiles"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    last_computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    total_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_events: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_replay_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_page_views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_session_duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    days_active_last_30: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    most_active_hour_of_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    most_active_day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Monday

    vault_posts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    messages_sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    course_messages_sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    marketplace_listings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quests_joined_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gigs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    feature_usage_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Rule-based (not ML/black-box) — see activity_profile.py for the exact
    # thresholds. Documented and explainable is the point.
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # "power_user" | "casual" | "lurker" | "dormant"
    activity_label: Mapped[str] = mapped_column(String(20), default="dormant", nullable=False)

    def __repr__(self) -> str:
        return f"<UserActivityProfile user={self.user_id} label={self.activity_label}>"
