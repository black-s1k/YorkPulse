"""Activity tracking schemas — ingestion requests and admin read responses."""

from typing import Any

from pydantic import BaseModel


class ClientEvent(BaseModel):
    """One event as sent by the frontend's batching/flush layer."""

    event_type: str
    category: str
    entity_type: str | None = None
    entity_id: str | None = None
    properties: dict[str, Any] | None = None
    occurred_at: str | None = None  # client timestamp; server also stamps its own on receipt


class TrackEventsRequest(BaseModel):
    """Batched event ingestion — the frontend flushes its buffer here rather
    than one request per event."""

    session_id: str
    events: list[ClientEvent]


class StartSessionRequest(BaseModel):
    device_type: str | None = None
    browser: str | None = None
    landing_path: str | None = None


class StartSessionResponse(BaseModel):
    session_id: str


class ReplayChunkRequest(BaseModel):
    """rrweb replay chunk — one batch of recorded DOM/interaction events,
    stored inline in the session's replay_chunks JSON column (no object
    storage in this design)."""

    session_id: str
    chunk: Any
    byte_size: int


class ConsentRequest(BaseModel):
    """One consent grant/withdrawal action, appended to the audit ledger —
    never overwrites a prior row. consent_scope: "essential" |
    "product_analytics" | "session_replay". action: "granted" | "withdrawn"."""

    policy_version: str
    consent_scope: str
    action: str


class ConsentResponse(BaseModel):
    id: str
    consent_scope: str
    action: str
    recorded_at: str


class UserActivityProfileResponse(BaseModel):
    """Admin-facing per-user summary — recomputed synchronously each time
    the admin "Activity" tab is opened (see activity_profile.py), not by a
    scheduled job."""

    user_id: str
    last_computed_at: str
    total_sessions: int
    total_events: int
    total_replay_seconds: int
    total_page_views: int
    avg_session_duration_seconds: float
    days_active_last_30: int
    vault_posts_count: int
    messages_sent_count: int
    course_messages_sent_count: int
    marketplace_listings_count: int
    quests_joined_count: int
    gigs_count: int
    engagement_score: float
    activity_label: str
