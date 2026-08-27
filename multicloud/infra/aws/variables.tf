# =============================================================================
# variables.tf — Input variable declarations for the infra/aws module
#
# All resource names in this module are prefixed with var.project and
# var.environment (e.g. "yorkpulse-prod-vpc") so the same Terraform code
# could be applied to a staging environment by changing var.environment.
#
# NEVER hardcode account IDs, secret values, or ARNs here.
# Secrets are stored in AWS Secrets Manager (secrets.tf) — not in variables.
# =============================================================================

variable "project" {
  description = "Project name — used as a prefix for all resource names"
  type        = string
  default     = "yorkpulse" # Matches ECR repo name, ECS cluster name, etc.
}

variable "environment" {
  description = "Deployment environment — used in resource names and tags"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region where all resources are deployed"
  type        = string
  default     = "us-east-1" # US East is lowest-latency for most Canadian users
}

variable "backend_image_tag" {
  description = "Docker image tag to deploy — overridden by CI/CD pipeline per commit"
  type        = string
  default     = "latest" # Default for manual applies; pipeline passes the git SHA
}

variable "alert_email" {
  description = "Email address that receives CloudWatch alarm notifications via SNS"
  type        = string
  default     = "yorkpulse.app@gmail.com" # Admin email — not a secret, safe to version-control
}

variable "acm_certificate_arn" {
  description = <<-EOT
    ARN of the ACM TLS certificate for api.yorkpulse.com.

    MANUAL STEP REQUIRED BEFORE APPLY:
    Create this certificate in AWS Certificate Manager (ACM) in the AWS Console
    for the domain 'api.yorkpulse.com'. After DNS validation completes, paste the
    certificate ARN here or pass it as -var='acm_certificate_arn=arn:aws:acm:...'
  EOT
  type        = string
  default     = "" # Must be filled before the HTTPS listener in alb.tf will work
}

variable "github_username" {
  description = <<-EOT
    GitHub username or org that owns the yorkpulse repository.
    Used in the GitHub Actions OIDC trust policy in iam.tf.
    Example: "nrup" for github.com/nrup/yorkpulse
  EOT
  type        = string
  default     = "YOUR_GITHUB_USERNAME" # Replace with actual GitHub username before apply
}
