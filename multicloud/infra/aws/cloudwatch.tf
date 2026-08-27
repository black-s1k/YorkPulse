# =============================================================================
# cloudwatch.tf — Observability: SNS alerts, CloudWatch alarms, log metric filters
#
# All monitoring for the YorkPulse backend runs through:
#   1. SNS topic (yorkpulse-alerts) → email to yorkpulse.app@gmail.com
#   2. CloudWatch alarms → SNS on breach
#   3. Log metric filter → count ERROR lines in FastAPI logs → alarm on high volume
#
# Alarms monitor:
#   - ECS CPU    > 80% for 2 consecutive 5-min periods → resource pressure
#   - ECS Memory > 80% for 2 consecutive 5-min periods → possible memory leak
#   - ALB 5xx errors > 10 in 5 minutes → application errors reaching users
#   - ALB response time P99 > 2s → latency degradation
#   - WAF blocked requests > 100 in 5 minutes → active attack in progress
#   - FastAPI ERROR log count > 20 in 5 minutes → application-level error storm
#
# Why 2 consecutive periods for CPU/memory?
#   Spikes are normal. 2 consecutive periods = sustained pressure = real problem.
#   A single 5-minute spike (e.g. a deploy) would cause false positives.
#   5xx and WAF alarms use 1 period — any spike is actionable immediately.
# =============================================================================

# =============================================================================
# SNS TOPIC + SUBSCRIPTION — the alert notification channel
# =============================================================================

# -----------------------------------------------------------------------------
# SNS topic — all CloudWatch alarms publish to this topic.
# Any new alarm can be added to this topic without restructuring notifications.
# The topic acts as a fan-out: future subscribers (PagerDuty, Slack, etc.)
# can be added without changing any alarm configuration.
# -----------------------------------------------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "${var.project}-${var.environment}-alerts" # → "yorkpulse-prod-alerts"

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# SNS email subscription — delivers alarm notifications to the admin email.
# AFTER TERRAFORM APPLY: AWS sends a confirmation email to yorkpulse.app@gmail.com.
# You MUST click the confirmation link before any alarms will deliver to email.
# Unconfirmed subscriptions are silently dropped by SNS.
# -----------------------------------------------------------------------------
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email # → "yorkpulse.app@gmail.com"
}

# =============================================================================
# ECS ALARMS — monitor Fargate task resource usage
# Requires Container Insights enabled on the ECS cluster (set in ecs.tf).
# =============================================================================

# -----------------------------------------------------------------------------
# ECS CPU utilization alarm
# Triggers when average CPU > 80% for 2 consecutive 5-minute periods.
# At 80% CPU, the container is at risk of queuing requests and increasing latency.
# Action: investigate traffic spike, consider scaling desired_count in ecs.tf.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.project}-${var.environment}-ecs-cpu-high"
  alarm_description   = "ECS CPU > 80% for 10 minutes — container may be under load or in infinite loop"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80    # 80% CPU utilization
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  statistic           = "Average"
  period              = 300   # 5-minute evaluation period
  evaluation_periods  = 2     # Must exceed threshold for 2 consecutive periods = 10 minutes sustained

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn] # Notify SNS → email when alarm fires
  ok_actions    = [aws_sns_topic.alerts.arn] # Also notify when CPU recovers (resolved)

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECS Memory utilization alarm
# Triggers when average memory > 80% for 2 consecutive 5-minute periods.
# At 80% memory (819 MB of 1024 MB), the container is approaching the limit.
# ECS kills and restarts tasks that exceed 100% memory — this alarm gives
# advance warning before that happens.
# Action: investigate memory leak, check for connection pool exhaustion.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.project}-${var.environment}-ecs-memory-high"
  alarm_description   = "ECS Memory > 80% for 10 minutes — possible memory leak or connection pool exhaustion"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80    # 80% of 1024 MB = 819 MB
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2     # Sustained for 10 minutes before alerting

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# =============================================================================
# ALB ALARMS — monitor load balancer metrics
# =============================================================================

