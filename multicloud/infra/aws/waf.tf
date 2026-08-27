# =============================================================================
# waf.tf — AWS WAF Web ACL protecting the ALB
#
# WAF is the first line of defence. Every HTTP request to api.yorkpulse.com
# passes through WAF before reaching the ALB listener or any ECS task.
#
# Three AWS Managed Rule Groups are applied in priority order:
#
#   Priority 1 — AWSManagedRulesAmazonIpReputationList
#     Blocks requests from IPs on Amazon's threat intelligence list:
#     known botnets, scrapers, Tor exit nodes, and malicious scanners.
#     Checked FIRST because it's the fastest and cheapest rule to evaluate.
#     If an IP is on the reputation list, no further rules are needed.
#
#   Priority 2 — AWSManagedRulesCommonRuleSet (CRS)
#     Blocks the OWASP Top 10 attack patterns:
#     SQL injection (SQLi), cross-site scripting (XSS), path traversal,
#     oversized requests, and common exploit probes.
#     The broadest protection rule — applied after IP filtering.
#
#   Priority 3 — AWSManagedRulesKnownBadInputsRuleSet
#     Blocks known malicious payloads: Log4Shell (JNDI injection),
#     SSRF attempts, and common shell injection patterns.
#     More targeted than CRS — catches specific CVEs and exploit kits.
#     Applied last because it's the most specific (fewer false positives).
#
# See DECISIONS.md: "WAF Rule Order Reasoning" for the full rationale.
#
# Default action: ALLOW — WAF only blocks what the rules explicitly match.
# This is the standard pattern: allow everything, block known bad.
# The alternative (block everything, allow known good) would require
# maintaining an allowlist of every legitimate request pattern — impractical.
# =============================================================================

# -----------------------------------------------------------------------------
# CloudWatch log group for WAF logs
# WAF sends all blocked request details here for forensic analysis.
# Name MUST start with "aws-waf-logs-" (AWS requirement for WAF logging).
# The cloudwatch.tf alarm monitors blocked request volume for attack spikes.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${var.project}" # → "aws-waf-logs-yorkpulse"
  # AWS hard requirement: WAF CloudWatch log group names MUST start with "aws-waf-logs-"
  # Any other prefix is rejected by the WAF logging configuration API.
  retention_in_days = 30 # 30 days for blocked request forensics

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# WAF Web ACL — the main WAF resource that groups all rules together.
# Scope REGIONAL means it applies to a specific regional AWS resource (the ALB).
# CLOUDFRONT scope would be used for a CloudFront distribution instead.
# The Web ACL is associated with the ALB via aws_wafv2_web_acl_association below.
# -----------------------------------------------------------------------------
resource "aws_wafv2_web_acl" "main" {
  name  = "${var.project}-${var.environment}-waf"
  scope = "REGIONAL" # For ALB (not CloudFront)

  # Default action: ALLOW requests that don't match any WAF rule.
  # WAF rules below define what to BLOCK — everything else passes through.
  default_action {
    allow {}
  }

  # ─────────────────────────────────────────────────────────────────────────
  # Rule 1 — IP Reputation List (priority 1 = evaluated first)
  #
  # Blocks traffic from IPs Amazon has identified as malicious:
  #   - Known botnet command-and-control nodes
  #   - Tor exit nodes (commonly used for anonymous attack traffic)
  #   - Scanning infrastructure (Shodan, Masscan, etc.)
  #   - Hosts associated with DDoS activity
  #
  # Why first? Cheapest check — if the IP is bad, skip all other rules.
  # IP reputation is evaluated before inspecting request content.
  # ─────────────────────────────────────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 1 # Lower number = evaluated first

    override_action {
      none {} # Use the managed rule's default action (BLOCK on match)
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
        # AWS updates this list continuously — no configuration needed
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-waf-ip-reputation"
      sampled_requests_enabled   = true # Log sample of matched requests for analysis
    }
  }

  # ─────────────────────────────────────────────────────────────────────────
  # Rule 2 — Common Rule Set (priority 2 = evaluated after IP reputation)
  #
  # Blocks OWASP Top 10 attack patterns:
  #   - SQL injection (SQLi): prevents database exfiltration via request parameters
  #   - Cross-site scripting (XSS): prevents script injection via input fields
  #   - Path traversal: prevents "../../../etc/passwd" directory traversal
  #   - Size restrictions: blocks abnormally large requests (DoS mitigation)
  #   - Common exploit probes: known vulnerability scanners and attack tools
  #
  # Why second? Broadest rule group — catches most attack types.
  # IP reputation blocks known-bad sources; CRS catches attack patterns
  # from sources not yet on the reputation list.
  # ─────────────────────────────────────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {} # Use the managed rule's default action (BLOCK on match)
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        # Rule exclusions can be added here if the CRS blocks legitimate traffic
        # (e.g. if the API accepts large JSON bodies, exclude SizeRestrictions_BODY)
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-waf-crs"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────────────────────────────────────
  # Rule 3 — Known Bad Inputs (priority 3 = evaluated last)
  #
  # Blocks known malicious payload patterns:
  #   - Log4Shell (JNDI injection: ${jndi:ldap://...}) — CVE-2021-44228
  #   - SSRF (Server-Side Request Forgery) attempts: requests that try to make
  #     the server fetch internal resources (metadata endpoints, VPC IPs)
  #   - Common shell injection payloads and exploit kit signatures
  #
  # Why third? Most specific rule — lowest false positive risk. Applied after
  # the broader CRS rule to catch what CRS misses. These are targeted CVE blocks.
  # ─────────────────────────────────────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {} # Use the managed rule's default action (BLOCK on match)
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-waf-known-bad"
      sampled_requests_enabled   = true
    }
  }

  # Overall WAF visibility config — tracks all traffic (allowed + blocked)
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project}-waf-total"
    sampled_requests_enabled   = true # Sample of all requests, not just blocked ones
  }

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Associate the WAF Web ACL with the ALB.
# Without this association, WAF is defined but not enforced.
# All requests to the ALB (api.yorkpulse.com) will pass through WAF rules
# before reaching the target group (ECS tasks).
# -----------------------------------------------------------------------------
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn          # The ALB to protect
  web_acl_arn  = aws_wafv2_web_acl.main.arn # The WAF Web ACL defined above
}

# -----------------------------------------------------------------------------
# WAF logging configuration — sends blocked request details to CloudWatch.
# Each blocked request log entry includes:
#   - Source IP, timestamp, HTTP method, URI
#   - Which rule matched (e.g. SQLi rule, IP reputation)
#   - Request headers and body (for forensic analysis)
#
# This feeds the CloudWatch alarm in cloudwatch.tf that alerts on request spikes.
# If WAF blocks > 100 requests in 5 minutes → SNS alert → email.
# -----------------------------------------------------------------------------
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  # ARN must end with :* — AWS WAF requires this suffix for CloudWatch Logs destinations.
  # Using aws_cloudwatch_log_group.waf.arn (which omits :*) would be rejected.
  # .arn resolves to: arn:aws:logs:us-east-1:<account>:log-group:aws-waf-logs-yorkpulse
  # With :* appended:  arn:aws:logs:us-east-1:<account>:log-group:aws-waf-logs-yorkpulse:*
  log_destination_configs = ["${aws_cloudwatch_log_group.waf.arn}:*"]
  resource_arn = aws_wafv2_web_acl.main.arn
}
