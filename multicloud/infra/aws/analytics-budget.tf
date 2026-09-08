# =============================================================================
# analytics-budget.tf — Cost safeguard for the user-activity-tracking feature
#
# The activity-tracking pipeline (analytics-dynamodb.tf, analytics-lambda.tf)
# is designed to stay within AWS's always-free tier at ~1,000 users (see the
# feature's implementation plan for the full cost analysis). This budget is
# the actual safeguard, not just a hopeful estimate: it pages the same
# address already used for CloudWatch alarms if reality diverges from that
# estimate — e.g. if a DynamoDB table was accidentally created in On-Demand
# billing mode (no free tier at all) instead of Provisioned.
#
# NOTE: AWS Budgets itself has no cost. Only the resources it watches can
# incur charges.
# =============================================================================

resource "aws_budgets_budget" "activity_tracking" {
  name         = "${var.project}-${var.environment}-activity-tracking"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Filter to just the services this feature actually introduces, so this
  # budget tracks the feature's own footprint rather than the whole account's
  # bill (which the existing ECS/ALB/WAF stack already dwarfs regardless).
  cost_filter {
    name = "Service"
    values = [
      "Amazon DynamoDB",
      "AWS Lambda",
      "Amazon CloudWatch",
      "AmazonCloudWatchEvents", # EventBridge Scheduler bills under this service code
    ]
  }

  # Early warning, well before the $5 ceiling — catches a misconfiguration
  # (e.g. On-Demand billing mode) days before it becomes a real bill.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 20 # 20% of $5 = $1
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Hard ceiling alert at the full $5 budget.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Forecasted-to-exceed alert — fires based on AWS's cost forecast before
  # the month even ends, not just after actual spend crosses the line.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
