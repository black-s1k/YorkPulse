# =============================================================================
# secrets.tf — AWS Secrets Manager secrets for YorkPulse backend
#
# All backend secrets are stored here as EMPTY placeholders.
# After "terraform apply", you must manually fill each secret value
# in the AWS Console or via AWS CLI before starting ECS tasks.
#
# Why Secrets Manager (not environment variables in the task definition)?
#   - Secrets Manager values are never stored in the task definition JSON
#   - The ECS agent pulls secrets at task startup and injects them as env vars
#   - Values are encrypted at rest (AES-256) and in transit (TLS)
#   - Fine-grained IAM: the ECS task role only has GetSecretValue on /yorkpulse/prod/*
#   - Rotation can be enabled later without any task definition changes
#
# Naming convention: /yorkpulse/prod/<secret-name>
#   The IAM policy in iam.tf grants access to /yorkpulse/prod/* (wildcard)
#   so adding new secrets here automatically grants ECS access to them.
# =============================================================================

# -----------------------------------------------------------------------------
# DATABASE_URL — Supabase PostgreSQL connection string
# Format: postgresql+asyncpg://user:password@host:5432/postgres
# Where to get: Supabase Dashboard → Project Settings → Database → Connection string
# Note: Use the "URI" format with ?sslmode=require appended
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "database_url" {
  name        = "/yorkpulse/prod/database-url"
  description = "Supabase PostgreSQL connection string for the FastAPI backend (asyncpg format)"

  # Keep the secret for 7 days after deletion before permanent removal.
  # This gives a recovery window if the secret is accidentally deleted.
  # Set to 0 for immediate deletion (not recommended for production).
  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# JWT_SECRET_KEY — Secret key used to sign and verify JWT auth tokens
# Generate with: python -c 'import secrets; print(secrets.token_hex(32))'
# Must be at least 32 bytes of random hex. The same key must be used across
# all ECS tasks — all tasks read from this single secret.
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "jwt_secret_key" {
  name        = "/yorkpulse/prod/jwt-secret-key"
  description = "JWT signing secret for YorkPulse auth tokens (generate with secrets.token_hex(32))"

  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# SUPABASE_URL — Supabase project URL
# Format: https://<project-ref>.supabase.co
# Where to get: Supabase Dashboard → Project Settings → API → Project URL
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "supabase_url" {
  name        = "/yorkpulse/prod/supabase-url"
  description = "Supabase project URL (used by FastAPI for Auth and Storage operations)"

  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# SUPABASE_KEY — Supabase service role key (NOT the anon key)
# The service role key bypasses Row Level Security — used server-side only.
# Never expose this key in the frontend or in the Docker image.
# Where to get: Supabase Dashboard → Project Settings → API → service_role key
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "supabase_key" {
  name        = "/yorkpulse/prod/supabase-key"
  description = "Supabase service_role key (server-side only — bypasses RLS, never in frontend)"

  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# REDIS_URL — ElastiCache Redis connection URL
# Format: rediss://:AUTH_TOKEN@<elasticache-endpoint>:6379
#   Note "rediss://" (double-s) = Redis with TLS (transit_encryption_enabled = true)
#   The auth token comes from /yorkpulse/prod/redis-auth-token (secret below)
# After terraform apply: check elasticache.tf outputs for the cluster endpoint,
# then construct the full URL: rediss://:<token>@<endpoint>:6379
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "redis_url" {
  name        = "/yorkpulse/prod/redis-url"
  description = "ElastiCache Redis TLS URL (rediss://:token@endpoint:6379)"

  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# SMTP_PASSWORD — Gmail App Password for OTP email delivery
# This is NOT the Gmail account password — it's an App Password generated in
# Google Account → Security → 2-Step Verification → App passwords.
# The admin email is yorkpulse.app@gmail.com — see CLAUDE.md for context.
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "smtp_password" {
  name        = "/yorkpulse/prod/smtp-password"
  description = "Gmail App Password for SMTP OTP email delivery (yorkpulse.app@gmail.com)"

  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# REDIS_AUTH_TOKEN — ElastiCache auth token for Redis connection authentication
# This is the password ElastiCache requires when transit_encryption_enabled = true.
# Generate with: python -c 'import secrets; print(secrets.token_urlsafe(32))'
# This token is referenced by elasticache.tf to configure the Redis cluster.
# It is also needed to build the REDIS_URL secret above.
# Length requirement: 16-128 characters, no @ or / characters.
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name        = "/yorkpulse/prod/redis-auth-token"
  description = "ElastiCache Redis auth token (used by elasticache.tf + to build REDIS_URL)"

  recovery_window_in_days = 7

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# =============================================================================
# NOTE: These secrets are created with EMPTY values by Terraform.
# You MUST manually populate each secret before starting ECS tasks.
# See the "Manual Steps AFTER terraform apply" section in the prompt output.
# =============================================================================
