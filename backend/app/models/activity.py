"""User activity tracking models.

Deliberately named "Activity", never "Persona" — User.is_persona and
admin_personas.py already use that word for an unrelated concept (admin-seeded
synthetic accounts used to bootstrap content). See the feature's implementation
plan for the full reasoning.

The high-volume raw event log and session-replay data live in DynamoDB, not
here (see app/services/activity.py) — these two tables are the low-volume,
FK-integrity-worth-having pieces: the consent audit trail and the per-user
aggregate profile.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin


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
    """Per-user aggregate — refreshed periodically by a scheduled Lambda
    (activity_profile_refresh_handler), not computed live. Excludes
    is_persona=True (admin-seeded synthetic) accounts.

    This is the single most sensitive derived artifact this feature produces,
    which is why it cascades on account deletion unlike the raw event log.
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

    # Per-feature counts — kept as explicit typed columns (not folded into the
    # JSONB breakdown below) because these specific counts are what the admin
    # "Activity" tab's leaderboard/summary view sorts and filters on directly.
    vault_posts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    messages_sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    course_messages_sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    marketplace_listings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quests_joined_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gigs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Flexible bag for anything not worth its own column — first JSONB-style
    # column in this codebase's Postgres models (mirrors the properties bag
    # used in the DynamoDB event schema); plain JSON type here since this
    # table is low-write/low-volume, so JSONB's indexing advantages aren't
    # the deciding factor — consistency with Postgres's native JSON type is
    # simpler for a column that's read as a whole blob, not queried into.
    feature_usage_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Rule-based (not ML/black-box) — see activity_profile_refresh_handler
    # for the exact thresholds. Documented and explainable is the point.
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # "power_user" | "casual" | "lurker" | "dormant"
    activity_label: Mapped[str] = mapped_column(String(20), default="dormant", nullable=False)

    def __repr__(self) -> str:
        return f"<UserActivityProfile user={self.user_id} label={self.activity_label}>"
