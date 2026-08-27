# =============================================================================
# outputs.tf — Terraform outputs for infra/aws module
#
# These values are printed after "terraform apply" completes.
# They are needed for:
#   - Phase 3 (Azure): ALB DNS for health verification from Azure
#   - Phase 4 (GitHub Actions): ECR URL, ECS cluster + service names for CI/CD
#   - Manual steps: ALB DNS for Route 53 CNAME record to api.yorkpulse.com
#   - REDIS_URL construction: ElastiCache endpoint needed to build the connection string
#
# Access outputs any time with: terraform output
# Access a specific output: terraform output alb_dns_name
# =============================================================================

# -----------------------------------------------------------------------------
# ALB DNS name — the public DNS address of the load balancer.
# Used to:
#   1. Create a CNAME record in your DNS provider pointing api.yorkpulse.com → this DNS
#   2. Verify the ALB is reachable before DNS propagation completes (curl this directly)
# Format: yorkpulse-prod-alb-<random>.us-east-1.elb.amazonaws.com
# -----------------------------------------------------------------------------
output "alb_dns_name" {
  description = "ALB public DNS name — create a CNAME record api.yorkpulse.com → this value"
  value       = aws_lb.main.dns_name
}

# -----------------------------------------------------------------------------
# ECR repository URL — the full Docker registry URL for pushing and pulling images.
# Used in GitHub Actions CI/CD (Phase 4) for docker push and ECS task definition.
# Format: <account-id>.dkr.ecr.us-east-1.amazonaws.com/yorkpulse-backend
# -----------------------------------------------------------------------------
output "ecr_repository_url" {
  description = "ECR repository URL — used in CI/CD for docker push and ECS task definition image"
  value       = aws_ecr_repository.backend.repository_url
}

# -----------------------------------------------------------------------------
# ECS cluster name — needed for ECS CLI commands and GitHub Actions deploy step.
# GitHub Actions uses this in: aws ecs update-service --cluster <name> ...
# -----------------------------------------------------------------------------
output "ecs_cluster_name" {
  description = "ECS cluster name — used in GitHub Actions for ecs update-service deploy command"
  value       = aws_ecs_cluster.main.name
}

# -----------------------------------------------------------------------------
# ECS service name — needed for ECS CLI commands and GitHub Actions deploy step.
# GitHub Actions uses this in: aws ecs update-service --service <name> ...
# -----------------------------------------------------------------------------
output "ecs_service_name" {
  description = "ECS service name — used in GitHub Actions for ecs update-service deploy command"
  value       = aws_ecs_service.backend.name
}

# -----------------------------------------------------------------------------
# VPC ID — needed for Phase 3 (Azure) if VPC peering is added, and for
# any additional resources that need to reference the VPC (e.g. VPC endpoints).
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC ID — reference this when adding VPC endpoints or other VPC-scoped resources"
  value       = aws_vpc.main.id
}

# -----------------------------------------------------------------------------
# ElastiCache endpoint — the hostname to use in the REDIS_URL secret.
# After apply: fill /yorkpulse/prod/redis-url with:
#   rediss://:<redis-auth-token>@<this-endpoint>:6379
# Note "rediss://" (double-s) = TLS-enabled connection (transit_encryption_enabled = true)
# -----------------------------------------------------------------------------
output "elasticache_endpoint" {
  description = "ElastiCache Redis primary endpoint — use to construct the REDIS_URL secret"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# -----------------------------------------------------------------------------
# GitHub Actions IAM role ARN — configure this in GitHub repo settings.
# GitHub Actions → Settings → Secrets and Variables → Actions → New secret:
#   AWS_ROLE_ARN = <this value>
# The pipeline uses: aws-actions/configure-aws-credentials with role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
# -----------------------------------------------------------------------------
output "github_actions_role_arn" {
  description = "GitHub Actions OIDC role ARN — add as AWS_ROLE_ARN secret in GitHub repo settings"
  value       = aws_iam_role.github_actions.arn
}

# -----------------------------------------------------------------------------
# SNS topic ARN — reference this to add new subscribers (Slack, PagerDuty, etc.)
# or to manually publish a test alarm: aws sns publish --topic-arn <arn> --message "test"
# -----------------------------------------------------------------------------
output "sns_alerts_topic_arn" {
  description = "SNS alerts topic ARN — add subscribers or test alarms with aws sns publish"
  value       = aws_sns_topic.alerts.arn
}

# -----------------------------------------------------------------------------
# Route 53 hosted zone ID — needed when adding future DNS records outside this
# module, or when configuring other AWS services (CloudFront, SES) that ask
# for the hosted zone ID to create their own validation/alias records.
# -----------------------------------------------------------------------------
output "route53_zone_id" {
  description = "Route 53 hosted zone ID for yorkpulse.com — reference when adding future DNS records"
  value       = data.aws_route53_zone.main.zone_id
}

# -----------------------------------------------------------------------------
# Route 53 nameservers — copy all four of these to your registrar (Name.com).
# CRITICAL: updating nameservers is what actually cuts DNS traffic over to Route 53.
# Until nameservers are updated at Name.com, all the Route 53 records in this file
# are unreachable — DNS queries still go to your old nameservers.
# Propagation time after nameserver update: 24-48 hours (most resolvers: <1 hour).
# -----------------------------------------------------------------------------
output "route53_nameservers" {
  description = "Route 53 nameservers — update ALL FOUR at Name.com to complete DNS migration"
  value       = data.aws_route53_zone.main.name_servers
}
