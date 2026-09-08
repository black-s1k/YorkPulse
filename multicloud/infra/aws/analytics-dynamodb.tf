# =============================================================================
# analytics-dynamodb.tf — Raw event/session-replay store for user activity tracking
#
# CRITICAL: billing_mode = "PROVISIONED" with capacity <= 25/25 is what makes
# this free. DynamoDB's always-free tier (25 GB storage + 25 RCU + 25 WCU,
# forever — unlike S3's 12-month-only free tier) applies ONLY to Provisioned
# mode. On-Demand mode (DynamoDB's own recommended default, and what most
# tutorials use) has NO free tier at all — every request is billed from the
# first one. Do not change billing_mode without re-reading the feature's cost
# analysis.
#
# Auto Scaling is intentionally NOT attached beyond a small ceiling above 25 —
# see max_capacity below. Uncapped auto-scaling defeats the point of staying
# in the free tier.
# =============================================================================

# -----------------------------------------------------------------------------
# ActivityEvents — append-only log. One item per discrete tracked event
# (request-level via the log-processor Lambda, or explicit domain events like
# "vault post created" via activity_service.emit() in the backend).
#
# Partition key: user_id (or session_id string for pre-auth/anonymous events).
# Sort key: a composite "occurred_at#event_id" string so items for the same
# user sort chronologically and never collide.
#
# TTL: items delete themselves automatically after ~180 days — no cleanup
# Lambda needed for this table. Matches the retention window in the feature's
# privacy-policy disclosure.
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "activity_events" {
  name           = "${var.project}-${var.environment}-activity-events" # → "yorkpulse-prod-activity-events"
  billing_mode   = "PROVISIONED"
  read_capacity  = 10
  write_capacity = 15 # writes dominate this table (append-only log); reads are admin-only and rare

  hash_key  = "pk" # user_id or session_id
  range_key = "sk" # "<occurred_at ISO8601>#<event_id>"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at" # unix epoch seconds — set on every write
    enabled        = true
  }

  point_in_time_recovery {
    enabled = false # not needed for an append-only, self-expiring log; avoids extra cost
  }

  tags = {
    Project     = var.project
    Environment = var.environment
    Feature     = "activity-tracking"
  }
}

resource "aws_appautoscaling_target" "activity_events_write" {
  max_capacity       = 25 # ceiling kept at the free-tier boundary — see file header
  min_capacity       = 15
  resource_id        = "table/${aws_dynamodb_table.activity_events.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "activity_events_write" {
  name               = "${var.project}-${var.environment}-activity-events-write-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.activity_events_write.resource_id
  scalable_dimension = aws_appautoscaling_target.activity_events_write.scalable_dimension
  service_namespace  = aws_appautoscaling_target.activity_events_write.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = 70.0
  }
}

# -----------------------------------------------------------------------------
# ActivitySessions — one mutable row per browser session. Looked up and
# updated as rrweb replay chunks arrive (unlike the append-only event log,
# which is why this is a separate table rather than another event type).
#
# Partition key: session_id.
#
# TTL: shorter than ActivityEvents (~30-90 days) — replay data is the most
# invasive category tracked, so it gets the shortest retention as a concrete
# data-minimization measure, independent of how cheap storage is.
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "activity_sessions" {
  name           = "${var.project}-${var.environment}-activity-sessions"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 10

  hash_key = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Project     = var.project
    Environment = var.environment
    Feature     = "activity-tracking"
  }
}

# Total provisioned capacity across both tables at their auto-scaling ceiling
# (25 write + 5 write = 30, 10 read + 5 read = 15) intentionally stays close
# to the combined 25/25 free-tier allowance — a small, deliberate overage on
# writes to absorb bursts without hard-throttling, not an open-ended scale-up.
