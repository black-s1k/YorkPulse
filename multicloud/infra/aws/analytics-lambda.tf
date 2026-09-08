# =============================================================================
# analytics-lambda.tf — Compute for the activity-tracking pipeline
#
# Both functions share the SAME container image as the main backend Lambda
# (yorkpulse-backend-lambda ECR repo — not Terraform-managed, built/pushed by
# .github/workflows/deploy.yml) with a different entrypoint per function via
# image_config.command, mirroring how yorkpulse-quest-cleanup already reuses
# that image today. CI's deploy-backend-lambda job needs two more
# `aws lambda update-function-code` lines added (one per function below) to
# keep their code current on every deploy — see the feature's implementation
# plan.
#
# UNLIKE the two existing Lambda functions (provisioned out-of-band), these
# are Terraform-managed: genuinely new infrastructure with several moving
# parts (IAM, DynamoDB, EventBridge, CloudWatch Logs subscription) is worth
# the IaC + Checkov-scanning overhead that out-of-band provisioning skips.
# =============================================================================

variable "activity_lambda_image_tag" {
  description = "Docker image tag (git SHA) for the analytics Lambdas — shares the yorkpulse-backend-lambda ECR repo/image with the main backend Lambda. Overridden by CI/CD per deploy."
  type        = string
  default     = "latest"
}

variable "database_url" {
  description = "Postgres connection string for the profile-refresh Lambda (writes user_activity_profiles). Pass via -var or TF_VAR_database_url, never commit a real value."
  type        = string
  default     = ""
  sensitive   = true
}

locals {
  # yorkpulse-backend-lambda is NOT managed by this Terraform module (see
  # ecr.tf's aws_ecr_repository.backend, which is a DIFFERENT repo for the
  # dormant ECS stack) — referenced by name/account/region instead.
  backend_lambda_image_uri = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/yorkpulse-backend-lambda:${var.activity_lambda_image_tag}"
}

# -----------------------------------------------------------------------------
# Log processor — invoked by the CloudWatch Logs subscription filter below.
# Batches structured "activity" log lines emitted by the backend's
# ActivityLogMiddleware and writes them into DynamoDB via batch_write_item.
# Entrypoint: app.activity_log_handler.handler (new file, backend/app/).
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "activity_log_processor" {
  function_name = "${var.project}-activity-log-processor"
  role          = aws_iam_role.activity_lambda.arn
  package_type  = "Image"
  image_uri     = local.backend_lambda_image_uri
  architectures = ["arm64"] # matches the main backend Lambda's build target

  image_config {
    command = ["app.activity_log_handler.handler"]
  }

  timeout     = 30
  memory_size = 256 # small — just batches + writes to DynamoDB, no heavy compute

  environment {
    variables = {
      ACTIVITY_EVENTS_TABLE   = aws_dynamodb_table.activity_events.name
      ACTIVITY_SESSIONS_TABLE = aws_dynamodb_table.activity_sessions.name
    }
  }

  tags = {
    Project     = var.project
    Environment = var.environment
    Feature     = "activity-tracking"
  }
}

resource "aws_cloudwatch_log_group" "activity_log_processor" {
  name              = "/aws/lambda/${aws_lambda_function.activity_log_processor.function_name}"
  retention_in_days = 30
}

# -----------------------------------------------------------------------------
# CloudWatch Logs subscription filter — the actual ingestion trigger.
# Filters the main backend Lambda's log group for lines from the dedicated
# "activity" logger (see ActivityLogMiddleware, which tags every line so
# this filter pattern only matches activity events, not general app logs)
# and invokes the log processor directly. No Kinesis Firehose in between —
# subscription filters can target a Lambda natively, which is what keeps
# this entirely inside the always-free Lambda tier.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_subscription_filter" "activity_events" {
  name            = "${var.project}-activity-events-filter"
  log_group_name  = "/aws/lambda/${var.project}-backend" # the EXISTING, out-of-band main backend Lambda's log group
  filter_pattern  = "{ $.logger = \"activity\" }"        # matches only structured JSON lines from the dedicated activity logger
  destination_arn = aws_lambda_function.activity_log_processor.arn
  depends_on      = [aws_lambda_permission.allow_cloudwatch_logs]
}

# -----------------------------------------------------------------------------
# Profile refresh — scheduled aggregation. Queries DynamoDB + the existing
# Postgres tables, recomputes user_activity_profiles every 30-60 min.
# Explicitly excludes is_persona=True (admin-seeded synthetic) accounts.
# Entrypoint: app.activity_profile_refresh_handler.handler (new file).
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "activity_profile_refresh" {
  function_name = "${var.project}-activity-profile-refresh"
  role          = aws_iam_role.activity_lambda.arn
  package_type  = "Image"
  image_uri     = local.backend_lambda_image_uri
  architectures = ["arm64"]

  image_config {
    command = ["app.activity_profile_refresh_handler.handler"]
  }

  timeout     = 60
  memory_size = 512 # aggregation over DynamoDB + Postgres writes needs a bit more headroom

  environment {
    variables = {
      ACTIVITY_EVENTS_TABLE   = aws_dynamodb_table.activity_events.name
      ACTIVITY_SESSIONS_TABLE = aws_dynamodb_table.activity_sessions.name
      DATABASE_URL            = var.database_url
    }
  }

  tags = {
    Project     = var.project
    Environment = var.environment
    Feature     = "activity-tracking"
  }
}

resource "aws_cloudwatch_log_group" "activity_profile_refresh" {
  name              = "/aws/lambda/${aws_lambda_function.activity_profile_refresh.function_name}"
  retention_in_days = 30
}

# -----------------------------------------------------------------------------
# EventBridge Scheduler — triggers the profile-refresh Lambda every 30 min.
# Always-free at this invocation volume (~1,400/month, well under the
# always-free 14M/month ceiling).
# -----------------------------------------------------------------------------
resource "aws_scheduler_schedule_group" "activity" {
  name = "${var.project}-activity-tracking"
}

resource "aws_scheduler_schedule" "activity_profile_refresh" {
  name       = "${var.project}-activity-profile-refresh"
  group_name = aws_scheduler_schedule_group.activity.name

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(30 minutes)"

  target {
    arn      = aws_lambda_function.activity_profile_refresh.arn
    role_arn = aws_iam_role.activity_lambda.arn
  }
}
