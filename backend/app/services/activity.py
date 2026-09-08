"""Activity tracking service — DynamoDB-backed event/session store.

Deliberately not named "persona" anywhere (see app/models/activity.py's
module docstring). Mirrors the lazy-init-on-credentials, ClientError-wrapping,
module-singleton pattern already used by app/services/s3.py.

The raw event log and session-replay data intentionally live in DynamoDB, not
Postgres, and events reference other tables by entity_type/entity_id only —
never raw message/post text. See the feature's implementation plan for the
full architecture and cost reasoning (DynamoDB Provisioned mode, not
On-Demand, is what keeps this inside AWS's always-free tier).
"""

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class ActivityService:
    """Service for writing/reading activity events and sessions in DynamoDB."""

    def __init__(self):
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            self._resource = boto3.resource(
                "dynamodb",
                region_name=settings.aws_region,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
            )
            self.events_table = self._resource.Table(settings.activity_events_table)
            self.sessions_table = self._resource.Table(settings.activity_sessions_table)
        else:
            self._resource = None
            self.events_table = None
            self.sessions_table = None

    def is_configured(self) -> bool:
        """Gate for WRITES — both real AWS credentials and the tracking kill
        switch must be on."""
        return self._resource is not None and settings.activity_tracking_enabled

    @property
    def has_client(self) -> bool:
        """Gate for READS (admin views, the profile-refresh scan) — only
        requires real AWS credentials, independent of the tracking kill
        switch, so historical data stays readable even if tracking is
        currently paused."""
        return self._resource is not None

    def _ttl(self, days: int) -> int:
        return int(time.time()) + days * 86400

    async def emit(
        self,
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
        """Write a single event to ActivityEvents. Never raises — a tracking
        failure must never break the request it's attached to (same principle
        as the rest of this codebase's fire-and-forget logging: see
        SignupAttempt's try/except in auth.py).

        Metadata only: entity_id references the source table's row by ID —
        this function is never passed message/post body text.
        """
        if not self.is_configured():
            return

        occurred_at = datetime.now(UTC).isoformat()
        event_id = str(uuid.uuid4())
        pk = user_id or session_id or "anonymous"

        item: dict[str, Any] = {
            "pk": pk,
            "sk": f"{occurred_at}#{event_id}",
            "event_id": event_id,
            "occurred_at": occurred_at,
            "user_id": user_id,
            "session_id": session_id,
            "event_type": event_type,
            "category": category,
            "source": source,
            "expires_at": self._ttl(settings.activity_events_ttl_days),
        }
        if entity_type:
            item["entity_type"] = entity_type
        if entity_id:
            item["entity_id"] = entity_id
        if properties:
            item["properties"] = properties
        if ip_address:
            item["ip_address"] = ip_address
        if request_path:
            item["request_path"] = request_path
        if request_method:
            item["request_method"] = request_method
        if status_code is not None:
            item["status_code"] = status_code
        if duration_ms is not None:
            item["duration_ms"] = duration_ms

        try:
            self.events_table.put_item(Item=item)
        except ClientError as e:
            logger.warning("Activity event write failed: %s", e)

    async def batch_emit(self, events: list[dict[str, Any]]) -> None:
        """Write multiple events in one batch (used by the frontend ingestion
        route and the CloudWatch-Logs-driven log processor) — far more
        request-efficient against DynamoDB's provisioned WCU than one
        put_item per event. Never raises."""
        if not self.is_configured() or not events:
            return
        try:
            with self.events_table.batch_writer() as batch:
                for event in events:
                    batch.put_item(Item=event)
        except ClientError as e:
            logger.warning("Activity batch write failed: %s", e)

    async def record_replay_chunk(
        self, session_id: str, chunk_key: str, byte_size: int
    ) -> None:
        """Append a replay chunk reference to a session. Chunks themselves
        are written directly by the caller (small, kept under DynamoDB's
        400KB item limit by frequent flush intervals — see the frontend
        rrweb integration) — this just records that one arrived."""
        if not self.is_configured():
            return
        try:
            self.sessions_table.update_item(
                Key={"session_id": session_id},
                UpdateExpression=(
                    "SET replay_chunk_keys = list_append(if_not_exists(replay_chunk_keys, :empty), :chunk), "
                    "replay_byte_size = if_not_exists(replay_byte_size, :zero) + :size, "
                    "expires_at = :ttl"
                ),
                ExpressionAttributeValues={
                    ":chunk": [chunk_key],
                    ":empty": [],
                    ":size": byte_size,
                    ":zero": 0,
                    ":ttl": self._ttl(settings.activity_sessions_ttl_days),
                },
            )
        except ClientError as e:
            logger.warning("Activity replay chunk record failed: %s", e)

    async def start_session(
        self,
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
            self.sessions_table.put_item(
                Item={
                    "session_id": session_id,
                    "user_id": user_id,
                    "started_at": datetime.now(UTC).isoformat(),
                    "product_analytics_consented": product_analytics_consented,
                    "replay_consented": replay_consented,
                    "consent_version": consent_version,
                    "device_type": device_type,
                    "browser": browser,
                    "landing_path": landing_path,
                    "ip_address": ip_address,
                    "event_count": 0,
                    "expires_at": self._ttl(settings.activity_sessions_ttl_days),
                }
            )
        except ClientError as e:
            logger.warning("Activity session start failed: %s", e)

    async def query_user_events(
        self, user_id: str, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Admin read path — a user's recent raw event timeline."""
        if not self._resource:
            return []
        try:
            response = self.events_table.query(
                KeyConditionExpression="pk = :pk",
                ExpressionAttributeValues={":pk": user_id},
                ScanIndexForward=False,  # most recent first
                Limit=limit,
            )
            return response.get("Items", [])
        except ClientError as e:
            logger.warning("Activity event query failed: %s", e)
            return []

    async def purge_user(self, user_id: str) -> None:
        """Right-to-deletion support — called from admin_delete_user. Deletes
        every event item for this user_id, and every session row referenced
        by those events' session_id field. Not automatic (no FK to users by
        design — see app/models/activity.py) so this must be called
        explicitly; TTL alone isn't sufficient for an immediate deletion
        request since it only guarantees eventual, not immediate, removal."""
        if not self._resource:
            return
        try:
            events = self.events_table.query(
                KeyConditionExpression="pk = :pk",
                ExpressionAttributeValues={":pk": user_id},
            )
            items = events.get("Items", [])
            session_ids = {item["session_id"] for item in items if item.get("session_id")}

            with self.events_table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
            for session_id in session_ids:
                self.sessions_table.delete_item(Key={"session_id": session_id})
        except ClientError as e:
            logger.warning("Activity purge failed for user=%s: %s", user_id, e)


# Singleton instance
activity_service = ActivityService()
