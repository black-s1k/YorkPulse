"""Recomputes UserActivityProfile rows — the scheduled aggregation job.

Runs every 30 min via EventBridge Scheduler (multicloud/infra/aws/analytics-lambda.tf),
NOT real-time — an explicit, documented trade-off, reasonable for an admin
dashboard. Excludes User.is_persona=True (admin-seeded synthetic) accounts.

Two data sources, deliberately different query strategies:
  - Per-feature counts (vault posts, messages sent, etc.) come straight from
    the EXISTING Postgres operational tables (VaultPost, Message, ...) —
    these already have user_id columns; no need to re-derive them from the
    DynamoDB event log at all.
  - Session/behavioral stats (total_sessions, days_active, replay seconds,
    most-active hour/day) can ONLY come from DynamoDB, since that's the only
    place session-level data exists.

DynamoDB access here uses a full table Scan grouped by user_id in Python,
not a Query — there's no GSI on user_id for ActivitySessions/ActivityEvents
(both are keyed by session_id / pk respectively). At this app's realistic
scale (~1,000 users, modest session volume) a Scan every 30 minutes is a
reasonable, simple choice; a GSI would be the documented next step if this
table ever grows large enough for Scan cost/latency to matter — not built
now, consistent with this feature's right-sized-not-over-engineered stance
elsewhere (see DECISIONS.md #022 in multicloud/).
"""

import logging
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import UserActivityProfile
from app.models.buddy import BuddyParticipant
from app.models.course import CourseMessage
from app.models.gig import Gig
from app.models.marketplace import MarketplaceListing
from app.models.messaging import Message
from app.models.user import User
from app.models.vault import VaultPost
from app.services.activity import activity_service

logger = logging.getLogger(__name__)

# Rule-based, documented thresholds — deliberately not an ML/black-box
# classifier. See the feature's implementation plan's "what this showcases"
# section: transparent and explainable is the point here.
LABEL_THRESHOLDS = {
    "power_user": 50,   # engagement_score >= 50
    "casual": 15,       # >= 15
    "lurker": 1,        # >= 1
    # else: "dormant"
}


def _compute_engagement_score(
    total_events: int,
    days_active_last_30: int,
    feature_counts_sum: int,
) -> float:
    """A simple, transparent weighted formula — not ML. Recency (days
    active) counts most, raw event volume counts least (a single long
    session shouldn't outweigh showing up regularly), and actually creating
    content (feature_counts_sum) sits in between."""
    return (days_active_last_30 * 3) + (feature_counts_sum * 2) + (total_events * 0.1)


def _label_for_score(score: float) -> str:
    if score >= LABEL_THRESHOLDS["power_user"]:
        return "power_user"
    if score >= LABEL_THRESHOLDS["casual"]:
        return "casual"
    if score >= LABEL_THRESHOLDS["lurker"]:
        return "lurker"
    return "dormant"


async def _scan_dynamodb_session_stats() -> dict[str, dict]:
    """Full-table scan of ActivitySessions, grouped by user_id. Returns
    {user_id: {total_sessions, total_replay_seconds, session_starts: [...]}}."""
    stats: dict[str, dict] = defaultdict(lambda: {
        "total_sessions": 0,
        "total_replay_seconds": 0,
        "session_starts": [],
    })

    if not activity_service.has_client:
        return stats

    table = activity_service.sessions_table
    scan_kwargs: dict = {}
    while True:
        response = table.scan(**scan_kwargs)
        for item in response.get("Items", []):
            user_id = item.get("user_id")
            if not user_id:
                continue
            entry = stats[user_id]
            entry["total_sessions"] += 1
            byte_size = item.get("replay_byte_size", 0)
            # Rough estimate: rrweb's incremental format runs ~20KB/min compressed
            # (see the feature's cost analysis) — good enough for an aggregate
            # dashboard stat, not billing-grade precision.
            entry["total_replay_seconds"] += int((byte_size / 1024 / 20) * 60) if byte_size else 0
            started_at = item.get("started_at")
            if started_at:
                entry["session_starts"].append(started_at)

        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return stats


