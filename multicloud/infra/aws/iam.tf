# =============================================================================
# iam.tf — IAM roles for ECS task execution, running containers, and GitHub Actions
#
# Three roles are created here, each with least-privilege permissions:
#
#   1. ECS Task Execution Role — what ECS needs to START a task
#      (pull image from ECR, pull secrets from Secrets Manager, write CloudWatch logs)
#      This role is used by the ECS AGENT, not by the running container.
#
#   2. ECS Task Role — what the RUNNING container can do at runtime
#      (read secrets from Secrets Manager, write CloudWatch logs, connect to Redis)
#      This role is the container's IAM identity. Nothing else is permitted.
#
#   3. GitHub Actions OIDC Role — what the CI/CD pipeline can do
#      (push images to ECR, update ECS service for deploys)
#      Short-lived token issued per pipeline run — no stored AWS credentials in GitHub.
#
# Principle: Every permission has a documented reason. If you can't explain why
# a permission exists, it shouldn't be there.
# =============================================================================

# =============================================================================
# DATA SOURCES — reusable policy documents
# =============================================================================

# Standard ECS trust policy — allows the ECS service to assume this role.
# Used by both the execution role and the task role.
data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"] # Only ECS can assume these roles
    }
  }
}

# GitHub Actions OIDC trust policy — allows GitHub Actions to assume this role
# using short-lived OIDC tokens. No stored AWS keys in GitHub Secrets.
# The condition restricts assumption to the specific repo and branch.
data "aws_iam_policy_document" "github_oidc_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"
      # The OIDC provider ARN — created manually in AWS IAM before apply.
      # See "Manual Steps BEFORE terraform apply" for setup instructions.
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"] # Required by GitHub Actions OIDC spec
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # Restrict to the main branch of the yorkpulse repo only.
      # :* would allow any branch — too permissive. Only main branch deploys to prod.
      values   = ["repo:${var.github_username}/yorkpulse:ref:refs/heads/main"]
    }
  }
}

# Get the current AWS account ID for use in ARN references.
# Never hardcode account IDs — they are account-specific and rotate.
data "aws_caller_identity" "current" {}

# =============================================================================
# ROLE 1 — ECS Task Execution Role
# Used by the ECS agent (not the container) to:
#   - Pull the Docker image from ECR
#   - Pull secret values from Secrets Manager (injected as env vars)
#   - Create and write to the CloudWatch log stream
# =============================================================================

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.project}-${var.environment}-ecs-execution-role"
  description        = "ECS task execution role for YorkPulse"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# AWS-managed policy — grants ECS agent permissions to:
#   - ecr:GetAuthorizationToken, ecr:BatchGetImage, ecr:GetDownloadUrlForLayer
#   - logs:CreateLogStream, logs:PutLogEvents
#   - secretsmanager:GetSecretValue (general — we add our scoped version below)
resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  # Using the managed policy means AWS keeps it updated as ECS adds new requirements.
  # Our inline policy below NARROWS the Secrets Manager access to /yorkpulse/prod/* only.
}

