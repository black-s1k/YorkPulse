"""Computes/refreshes UserActivityProfile rows — called synchronously from
the admin "Activity" tab's read endpoint (admin_activity.py), not by a
scheduled job. This app's own admin-stats convention is already "compute
live from Postgres" (see dashboard.py, courses.py's admin overview) — a
scheduled refresh job would have meant standing up a separate always-on
process for a feature where a few hundred milliseconds of extra latency on
an admin-only page load is a complete non-issue. Excludes
User.is_persona=True (admin-seeded synthetic) accounts.

Two data sources:
  - Per-feature counts (vault posts, messages sent, etc.) come from the
    EXISTING Postgres operational tables (VaultPost, Message, ...).
  - Session/behavioral stats (total_sessions, days_active, replay seconds,
    most-active hour/day) come from activity_sessions/activity_events —
    now plain Postgres tables, so this is just SQL, no DynamoDB Scan
    pagination logic needed anymore.
"""

import logging
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent, ActivitySession, UserActivityProfile
from app.models.buddy import BuddyParticipant
from app.models.course import CourseMessage
from app.models.gig import Gig
from app.models.marketplace import MarketplaceListing
from app.models.messaging import Message
from app.models.user import User
from app.models.vault import VaultPost

logger = logging.getLogger(__name__)

# Rule-based, documented thresholds — deliberately not an ML/black-box
# classifier. Transparent and explainable is the point.
LABEL_THRESHOLDS = {
    "power_user": 50,
    "casual": 15,
    "lurker": 1,
}


def _compute_engagement_score(total_events: int, days_active_last_30: int, feature_counts_sum: int) -> float:
    """A simple, transparent weighted formula — not ML. Recency (days
    active) counts most, raw event volume counts least, actually creating
    content sits in between."""
    return (days_active_last_30 * 3) + (feature_counts_sum * 2) + (total_events * 0.1)


def _label_for_score(score: float) -> str:
    if score >= LABEL_THRESHOLDS["power_user"]:
        return "power_user"
    if score >= LABEL_THRESHOLDS["casual"]:
        return "casual"
    if score >= LABEL_THRESHOLDS["lurker"]:
        return "lurker"
    return "dormant"


async def _session_stats(db: AsyncSession) -> dict[str, dict]:
    stats: dict[str, dict] = defaultdict(lambda: {"total_sessions": 0, "total_replay_seconds": 0, "session_starts": []})

    result = await db.execute(
        select(ActivitySession.user_id, ActivitySession.started_at, ActivitySession.replay_byte_size)
        .where(ActivitySession.user_id.is_not(None))
    )
    for user_id, started_at, replay_byte_size in result.all():
        entry = stats[str(user_id)]
        entry["total_sessions"] += 1
        # Rough estimate: rrweb's incremental format runs ~20KB/min compressed
        # — good enough for an aggregate dashboard stat, not billing-grade precision.
        entry["total_replay_seconds"] += int((replay_byte_size / 1024 / 20) * 60) if replay_byte_size else 0
        if started_at:
            entry["session_starts"].append(started_at)

    return stats


async def _event_stats(db: AsyncSession) -> dict[str, dict]:
    stats: dict[str, dict] = defaultdict(lambda: {
        "total_events": 0, "page_views": 0,
        "hour_counts": defaultdict(int), "day_counts": defaultdict(int),
    })

    result = await db.execute(
        select(ActivityEvent.user_id, ActivityEvent.event_type, ActivityEvent.occurred_at)
        .where(ActivityEvent.user_id.is_not(None))
    )
    for user_id, event_type, occurred_at in result.all():
        entry = stats[str(user_id)]
        entry["total_events"] += 1
        if event_type in ("request", "nav.page_view"):
            entry["page_views"] += 1
        if occurred_at:
            entry["hour_counts"][occurred_at.hour] += 1
            entry["day_counts"][occurred_at.weekday()] += 1

    return stats