async def _scan_dynamodb_event_stats() -> dict[str, dict]:
    """Full-table scan of ActivityEvents, grouped by pk (user_id or session_id
    for anonymous events — only user_id-keyed entries are counted here).
    Returns {user_id: {total_events, page_views, hour_counts, day_counts}}."""
    stats: dict[str, dict] = defaultdict(lambda: {
        "total_events": 0,
        "page_views": 0,
        "hour_counts": defaultdict(int),
        "day_counts": defaultdict(int),
    })

    if not activity_service.has_client:
        return stats

    table = activity_service.events_table
    scan_kwargs: dict = {}
    while True:
        response = table.scan(**scan_kwargs)
        for item in response.get("Items", []):
            user_id = item.get("user_id")
            if not user_id:
                continue
            entry = stats[user_id]
            entry["total_events"] += 1
            if item.get("event_type") in ("request", "nav.page_view"):
                entry["page_views"] += 1
            occurred_at = item.get("occurred_at")
            if occurred_at:
                try:
                    dt = datetime.fromisoformat(occurred_at)
                    entry["hour_counts"][dt.hour] += 1
                    entry["day_counts"][dt.weekday()] += 1
                except ValueError:
                    pass

        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return stats


async def _postgres_feature_counts(db: AsyncSession) -> dict[str, dict]:
    """One grouped count query per feature table — the same idiom
    dashboard.py already uses for its live stats, just grouped by user_id
    instead of a sitewide total. Queries all users; the caller filters to
    real (non-persona) user_ids when consuming the result."""
    counts: dict[str, dict] = defaultdict(lambda: {
        "vault_posts_count": 0,
        "messages_sent_count": 0,
        "course_messages_sent_count": 0,
        "marketplace_listings_count": 0,
        "quests_joined_count": 0,
        "gigs_count": 0,
    })

    queries = [
        (VaultPost, VaultPost.user_id, "vault_posts_count"),
        (Message, Message.sender_id, "messages_sent_count"),
        (CourseMessage, CourseMessage.user_id, "course_messages_sent_count"),
        (MarketplaceListing, MarketplaceListing.user_id, "marketplace_listings_count"),
        (BuddyParticipant, BuddyParticipant.user_id, "quests_joined_count"),
        (Gig, Gig.poster_id, "gigs_count"),
    ]

    for _model, user_col, key in queries:
        result = await db.execute(
            select(user_col, func.count()).group_by(user_col)
        )
        for user_id, count in result.all():
            if user_id:
                counts[str(user_id)][key] = count

    return counts


async def refresh_all_profiles(db: AsyncSession) -> dict:
    """Main entry point — recomputes and upserts every non-persona user's
    UserActivityProfile row."""
    session_stats = await _scan_dynamodb_session_stats()
    event_stats = await _scan_dynamodb_event_stats()

    real_users_result = await db.execute(select(User.id).where(User.is_persona.is_(False)))
    real_user_ids = [str(uid) for (uid,) in real_users_result.all()]

    feature_counts = await _postgres_feature_counts(db)

    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)

    updated = 0
    for user_id in real_user_ids:
        sess = session_stats.get(user_id, {"total_sessions": 0, "total_replay_seconds": 0, "session_starts": []})
        events = event_stats.get(user_id, {"total_events": 0, "page_views": 0, "hour_counts": {}, "day_counts": {}})
        features = feature_counts.get(user_id, {})

        active_days = set()
        for ts in sess["session_starts"]:
            try:
                dt = datetime.fromisoformat(ts)
                if dt >= thirty_days_ago:
                    active_days.add(dt.date())
            except ValueError:
                pass

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
            "avg_session_duration_seconds": 0.0,  # requires session end_time tracking — future refinement
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
