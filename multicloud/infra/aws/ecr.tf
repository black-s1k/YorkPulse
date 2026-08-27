# =============================================================================
# ecr.tf — Elastic Container Registry (ECR) for YorkPulse Docker images
#
# ECR is the single source of truth for all Docker images.
# Both ECS Fargate (AWS) and Azure Container Apps pull from this registry.
#
# Key decisions:
#   - MUTABLE tags: allows pushing :latest without creating a new tag each time
#   - Scan on push: AWS Inspector scans every image for OS + package CVEs
#   - Lifecycle policy: automatically cleans up old images to control storage costs
# =============================================================================

# -----------------------------------------------------------------------------
# ECR repository — stores the yorkpulse-backend Docker image
# GitHub Actions pushes here on every merge to main.
# ECS pulls from here when starting new Fargate tasks.
# Azure Container Apps also pulls from here (ECR is cloud-agnostic).
# -----------------------------------------------------------------------------
resource "aws_ecr_repository" "backend" {
  name = "${var.project}-backend" # → "yorkpulse-backend"

  # MUTABLE allows re-pushing the :latest tag to the same image reference.
  # The CI/CD pipeline tags each build with both :latest and the git SHA.
  # ECS uses :latest; rollback uses the git SHA tag. See guide.md for rollback steps.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    # Scan every image immediately after it's pushed to ECR.
    # AWS Inspector checks the base OS (Debian packages) and pip packages
    # for known CVEs. Results visible in ECR console and Security Hub.
    # Trivy in CI also scans images — this is a second line of defence.
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project}-backend-ecr"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECR lifecycle policy — automatic image cleanup to control storage costs.
#
# Rule 1: Delete untagged images older than 30 days.
#   Untagged images accumulate after every push (the old :latest becomes untagged).
#   Without cleanup, storage costs grow indefinitely. 30 days is enough for any
#   investigation or rollback — beyond that, old untagged images have no value.
#
# Rule 2: Keep only the last 10 tagged images.
#   The CI/CD pipeline tags each image with the git SHA (e.g. :a1b2c3d).
#   Keeping 10 means we can roll back up to 10 deploys. More than 10 adds storage
#   cost with diminishing rollback value. See DECISIONS.md for rollback strategy.
# -----------------------------------------------------------------------------
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Delete untagged images older than 30 days (old :latest leftovers)"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 30 # Keep untagged images for 30 days max
        }
        action = {
          type = "expire" # Expire = delete from ECR
        }
      },
      {
        rulePriority = 2
        description  = "Keep only last 10 tagged images — enough for 10-deploy rollback window"
        selection = {
          tagStatus     = "any"        # Catches all remaining tagged images not matched above
          countType     = "imageCountMoreThan"
          countNumber   = 10           # Delete oldest images beyond 10 total
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
