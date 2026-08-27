# =============================================================================
# ecs.tf — ECS Fargate cluster, task definition, and service for FastAPI backend
#
# ECS Fargate runs the FastAPI Docker image in a fully managed serverless
# container environment — no EC2 instances to patch or manage.
#
# Key decisions:
#   - 0.5 vCPU / 1GB RAM: right-sized for YorkPulse's student traffic
#   - All secrets injected from Secrets Manager at task startup (never hardcoded)
#   - Rolling deployment: min 100% healthy, max 200% capacity
#     → one old task stays running until the new task is healthy (zero-downtime deploy)
#   - Private subnets only: ECS tasks have no public IPs
#   - CloudWatch log driver: structured JSON from FastAPI → 30-day retention
#
# See DECISIONS.md for the rolling deploy settings rationale.
# =============================================================================

# -----------------------------------------------------------------------------
# CloudWatch log group for ECS task output
# All stdout/stderr from the FastAPI container goes here.
# 30-day retention = enough for debugging + cost-controlled (unlimited = expensive).
# The log group name must match the awslogs-group in the container definition below.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ecs_backend" {
  name              = "/ecs/${var.project}-backend" # → "/ecs/yorkpulse-backend"
  retention_in_days = 30                            # 30 days balances debuggability with cost

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECS Cluster — the logical grouping for ECS services and tasks.
# Fargate means AWS manages the underlying EC2 infrastructure.
# The cluster itself has no cost — you pay per running Fargate task.
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${var.project}-${var.environment}-cluster" # → "yorkpulse-prod-cluster"

  # Container Insights = CloudWatch metrics for the cluster (CPU, memory per service).
  # Costs ~$0.50/month extra but enables the CPU/memory alarms in cloudwatch.tf.
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project}-${var.environment}-cluster"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECS Task Definition — the blueprint for what runs inside a Fargate task.
# Defines CPU/memory, network mode, IAM roles, and the container configuration.
#
# Execution role vs Task role:
#   - execution_role_arn = ECS agent's role (pulls image + secrets before container starts)
#   - task_role_arn      = running container's role (what FastAPI can do at runtime)
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-${var.environment}-backend" # versioned by ECS as family:revision
  cpu                      = "512"    # 0.5 vCPU — adequate for FastAPI async workloads
  memory                   = "1024"   # 1 GB RAM — enough for asyncpg connection pool + uvicorn workers
  network_mode             = "awsvpc" # Required for Fargate — each task gets its own ENI and IP
  requires_compatibilities = ["FARGATE"]

  # Execution role: used by the ECS agent to pull image + secrets before FastAPI starts
  execution_role_arn = aws_iam_role.ecs_task_execution.arn

  # Task role: the running FastAPI container's IAM identity at runtime
  task_role_arn = aws_iam_role.ecs_task.arn

  # Container definition — what runs inside the task
  container_definitions = jsonencode([
    {
      name  = "${var.project}-backend" # Container name — referenced by ECS service
      image = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      # ECR URL format: <account>.dkr.ecr.<region>.amazonaws.com/<repo>:<tag>
      # GitHub Actions overrides backend_image_tag with the git SHA per deploy

      essential = true # If this container exits, ECS restarts the entire task

      # Port mapping — ECS registers this IP:port in the ALB target group
      portMappings = [
        {
          containerPort = 8000   # FastAPI listens on 8000 (matches ALB target group)
          protocol      = "tcp"
        }
      ]

      # Secrets — pulled from Secrets Manager at task startup by the ECS agent.
      # The ECS execution role (iam.tf) grants GetSecretValue for /yorkpulse/prod/*.
      # These become environment variables INSIDE the container at runtime.
      # The secret values are NEVER stored in the task definition JSON.
      secrets = [
        {
          name      = "DATABASE_URL"    # Env var name inside the container
          valueFrom = aws_secretsmanager_secret.database_url.arn
        },
        {
          name      = "JWT_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.jwt_secret_key.arn
        },
        {
          name      = "SUPABASE_URL"
          valueFrom = aws_secretsmanager_secret.supabase_url.arn
        },
        {
          name      = "SUPABASE_KEY"
          valueFrom = aws_secretsmanager_secret.supabase_key.arn
        },
        {
          name      = "REDIS_URL"
          valueFrom = aws_secretsmanager_secret.redis_url.arn
        },
        {
          name      = "SMTP_PASSWORD"
          valueFrom = aws_secretsmanager_secret.smtp_password.arn
        }
      ]

      # Non-secret environment variables — safe to store in task definition
      environment = [
        {
          name  = "CORS_ORIGINS"
          # Pydantic parses this as a JSON array — must use JSON array format, not CSV.
          # jsonencode() guarantees valid JSON output without manual quote escaping.
          # Includes api.yorkpulse.com for any same-origin requests from the ALB.
          value = jsonencode(["https://yorkpulse.com", "https://www.yorkpulse.com", "https://api.yorkpulse.com"])
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region # Used by boto3/botocore for AWS SDK calls
        }
      ]

      # CloudWatch logging — all stdout/stderr from FastAPI goes to this log group.
      # awslogs driver is the standard for ECS Fargate — no log agent needed.
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_backend.name
          "awslogs-region"        = var.aws_region
          # awslogs-stream-prefix creates log streams like: "ecs/yorkpulse-backend/<task-id>"
          # Makes it easy to find logs for a specific task instance in CloudWatch
          "awslogs-stream-prefix" = "ecs"
        }
      }

      # Health check — ECS uses this to determine if the container is healthy.
      # Matches the ALB target group health check path.
      healthCheck = {
        command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')\""]
        interval    = 30   # Check every 30 seconds
        timeout     = 5    # Wait 5 seconds for a response
        retries     = 3    # 3 consecutive failures = unhealthy
        startPeriod = 40   # Grace period for startup (alembic migrations + uvicorn import)
      }
    }
  ])

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECS Service — keeps the desired number of tasks running and connects them to the ALB.
# The service handles:
#   - Starting new tasks when the count falls below desired_count
#   - Rolling deployments (replace old tasks with new ones on update)
#   - Registering/deregistering tasks from the ALB target group
#   - Restarting tasks that fail health checks
# -----------------------------------------------------------------------------
resource "aws_ecs_service" "backend" {
  name            = "${var.project}-${var.environment}-backend" # → "yorkpulse-prod-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  launch_type     = "FARGATE"

  # desired_count = 1 for portfolio/demo usage.
  # At semester start or under load, increase this manually or via auto-scaling.
  # With min_healthy_percent = 100 below, ECS keeps 1 task running DURING deploys
  # by starting the new task before stopping the old one.
  desired_count = 1

  # Network configuration — ECS tasks run in private subnets with no public IPs.
  # All inbound traffic comes from the ALB via the ECS security group.
  network_configuration {
    subnets = [
      aws_subnet.private_a.id, # Two private subnets = ECS can spread tasks across AZs
      aws_subnet.private_b.id
    ]
    security_groups  = [aws_security_group.ecs.id] # Only allow port 8000 from ALB
    assign_public_ip = false                       # Private subnet → no public IP, ever
  }

  # Load balancer registration — tell ECS to register tasks with the ALB target group.
  # When a new task starts and passes health checks, ALB begins routing traffic to it.
  # When a task stops (e.g. deploy), ALB drains it before deregistration.
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "${var.project}-backend" # Must match the container name in task definition
    container_port   = 8000                      # Port FastAPI listens on
  }

  # Rolling deployment configuration.
  # See DECISIONS.md: "ECS Rolling Deploy Settings"
  deployment_minimum_healthy_percent = 100
  # minimum_healthy_percent = 100 with desired_count = 1:
  #   ECS must keep at least 1 healthy task running during a deploy.
  #   It starts the new task FIRST, waits for it to pass health checks,
  #   THEN stops the old task. Result: zero-downtime deployments.

  deployment_maximum_percent = 200
  # maximum_percent = 200 with desired_count = 1:
  #   ECS can run up to 2 tasks simultaneously during a deploy (1 old + 1 new).
  #   This is the headroom needed for minimum_healthy_percent = 100 to work.
  #   Without 200%, ECS couldn't start a new task before stopping the old one.

  # Ignore task definition changes from outside Terraform (e.g. ECS rolling deploys
  # updating the image tag). Without this, Terraform would try to revert to the
  # task definition it last applied, fighting with the CI/CD pipeline.
  lifecycle {
    ignore_changes = [task_definition]
  }

  # Service depends on the ALB listener existing before ECS tries to register tasks.
  # Without this, ECS might try to register before the target group is ready.
  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy_attachment.ecs_execution_managed
  ]

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}
