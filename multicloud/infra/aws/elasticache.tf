# =============================================================================
# elasticache.tf — ElastiCache Redis for rate-limiting and caching
#
# ElastiCache Redis runs INSIDE the VPC in the private subnets.
# ECS tasks connect to it at sub-millisecond latency — no internet hop.
# The Redis cluster NEVER has a public endpoint.
#
# Key decisions:
#   - cache.t3.micro: single-node, minimal cost (~$12/month)
#   - Redis 7.x: latest stable, supports Redis 7 commands
#   - transit_encryption_enabled = true: TLS for all client-Redis traffic
#     (data in transit is encrypted even though it's VPC-internal)
#   - auth_token from Secrets Manager: Redis requires a password to connect
#     (ElastiCache requires auth when transit encryption is enabled)
#   - Single-AZ: Multi-AZ would double cost with no benefit at this scale
#
# See DECISIONS.md: "ElastiCache TLS and Auth Token Decision"
#
# After apply: construct REDIS_URL and fill in /yorkpulse/prod/redis-url secret:
#   rediss://:<auth-token>@<cluster-endpoint>:6379
#   Note "rediss://" (double-s) = TLS-enabled Redis connection
# =============================================================================

# -----------------------------------------------------------------------------
# ElastiCache Subnet Group — tells ElastiCache which VPC subnets it can use.
# Must be private subnets — Redis should NEVER be in a public subnet.
# ElastiCache will place the Redis node in one of these subnets.
# -----------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project}-${var.environment}-redis-subnet-group"
  description = "YorkPulse production Redis subnet group"
  subnet_ids = [
    aws_subnet.private_a.id, # Redis node can be placed in either private AZ
    aws_subnet.private_b.id
  ]

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Data source to read the Redis auth token from Secrets Manager.
# The auth token must be manually filled in AWS Console BEFORE apply
# (or the ElastiCache cluster creation will fail — the token is required
# when transit_encryption_enabled = true).
#
# Why read from Secrets Manager here instead of a variable?
#   - Never put auth tokens in Terraform variables (risk of state file exposure)
#   - The token is shared between this resource and the /yorkpulse/prod/redis-url secret
#   - Secrets Manager is the single source of truth
# -----------------------------------------------------------------------------
data "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id
  # NOTE: This data source will FAIL if the secret has no value.
  # You must manually set the /yorkpulse/prod/redis-auth-token secret value
  # in AWS Console BEFORE running terraform apply.
  # Generate the token with: python -c 'import secrets; print(secrets.token_urlsafe(32))'
  # Token requirements: 16-128 characters, no "@" or "/" characters
}

# -----------------------------------------------------------------------------
# ElastiCache Replication Group — creates a Redis cluster.
# "Replication group" is ElastiCache's term for a Redis cluster — even for a
# single-node cluster without replication, this resource type is used.
#
# Single-node configuration:
#   num_cache_clusters = 1   → one Redis node, no replicas
#   automatic_failover_enabled = false → no multi-AZ failover (single node)
# For production at scale, increase to 2 nodes with automatic_failover_enabled = true.
# At YorkPulse's current traffic, single-node is sufficient and cheaper.
# -----------------------------------------------------------------------------
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project}-${var.environment}-redis" # → "yorkpulse-prod-redis"
  description          = "YorkPulse production Redis cluster"

  # cache.t3.micro: 0.5 GB RAM — more than enough for rate-limit counters and response caches
  # If memory pressure becomes an issue, upgrade to cache.t3.small (1.37 GB)
  node_type = "cache.t3.micro"

  # Single-node cluster — no replication.
  # At this traffic level, if the Redis node dies, rate limiting degrades gracefully
  # (FastAPI's Redis middleware allows all requests on Redis failure — see main.py).
  num_cache_clusters         = 1     # 1 node, no replicas
  automatic_failover_enabled = false # Requires >= 2 nodes to enable

  # Redis 7.x — latest stable major version.
  # Supports all Redis 7 commands, better memory efficiency, and ACL improvements.
  # ElastiCache manages minor version upgrades automatically (7.x patch updates).
  engine         = "redis"
  engine_version = "7.1" # Latest Redis 7 minor version available on ElastiCache

  port = 6379 # Standard Redis port — matches the ECS security group rule in vpc.tf

  # Subnet group — constrains Redis to the private subnets defined above
  subnet_group_name = aws_elasticache_subnet_group.main.name

  # Security group — only allows connections from ECS tasks on port 6379
  security_group_ids = [aws_security_group.elasticache.id]

  # TLS encryption for all client-Redis traffic.
  # See DECISIONS.md: "ElastiCache TLS Decision"
  # Even though Redis is VPC-internal, encrypting in transit means:
  #   - An attacker who compromises the VPC network cannot read Redis data
  #   - Redis auth token is required (ElastiCache enforces this with TLS enabled)
  #   - The connection URL uses "rediss://" (double-s) for TLS
  transit_encryption_enabled = true

  # Auth token = the Redis password required to connect.
  # Stored in /yorkpulse/prod/redis-auth-token (created in secrets.tf).
  # Must be filled manually BEFORE terraform apply (see data source above).
  # This same token goes into the REDIS_URL secret: rediss://:<token>@<endpoint>:6379
  auth_token = data.aws_secretsmanager_secret_version.redis_auth_token.secret_string

  # Encrypt Redis data at rest using AWS-managed KMS key.
  # Belt-and-suspenders: data encrypted both in transit (TLS) and at rest (AES-256).
  at_rest_encryption_enabled = true

  # Apply minor version updates automatically during the maintenance window.
  # Security patches are applied without manual intervention.
  auto_minor_version_upgrade = true

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}
