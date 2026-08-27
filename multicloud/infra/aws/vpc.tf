# =============================================================================
# vpc.tf — Network isolation layer for the YorkPulse backend on AWS
#
# Creates a private, hardened network with:
#   - A VPC (10.0.0.0/16) that isolates all backend resources
#   - Public subnets → ALB only (internet-facing, no direct app access)
#   - Private subnets → ECS tasks + ElastiCache (no public IPs, ever)
#   - Internet Gateway → allows inbound traffic to reach the ALB
#   - NAT Gateway → allows ECS tasks to reach Supabase + Gmail SMTP outbound
#     without exposing them to inbound traffic (private subnet safety)
#   - Security groups → whitelist-only rules (deny everything by default)
#
# Security principle: The FastAPI container NEVER has a public IP.
# All public traffic enters via the ALB in the public subnet,
# gets filtered by WAF (waf.tf), then forwarded to ECS in the private subnet.
# =============================================================================

# -----------------------------------------------------------------------------
# VPC — the isolated network boundary for all YorkPulse AWS resources
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  # /16 gives 65,536 IP addresses — more than enough for ECS tasks and future growth
  cidr_block = "10.0.0.0/16"

  # Required for ECS tasks to resolve internal AWS service hostnames
  # (ECR, Secrets Manager, CloudWatch endpoints)
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project}-${var.environment}-vpc"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Public subnets — for the ALB only. Two AZs for ALB high-availability.
# The ALB requires subnets in at least 2 AZs to function.
# ECS tasks do NOT go here — they live in the private subnets below.
# -----------------------------------------------------------------------------
resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24" # 256 IPs — sufficient for ALB ENIs
  availability_zone = "${var.aws_region}a"

  # ALB nodes get public IPs so they can receive inbound internet traffic.
  # ECS tasks in private subnets never get public IPs.
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project}-${var.environment}-public-a"
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_subnet" "public_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24" # Second AZ — required for ALB multi-AZ
  availability_zone = "${var.aws_region}b"

  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project}-${var.environment}-public-b"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Private subnets — for ECS tasks and ElastiCache Redis.
# Resources here have NO public IPs and are unreachable from the internet.
# Outbound traffic (to Supabase, Gmail SMTP) routes through the NAT Gateway.
# Two AZs for ECS service resilience — if one AZ goes down, ECS shifts tasks.
# -----------------------------------------------------------------------------
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24" # 256 IPs — each ECS task gets one IP
  availability_zone = "${var.aws_region}a"

  # Never assign public IPs to resources in private subnets
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project}-${var.environment}-private-a"
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.4.0/24" # Second private AZ
  availability_zone = "${var.aws_region}b"

  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project}-${var.environment}-private-b"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Internet Gateway — the entry/exit point for the VPC to the public internet.
# Attached to the VPC, not to any subnet. The public route table below
# directs traffic through it. Without this, the ALB cannot receive requests.
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id # Attach to our VPC

  tags = {
    Name        = "${var.project}-${var.environment}-igw"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Elastic IP for the NAT Gateway.
# NAT Gateway needs a static public IP so Supabase/Gmail see a consistent
# outbound IP (useful for IP allowlisting on external services).
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  domain = "vpc" # Required for NAT Gateway EIPs (not "classic" EC2 EIPs)

  # EIP must exist before the NAT Gateway and the Internet Gateway is attached
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "${var.project}-${var.environment}-nat-eip"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# NAT Gateway — allows ECS tasks in private subnets to make OUTBOUND internet
# requests (to Supabase PostgreSQL, Supabase Storage, Gmail SMTP, Supabase Auth)
# WITHOUT exposing them to inbound traffic.
#
# Placed in ONE public subnet only (single-AZ NAT Gateway = ~$32/month).
# If both AZs needed NAT, we'd need two NAT Gateways → ~$64/month.
# At YorkPulse's traffic levels, single-AZ NAT is the right cost tradeoff.
# See DECISIONS.md: "NAT Gateway vs VPC Endpoints"
#
# After AWS credits run out (~5-6 weeks): replace with VPC endpoints for
# ECR/S3/SecretsManager to save ~$32/month. See guide.md for the plan.
# -----------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id           # The static public IP
  subnet_id     = aws_subnet.public_a.id   # Must be in a PUBLIC subnet

  depends_on = [aws_internet_gateway.main] # IGW must exist before NAT Gateway

  tags = {
    Name        = "${var.project}-${var.environment}-nat-gw"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Public route table — routes internet-bound traffic from the public subnets
# through the Internet Gateway. Used by the ALB.
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # 0.0.0.0/0 = "everything not destined for the VPC CIDR"
  # → route it to the Internet Gateway (outbound = internet response)
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project}-${var.environment}-public-rt"
    Project     = var.project
    Environment = var.environment
  }
}

