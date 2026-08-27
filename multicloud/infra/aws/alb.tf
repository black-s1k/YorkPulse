# =============================================================================
# alb.tf — Application Load Balancer for public HTTPS traffic to ECS
#
# The ALB is the public entry point for api.yorkpulse.com.
# It sits in the public subnets and routes traffic to ECS tasks in private subnets.
# WAF (waf.tf) is attached to the ALB and filters all traffic before it reaches
# the target group.
#
# Traffic flow:
#   Internet → (WAF filter) → ALB:443 HTTPS → Target Group → ECS task:8000
#
# MANUAL STEP REQUIRED BEFORE TERRAFORM APPLY:
#   Create an ACM TLS certificate for "api.yorkpulse.com" in the AWS Console
#   (Certificate Manager → Request certificate → DNS validation).
#   After DNS validation completes, copy the certificate ARN and set:
#   var.acm_certificate_arn = "arn:aws:acm:us-east-1:<account>:certificate/<id>"
#   The HTTPS listener (port 443) will fail to create without a valid ACM ARN.
# =============================================================================

# -----------------------------------------------------------------------------
# Application Load Balancer — internet-facing, in the two public subnets.
# "internet-facing" means the ALB gets a public DNS name and accepts traffic
# from anywhere. The ECS tasks behind it remain in private subnets.
# -----------------------------------------------------------------------------
resource "aws_lb" "main" {
  name               = "${var.project}-${var.environment}-alb"
  internal           = false              # internet-facing (not private/internal)
  load_balancer_type = "application"      # Layer 7 (HTTP/HTTPS) — required for WAF
  security_groups    = [aws_security_group.alb.id] # Allow 80 + 443 from anywhere
  subnets = [
    aws_subnet.public_a.id, # Two public subnets required for ALB multi-AZ availability
    aws_subnet.public_b.id
  ]

  # Enable access logging to S3 for ALB request logs (optional — enable if needed for forensics)
  # access_logs { bucket = "..." enabled = true } — left disabled to avoid S3 cost

  tags = {
    Name        = "${var.project}-${var.environment}-alb"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Target group — the group of ECS tasks that the ALB forwards traffic to.
# Type "ip" is required for Fargate (awsvpc network mode — each task gets its own IP).
# The ALB sends traffic directly to task IPs, not to any host/EC2 instance.
# Health checks on /api/v1/health determine which tasks are healthy to receive traffic.
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "backend" {
  name        = "${var.project}-${var.environment}-tg"
  port        = 8000          # The port FastAPI listens on inside the container
  protocol    = "HTTP"        # HTTP between ALB and ECS (TLS terminated at ALB)
  vpc_id      = aws_vpc.main.id
  target_type = "ip"          # Required for Fargate awsvpc network mode

  health_check {
    # Exact path must match the FastAPI health route:
    # main.py registers the health router with prefix="/api/v1"
    # health.py defines the route as "/"
    # Full path: /api/v1/health
    path                = "/api/v1/health"
    protocol            = "HTTP"
    port                = "traffic-port" # Same port as the target group (8000)
    interval            = 30             # Check every 30 seconds
    timeout             = 5              # Wait 5 seconds for a response
    healthy_threshold   = 2             # 2 consecutive successes = healthy
    unhealthy_threshold = 3             # 3 consecutive failures = unhealthy → drained from target group
    matcher             = "200"         # Only HTTP 200 counts as healthy
  }

  # Allow time for in-flight requests to complete before draining the target.
  # During rolling deploys, old tasks receive 30 seconds to finish their requests
  # before being terminated. Prevents HTTP 502 errors during deploys.
  deregistration_delay = 30

  tags = {
    Name        = "${var.project}-${var.environment}-tg"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# HTTP listener (port 80) — redirects all HTTP traffic to HTTPS.
# Never serves application traffic over plain HTTP.
# The redirect is 301 (permanent) — browsers cache it and go directly to HTTPS.
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect" # Not "forward" — redirect to HTTPS, don't serve plain HTTP

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301" # Permanent redirect — browsers remember this
    }
  }
}

# -----------------------------------------------------------------------------
# HTTPS listener (port 443) — the actual application traffic listener.
# TLS is terminated here at the ALB. Traffic from ALB → ECS is HTTP (port 8000).
# This is standard practice: TLS termination at the edge, plain HTTP inside the VPC.
# The VPC's security groups ensure that only the ALB can send HTTP to ECS.
#
# REQUIRES: var.acm_certificate_arn must be set to a valid, validated ACM cert ARN
# for api.yorkpulse.com. If this variable is empty (""), terraform apply will fail.
# See MANUAL STEPS BEFORE APPLY in the prompt for how to create the ACM cert.
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # TLS 1.3 preferred, TLS 1.2 fallback

  # The ACM certificate ARN — must be created manually before apply.
  # Replace by passing -var='acm_certificate_arn=arn:aws:acm:...' to terraform apply.
  certificate_arn = var.acm_certificate_arn

  default_action {
    type             = "forward"                         # Send traffic to the ECS target group
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
