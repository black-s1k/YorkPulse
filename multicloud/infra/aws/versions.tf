# =============================================================================
# versions.tf — Terraform + provider version pins + S3 remote backend
#
# This file does three things:
#   1. Pins the minimum Terraform CLI version required to run this module
#   2. Pins the AWS provider to a stable major version (5.x)
#   3. Configures the S3 remote backend created in Phase 0.5 (infra/bootstrap/)
#
# The remote backend means terraform.tfstate is stored in S3 (shared, versioned,
# encrypted) instead of on a local disk. DynamoDB locking prevents two concurrent
# terraform apply runs from corrupting state.
# =============================================================================

terraform {
  # Minimum Terraform CLI version. Anyone running an older version gets a clear
  # error message instead of silent misbehaviour from missing HCL features.
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # ~> 5.0 = "pessimistic constraint" — accepts 5.x patch/minor updates
      # (security fixes) but will NOT auto-upgrade to 6.0 which may have
      # breaking changes. Keeps pipelines deterministic.
      version = "~> 5.0"
    }
  }

  # Remote backend — state stored in S3 bucket created during Phase 0.5 bootstrap.
  # NEVER change this block without migrating state first (terraform state pull/push).
  backend "s3" {
    bucket = "yorkpulse-tf-state-847291" # S3 bucket created in Phase 0.5

    # "aws/terraform.tfstate" is the key (path) inside the bucket.
    # Each module uses a different key to keep state files isolated:
    #   infra/aws/   → "aws/terraform.tfstate"
    #   infra/azure/ → "azure/terraform.tfstate"
    key = "aws/terraform.tfstate"

    region = "us-east-1" # bucket region — must match where the bucket was created

    # DynamoDB table created in Phase 0.5. Terraform writes a lock record here
    # before every apply and deletes it when done. Prevents concurrent apply corruption.
    dynamodb_table = "yorkpulse-terraform-locks"

    encrypt = true # AES-256 server-side encryption for the state file in S3
  }
}

# Configure the AWS provider with the region variable.
# Credentials come from environment variables (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
# or IAM role (ECS task role / GitHub Actions OIDC role) — NEVER hardcoded here.
provider "aws" {
  region = var.aws_region # defined in variables.tf — defaults to us-east-1
}