# Inline policy scoped to YorkPulse secrets only.
# The managed policy above grants secretsmanager:GetSecretValue to all secrets.
# This inline policy explicitly documents our intent: only /yorkpulse/prod/* secrets.
# Belt-and-suspenders: even if a new secret is accidentally named differently,
# the execution role can't access it without updating this ARN pattern.
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.project}-${var.environment}-ecs-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          # ARN pattern for all /yorkpulse/prod/* secrets created in secrets.tf
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:/yorkpulse/prod/*"
        ]
      }
    ]
  })
}

# =============================================================================
# ROLE 2 — ECS Task Role
# Used by the RUNNING container (FastAPI) at runtime to:
#   - Re-read secrets from Secrets Manager if needed
#   - Write structured logs to CloudWatch
#   - Connect to ElastiCache (AWS SDK auth)
#
# This is NOT the same as the execution role. The task role is the container's
# own IAM identity after it starts. Least-privilege means it can ONLY do these
# three things — not deploy, not create resources, not touch other accounts.
# =============================================================================

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project}-${var.environment}-ecs-task-role"
  description        = "ECS task role for YorkPulse containers"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# Inline policy for the running container — strict least-privilege
resource "aws_iam_role_policy" "ecs_task_permissions" {
  name = "${var.project}-${var.environment}-ecs-task-permissions"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Allow FastAPI to re-read secrets at runtime (e.g. on refresh or retry).
        # Scoped to /yorkpulse/prod/* only — cannot read other AWS account secrets.
        Sid    = "ReadYorkPulseSecrets"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:/yorkpulse/prod/*"
        ]
      },
      {
        # Allow the FastAPI container to write structured logs to CloudWatch.
        # CreateLogStream: creates the log stream for this task instance.
        # PutLogEvents: writes the actual log lines from uvicorn/FastAPI.
        Sid    = "WriteCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          # Log group ARN for the ECS service — defined in cloudwatch.tf
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${var.project}-backend:*"
        ]
      },
      {
        # Allow the container to authenticate to ElastiCache Redis using IAM.
        # This is the AWS SDK auth method — the auth token is also stored in
        # Secrets Manager as a belt-and-suspenders approach.
        Sid    = "ConnectElastiCache"
        Effect = "Allow"
        Action = ["elasticache:Connect"]
        Resource = [
          # Scoped to the specific ElastiCache cluster created in elasticache.tf
          "arn:aws:elasticache:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster:${var.project}-${var.environment}-redis"
        ]
      }
    ]
  })
}

# =============================================================================
# ROLE 3 — GitHub Actions OIDC Role
# Used by the CI/CD pipeline to:
#   - Push Docker images to ECR after building them
#   - Trigger ECS rolling deployments after a successful push
#   - Pass IAM task roles to ECS (required by ecs:UpdateService)
#
# OIDC (OpenID Connect) = GitHub issues a short-lived token per pipeline run.
# The token expires when the pipeline finishes — no static credentials to steal.
# Condition restricts assumption to the main branch of the yorkpulse repo only.
# =============================================================================

resource "aws_iam_role" "github_actions" {
  name               = "${var.project}-${var.environment}-github-actions-role"
  description        = "GitHub Actions OIDC role for YorkPulse deployments"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_trust.json

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# Inline policy for GitHub Actions — scoped to ECR push + ECS deploy + IAM PassRole
resource "aws_iam_role_policy" "github_actions_permissions" {
  name = "${var.project}-${var.environment}-github-actions-permissions"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetAuthorizationToken: allows "docker login" to ECR from the pipeline.
        # This is an account-level operation — cannot be scoped to a specific repo.
        # All other ECR permissions below ARE scoped to the yorkpulse-backend repo.
        Sid    = "ECRLogin"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = ["*"] # Must be * — cannot be scoped per AWS API design
      },
      {
        # ECR push permissions — scoped to the yorkpulse-backend repository only.
        # These 5 actions are the exact set required for "docker push" to ECR.
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", # Check if layers already exist (avoids re-uploading)
          "ecr:PutImage",                    # Write the final image manifest
          "ecr:InitiateLayerUpload",         # Start a layer upload session
          "ecr:UploadLayerPart",             # Upload a layer chunk
          "ecr:CompleteLayerUpload"          # Finalize the layer upload
        ]
        Resource = [
          aws_ecr_repository.backend.arn # Only the yorkpulse-backend ECR repo
        ]
      },
      {
        # ECS deploy permissions — update the service to use the new image.
        # DescribeServices: required to check current service state before updating.
        # UpdateService: triggers the rolling deploy with the new task definition.
        Sid    = "ECSDeploy"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = [
          # Scoped to the specific ECS service in the yorkpulse cluster
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${var.project}-${var.environment}-cluster/${var.project}-${var.environment}-backend"
        ]
      },
      {
        # iam:PassRole is required when ECS creates a new task that references IAM roles.
        # Without this, ECS UpdateService fails with "is not authorized to perform iam:PassRole".
        # Scoped to only the ECS task roles — cannot pass any other role.
        Sid    = "PassECSTaskRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_task_execution.arn, # Execution role — for ECS agent
          aws_iam_role.ecs_task.arn            # Task role — for running container
        ]
      }
    ]
  })
}
