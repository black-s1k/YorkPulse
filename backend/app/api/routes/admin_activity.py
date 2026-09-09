"""Admin activity-tracking read routes — mirrors admin_list_signup_attempts'
exact pattern in auth.py: AdminUser dependency, page/per_page query params,
offset/limit, raw dict serialization.

Route prefix is /admin/activity, deliberately not /admin/personas — see
app/models/activity.py's module docstring for why "persona" is avoided
throughout this feature.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import AdminUser
from app.models.activity import ActivityEvent, UserActivityProfile
from app.models.user import User
from app.services.activity_profile import refresh_all_profiles

router = APIRouter(prefix="/admin/activity", tags=["Admin — Activity Tracking"])


@router.get("/profiles")
async def admin_list_activity_profiles(
    _: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    sort_by: str = Query("engagement_score", pattern="^(engagement_score|total_events|last_computed_at)$"),
):
    """Paginated leaderboard-style list of per-user activity profiles,
    joined to the user's name/email for display. Excludes is_persona=True
    (admin-seeded synthetic) accounts — those exist to bootstrap content,
    not to be counted as real engagement.

    Recomputes the aggregate synchronously on every call rather than
    reading a periodically-refreshed cache — see activity_profile.py for
    why that's the right trade-off here (an admin-only view, at a scale
    where a few grouped queries cost a few hundred ms at most)."""
    await refresh_all_profiles(db)

    sort_column = getattr(UserActivityProfile, sort_by)
    query = (
        select(UserActivityProfile, User.name, User.email)
        .join(User, User.id == UserActivityProfile.user_id)
        .where(User.is_persona.is_(False))
        .order_by(sort_column.desc())
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(query.offset((page - 1) * per_page).limit(per_page))
    rows = result.all()

    return {
        "items": [
            {
                "user_id": str(profile.user_id),
                "name": name,
                "email": email,
                "total_sessions": profile.total_sessions,
                "total_events": profile.total_events,
                "total_page_views": profile.total_page_views,
                "days_active_last_30": profile.days_active_last_30,
                "vault_posts_count": profile.vault_posts_count,
                "messages_sent_count": profile.messages_sent_count,
                "engagement_score": profile.engagement_score,
                "activity_label": profile.activity_label,
                "last_computed_at": profile.last_computed_at.isoformat(),
            }
            for profile, name, email in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": page * per_page < total,
    }


@router.get("/profiles/{user_id}")
async def admin_get_activity_profile(
    user_id: str,
    _: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Single user's full profile plus their recent raw event timeline —
    the "fast path" described in the feature's implementation plan, now
    entirely against the same Postgres database everything else uses."""
    result = await db.execute(
        select(UserActivityProfile, User.name, User.email)
        .join(User, User.id == UserActivityProfile.user_id)
        .where(UserActivityProfile.user_id == user_id)
    )
    row = result.first()
    if not row:
        return {"profile": None, "recent_events": []}

    profile, name, email = row

    events_result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.user_id == user_id)
        .order_by(ActivityEvent.occurred_at.desc())
        .limit(100)
    )
    recent_events = events_result.scalars().all()

    return {
        "profile": {
            "user_id": str(profile.user_id),
            "name": name,
            "email": email,
            "total_sessions": profile.total_sessions,
            "total_events": profile.total_events,
            "total_replay_seconds": profile.total_replay_seconds,
            "total_page_views": profile.total_page_views,
            "avg_session_duration_seconds": profile.avg_session_duration_seconds,
            "days_active_last_30": profile.days_active_last_30,
            "vault_posts_count": profile.vault_posts_count,
            "messages_sent_count": profile.messages_sent_count,
            "course_messages_sent_count": profile.course_messages_sent_count,
            "marketplace_listings_count": profile.marketplace_listings_count,
            "quests_joined_count": profile.quests_joined_count,
            "gigs_count": profile.gigs_count,
            "engagement_score": profile.engagement_score,
            "activity_label": profile.activity_label,
            "last_computed_at": profile.last_computed_at.isoformat(),
        },
        "recent_events": [
            {
                "event_type": e.event_type,
                "category": e.category,
                "occurred_at": e.occurred_at.isoformat(),
                "entity_type": e.entity_type,
                "source": e.source,
            }
            for e in recent_events
        ],
    }
