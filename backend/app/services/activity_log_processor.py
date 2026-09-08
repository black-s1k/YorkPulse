"""Processes CloudWatch Logs subscription-filter events into DynamoDB writes.

Invoked by the log-processor Lambda (app/activity_log_handler.py), triggered
by the subscription filter defined in
multicloud/infra/aws/analytics-lambda.tf. This is the consumer side of the
"free" ingestion layer described in ActivityLogMiddleware's docstring —
decoupled from the request/response cycle entirely, running as its own
async invocation some seconds after the original request completed.
"""

import base64
import gzip
import json
import logging
import time
import uuid
from datetime import UTC, datetime

logger = logging.getLogger(__name__)


def decode_cloudwatch_logs_event(event: dict) -> list[dict]:
    """CloudWatch Logs subscription events arrive as base64+gzip-encoded
    JSON under event["awslogs"]["data"]. Returns the list of raw log lines
    (already filtered server-side by the subscription filter's pattern, so
    every line here should be one of ActivityLogMiddleware's JSON payloads —
    but still validated defensively below since a misconfigured filter
    pattern, or a future unrelated log line that happens to match, must
    never crash the processor)."""
    payload = event.get("awslogs", {}).get("data")
    if not payload:
        return []
    decoded = base64.b64decode(payload)
    decompressed = gzip.decompress(decoded)
    parsed = json.loads(decompressed)
    return parsed.get("logEvents", [])


def build_dynamodb_items(log_events: list[dict], ttl_days: int) -> list[dict]:
    """Converts raw CloudWatch log lines into DynamoDB item dicts, matching
    the same schema activity_service.emit() writes directly. Lines that
    aren't valid JSON, or aren't from the "activity" logger, are skipped
    rather than raising — one malformed line must never drop the rest of
    the batch."""
    items = []
    expires_at = int(time.time()) + ttl_days * 86400

    for log_event in log_events:
        try:
            data = json.loads(log_event["message"])
        except (KeyError, json.JSONDecodeError):
            continue

        if data.get("logger") != "activity":
            continue

        event_id = str(uuid.uuid4())
        occurred_at = datetime.now(UTC).isoformat()
        user_id = data.get("user_id")
        pk = user_id or "anonymous"

        items.append({
            "pk": pk,
            "sk": f"{occurred_at}#{event_id}",
            "event_id": event_id,
            "occurred_at": occurred_at,
            "user_id": user_id,
            "event_type": data.get("event_type", "request"),
            "category": data.get("category", "navigation"),
            "source": data.get("source", "backend_middleware"),
            "request_method": data.get("request_method"),
            "request_path": data.get("request_path"),
            "status_code": data.get("status_code"),
            "duration_ms": data.get("duration_ms"),
            "ip_address": data.get("ip_address"),
            "expires_at": expires_at,
        })

    return items


async def process_cloudwatch_logs_event(event: dict) -> dict:
    """Entry point called by the Lambda handler. Returns a small summary
    dict for CloudWatch logging/observability of the processor itself."""
    from app.core.config import settings
    from app.services.activity import activity_service

    log_events = decode_cloudwatch_logs_event(event)
    items = build_dynamodb_items(log_events, settings.activity_events_ttl_days)

    if items:
        await activity_service.batch_emit(items)

    result = {"received": len(log_events), "written": len(items)}
    logger.info("Activity log batch processed: %s", result)
    return result