async def _feature_counts(db: AsyncSession) -> dict[str, dict]:
    """One grouped count query per feature table — the same idiom
    dashboard.py already uses for its live stats, just grouped by user_id
    instead of a sitewide total."""
    counts: dict[str, dict] = defaultdict(lambda: {
        "vault_posts_count": 0, "messages_sent_count": 0, "course_messages_sent_count": 0,
        "marketplace_listings_count": 0, "quests_joined_count": 0, "gigs_count": 0,
    })

    queries = [
        (VaultPost.user_id, "vault_posts_count"),
        (Message.sender_id, "messages_sent_count"),
        (CourseMessage.user_id, "course_messages_sent_count"),
        (MarketplaceListing.user_id, "marketplace_listings_count"),
        (BuddyParticipant.user_id, "quests_joined_count"),
        (Gig.poster_id, "gigs_count"),
    ]

    for user_col, key in queries:
        result = await db.execute(select(user_col, func.count()).group_by(user_col))
        for user_id, count in result.all():
            if user_id:
                counts[str(user_id)][key] = count

    return counts


async def refresh_all_profiles(db: AsyncSession) -> dict:
    """Recomputes and upserts every non-persona user's UserActivityProfile
    row. Called synchronously at the top of the admin list endpoint."""
    session_stats = await _session_stats(db)
    event_stats = await _event_stats(db)
    feature_counts = await _feature_counts(db)

    real_users_result = await db.execute(select(User.id).where(User.is_persona.is_(False)))
    real_user_ids = [str(uid) for (uid,) in real_users_result.all()]

    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)

    updated = 0
    for user_id in real_user_ids:
        sess = session_stats.get(user_id, {"total_sessions": 0, "total_replay_seconds": 0, "session_starts": []})
        events = event_stats.get(user_id, {"total_events": 0, "page_views": 0, "hour_counts": {}, "day_counts": {}})
        features = feature_counts.get(user_id, {})

        active_days = {dt.date() for dt in sess["session_starts"] if dt >= thirty_days_ago}

        most_active_hour = max(events["hour_counts"], key=events["hour_counts"].get) if events["hour_counts"] else None
        most_active_day = max(events["day_counts"], key=events["day_counts"].get) if events["day_counts"] else None

        feature_sum = sum(features.get(k, 0) for k in (
            "vault_posts_count", "messages_sent_count", "course_messages_sent_count",
            "marketplace_listings_count", "quests_joined_count", "gigs_count",
        ))
        score = _compute_engagement_score(events["total_events"], len(active_days), feature_sum)

        values = {
            "user_id": user_id,
            "last_computed_at": now,
            "total_sessions": sess["total_sessions"],
            "total_events": events["total_events"],
            "total_replay_seconds": sess["total_replay_seconds"],
            "total_page_views": events["page_views"],
            "avg_session_duration_seconds": 0.0,
            "days_active_last_30": len(active_days),
            "most_active_hour_of_day": most_active_hour,
            "most_active_day_of_week": most_active_day,
            "vault_posts_count": features.get("vault_posts_count", 0),
            "messages_sent_count": features.get("messages_sent_count", 0),
            "course_messages_sent_count": features.get("course_messages_sent_count", 0),
            "marketplace_listings_count": features.get("marketplace_listings_count", 0),
            "quests_joined_count": features.get("quests_joined_count", 0),
            "gigs_count": features.get("gigs_count", 0),
            "engagement_score": score,
            "activity_label": _label_for_score(score),
        }

        stmt = insert(UserActivityProfile).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["user_id"],
            set_={k: v for k, v in values.items() if k != "user_id"},
        )
        await db.execute(stmt)
        updated += 1

    await db.commit()
    result = {"users_processed": len(real_user_ids), "profiles_updated": updated}
    logger.info("Activity profile refresh completed: %s", result)
    return result