# -----------------------------------------------------------------------------
# ALB 5xx error alarm
# Triggers when the ALB returns > 10 HTTP 5xx responses in a 5-minute window.
# 5xx = server-side errors (500 Internal Error, 502 Bad Gateway, 503 Unavailable).
# 10 errors in 5 minutes = something is actively broken for users.
# Action: check FastAPI logs in CloudWatch, check ECS task health, check Supabase status.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project}-${var.environment}-alb-5xx-errors"
  alarm_description   = "ALB 5xx errors > 10 in 5 minutes — application errors reaching users"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 10    # More than 10 server errors in 5 minutes = actionable
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  statistic           = "Sum"
  period              = 300   # 5-minute window
  evaluation_periods  = 1     # Single period — any 5xx spike is immediately actionable

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  # Use MISSING as "not in alarm" — if there are no requests (off-hours), don't alert
  treat_missing_data = "notBreaching"

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ALB target response time alarm (P99 latency)
# Triggers when the 99th percentile response time exceeds 2 seconds.
# P99 means 99% of requests are faster than this threshold.
# > 2 seconds at P99 means the tail of your request distribution is very slow —
# slow enough that users are noticeably affected.
# Action: check ECS CPU/memory, check Supabase query latency, check Redis health.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${var.project}-${var.environment}-alb-response-time-p99"
  alarm_description   = "ALB P99 response time > 2 seconds — tail latency degradation"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 2     # 2 seconds P99 is the SLO threshold
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  extended_statistic  = "p99" # 99th percentile latency (not average — tail matters)
  period              = 300
  evaluation_periods  = 1

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# =============================================================================
# WAF ALARM — monitor for active attacks
# =============================================================================

# -----------------------------------------------------------------------------
# WAF blocked requests alarm
# Triggers when WAF blocks > 100 requests in a 5-minute window.
# 100 blocked requests in 5 minutes = likely active attack or scraper surge.
# The blocked request logs in /aws/waf/yorkpulse contain attacker IPs and payloads.
# Action: review WAF logs, consider adding rate-based rules, notify users if needed.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "waf_blocked" {
  alarm_name          = "${var.project}-${var.environment}-waf-blocked-spike"
  alarm_description   = "WAF blocked > 100 requests in 5 minutes — possible active attack"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 100   # 100 blocked requests = attack volume, not background noise
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1     # Single period — attack spikes are immediate

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = var.aws_region
    Rule   = "ALL" # Count blocks across ALL WAF rules
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# =============================================================================
# LOG METRIC FILTER + ALARM — count FastAPI ERROR lines
# =============================================================================

# -----------------------------------------------------------------------------
# Log metric filter — extracts a custom metric from the FastAPI log stream.
# Scans every log line in /ecs/yorkpulse-backend for the word "ERROR".
# FastAPI (via Python logging module) emits ERROR-level log lines for:
#   - Unhandled exceptions in route handlers
#   - Database connection failures
#   - Secrets Manager retrieval failures
#   - External API errors (Supabase, Gmail SMTP)
# The filter creates a custom CloudWatch metric: "YorkPulseErrorCount"
# This metric feeds the alarm below.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.project}-${var.environment}-error-count"
  log_group_name = aws_cloudwatch_log_group.ecs_backend.name

  # Pattern "ERROR" matches any log line containing the word ERROR.
  # FastAPI with Python logging emits: "ERROR:app.main:Something failed"
  # Adjust to "?ERROR ?CRITICAL" to also catch CRITICAL-level logs.
  pattern = "ERROR"

  metric_transformation {
    name          = "ErrorCount"
    namespace     = "YorkPulse/Backend" # Custom namespace — separate from AWS/* metrics
    value         = "1"                 # Each matching log line counts as 1 error
    default_value = 0                   # When no ERROR lines → metric = 0 (not missing)
  }
}

# -----------------------------------------------------------------------------
# ERROR count alarm — triggers on a burst of application errors.
# > 20 ERROR log lines in 5 minutes = error storm (not isolated failures).
# Isolated 500 errors are expected occasionally — an error storm indicates
# a systemic failure: DB connection pool exhaustion, Supabase outage, etc.
# Action: check ECS task logs, check Supabase status page.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "error_rate_high" {
  alarm_name          = "${var.project}-${var.environment}-error-rate-high"
  alarm_description   = "FastAPI ERROR log count > 20 in 5 minutes — error storm in application logs"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 20    # 20 errors in 5 minutes = systematic failure, not noise
  metric_name         = "ErrorCount"
  namespace           = "YorkPulse/Backend" # Must match metric_transformation.namespace above
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}
