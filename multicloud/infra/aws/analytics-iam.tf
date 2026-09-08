# =============================================================================
# analytics-iam.tf — Least-privilege IAM for the activity-tracking Lambdas
#
# Deliberately a SEPARATE role from the existing GitHub Actions deploy role
# (iam.tf's aws_iam_role.github_actions, scoped narrowly to ECR push +
# lambda:UpdateFunctionCode on exactly the two existing named functions).
# That role is NOT widened here to also apply Terraform — this module is
# applied through its own path, keeping blast radius isolated. See the
# feature's implementation plan for the full reasoning.
# =============================================================================

data "aws_iam_policy_document" "activity_lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "activity_lambda" {
  name               = "${var.project}-${var.environment}-activity-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.activity_lambda_assume_role.json

  tags = {
    Project     = var.project
    Environment = var.environment
    Feature     = "activity-tracking"
  }
}

# Baseline CloudWatch Logs write permission every Lambda needs for its own
# execution logs — the standard AWS-managed policy, not a hand-rolled one.
resource "aws_iam_role_policy_attachment" "activity_lambda_basic_execution" {
  role       = aws_iam_role.activity_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Scoped to exactly the two tables this feature creates — no wildcard
# resource, no access to any other DynamoDB table in the account.
resource "aws_iam_role_policy" "activity_lambda_dynamodb" {
  name = "${var.project}-${var.environment}-activity-lambda-dynamodb"
  role = aws_iam_role.activity_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ActivityTablesReadWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:GetItem",
        ]
        Resource = [
          aws_dynamodb_table.activity_events.arn,
          aws_dynamodb_table.activity_sessions.arn,
        ]
      }
    ]
  })
}

# The log-processor Lambda's invoke permission for its CloudWatch Logs
# subscription-filter trigger — scoped to the specific backend Lambda's log
# group only (set up in analytics-lambda.tf), not every log group in the
# account.
resource "aws_lambda_permission" "allow_cloudwatch_logs" {
  statement_id  = "AllowCloudWatchLogsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.activity_log_processor.function_name
  principal     = "logs.${var.aws_region}.amazonaws.com"
  source_arn    = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project}-backend:*"
}

# EventBridge Scheduler's permission to invoke the profile-refresh Lambda.
resource "aws_lambda_permission" "allow_eventbridge_scheduler" {
  statement_id  = "AllowEventBridgeSchedulerInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.activity_profile_refresh.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.activity_profile_refresh.arn
}