# Associate the public route table with both public subnets (ALB subnets)
resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# Private route table — routes internet-bound traffic from private subnets
# through the NAT Gateway. Used by ECS tasks to reach Supabase and SMTP.
# Inbound traffic from the internet CAN'T reach private subnets via this route.
# -----------------------------------------------------------------------------
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # ECS tasks in private subnets → NAT Gateway → Internet
  # (one-directional: outbound only — no inbound from internet via NAT)
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name        = "${var.project}-${var.environment}-private-rt"
    Project     = var.project
    Environment = var.environment
  }
}

# Associate the private route table with both private subnets (ECS + ElastiCache)
resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

# =============================================================================
# SECURITY GROUPS — whitelist-only firewall rules
# Default VPC security group is never used (deny-all by default).
# We create explicit groups with minimal permissions.
# =============================================================================

# -----------------------------------------------------------------------------
# ALB security group — the load balancer faces the public internet.
# Allows HTTPS (443) and HTTP (80) from anywhere.
# HTTP is only needed to redirect → HTTPS; the redirect listener handles this.
# Everything else (SSH, database ports, etc.) is implicitly denied.
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project}-${var.environment}-alb-sg"
  description = "ALB: allow inbound HTTP/HTTPS from anywhere, all outbound to ECS"
  vpc_id      = aws_vpc.main.id

  # Allow HTTP (port 80) from anywhere — immediately redirected to HTTPS in alb.tf
  ingress {
    description = "HTTP from internet, redirected to HTTPS by ALB listener"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow HTTPS (port 443) from anywhere — actual application traffic
  ingress {
    description = "HTTPS from internet, WAF-filtered traffic to FastAPI"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound from ALB → necessary to forward requests to ECS tasks
  # (to any port on any destination within the VPC)
  egress {
    description = "All outbound. ALB forwards requests to ECS on port 8000"
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # -1 = all protocols
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-alb-sg"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ECS security group — the FastAPI containers.
# Only accepts traffic on port 8000 FROM the ALB security group.
# The public internet CANNOT reach ECS directly — only via the ALB.
# This is the primary network isolation guarantee.
# -----------------------------------------------------------------------------
resource "aws_security_group" "ecs" {
  name        = "${var.project}-${var.environment}-ecs-sg"
  description = "ECS tasks: allow port 8000 from ALB only, all outbound for Supabase/SMTP"
  vpc_id      = aws_vpc.main.id

  # Accept FastAPI traffic only from the ALB security group (not from the internet)
  ingress {
    description     = "FastAPI port from ALB security group only, not from internet"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id] # Reference, not CIDR — scales correctly
  }

  # Allow all outbound — needed for:
  #   - Supabase (PostgreSQL TLS on 5432, HTTPS on 443)
  #   - Gmail SMTP (TLS on 587)
  #   - Secrets Manager, ECR, CloudWatch endpoints
  egress {
    description = "All outbound. ECS needs to reach Supabase, Gmail SMTP, AWS services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-ecs-sg"
    Project     = var.project
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# ElastiCache security group — Redis in the private subnet.
# Only accepts connections on port 6379 FROM the ECS security group.
# Cannot be reached from the internet, from the ALB, or from any other source.
# This is VPC-internal Redis — sub-millisecond latency to ECS, zero public exposure.
# -----------------------------------------------------------------------------
resource "aws_security_group" "elasticache" {
  name        = "${var.project}-${var.environment}-redis-sg"
  description = "ElastiCache Redis: allow port 6379 from ECS security group only"
  vpc_id      = aws_vpc.main.id

  # Redis access strictly limited to ECS tasks — nothing else can connect
  ingress {
    description     = "Redis from ECS tasks only, no internet access to Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id] # ECS security group reference
  }

  # No explicit egress needed for Redis — it only responds to ECS requests
  # AWS default: allow all outbound (egress) unless explicitly denied
  egress {
    description = "All outbound. Redis responds to ECS within VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-redis-sg"
    Project     = var.project
    Environment = var.environment
  }
}
