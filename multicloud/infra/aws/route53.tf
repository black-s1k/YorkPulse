# =============================================================================
# route53.tf — DNS records for yorkpulse.com in the existing Route 53 hosted zone
#
# The hosted zone (Z01059542TIO3YH228MAS) was created via AWS CLI already.
# This file manages ALL DNS records for yorkpulse.com inside that zone.
#
# Record overview:
#   TLS          → ACM validation CNAME + certificate_validation resource
#   Email (send) → Brevo DKIM CNAMEs, Resend DKIM TXT, DMARC TXT, Brevo verify TXT
#   Email (recv) → send.yorkpulse.com MX + SPF TXT (SES bounce handling)
#   Trust        → CAA records for root + api subdomain
#   Frontend     → Vercel A + www CNAME (Vercel frontend stays live)
#   Backend      → api.yorkpulse.com A record (placeholder → updated to ALB after apply)
#
# IMPORTANT: After terraform apply, update nameservers at your registrar (Name.com)
# to the four Route 53 nameservers in the route53_nameservers output.
# =============================================================================

# -----------------------------------------------------------------------------
# Data source — reference the existing hosted zone by Zone ID.
# Using zone_id (not name) avoids any ambiguity if multiple zones exist
# for the same domain name (e.g. private + public zones).
# DO NOT create a new zone — this data source only reads the existing one.
# -----------------------------------------------------------------------------
data "aws_route53_zone" "main" {
  zone_id = "Z01059542TIO3YH228MAS"
}

# =============================================================================
# TLS — ACM certificate validation record
# =============================================================================

# -----------------------------------------------------------------------------
# ACM validation CNAME — proves to Amazon Certificate Manager that you own
# api.yorkpulse.com. ACM checks for this exact CNAME before issuing the TLS
# certificate. Once the certificate is issued, this record can be removed —
# but it's harmless to keep it (ACM re-checks periodically on renewal).
#
# Name:  _90a2fc71747c0a0a8c6057d31a90f714.api.yorkpulse.com
# Value: _00dab0abeaaee6288e2a2ef0ed858e32.jkddzztszm.acm-validations.aws
# -----------------------------------------------------------------------------
resource "aws_route53_record" "acm_validation" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_90a2fc71747c0a0a8c6057d31a90f714.api.yorkpulse.com"
  type    = "CNAME"
  ttl     = 300 # 5 minutes — standard for ACM validation records

  records = ["_00dab0abeaaee6288e2a2ef0ed858e32.jkddzztszm.acm-validations.aws"]
}

# -----------------------------------------------------------------------------
# ACM certificate validation resource — tells Terraform to WAIT until ACM has
# verified the CNAME above and issued the certificate before proceeding.
# Without this, the ALB HTTPS listener (alb.tf) would reference a certificate
# that isn't issued yet and terraform apply would fail.
#
# certificate_arn: the ACM certificate created manually in AWS Console.
# validation_record_fqdns: the CNAME record above — Terraform confirms it exists
# before declaring the certificate validated.
#
# FILL IN: Replace PASTE_ISSUED_CERT_ARN with your actual certificate ARN.
# Find it in: AWS Console → Certificate Manager → api.yorkpulse.com → ARN
# Format: arn:aws:acm:us-east-1:062677866920:certificate/<uuid>
# -----------------------------------------------------------------------------
resource "aws_acm_certificate_validation" "api" {
  certificate_arn = "arn:aws:acm:us-east-1:062677866920:certificate/0a247673-6f02-45d8-b896-ec71ebd676de"

  # Tell Terraform which DNS record proves ownership — must match the CNAME above.
  # Terraform polls ACM every 10 seconds until "Issued" status, then continues.
  validation_record_fqdns = [aws_route53_record.acm_validation.fqdn]
}

# =============================================================================
# EMAIL — Brevo DKIM (enables DKIM signing on emails sent via Brevo)
# =============================================================================

# -----------------------------------------------------------------------------
# Brevo DKIM record 1 — DKIM key selector "brevo1".
# DKIM allows receiving mail servers to verify that emails claiming to be from
# @yorkpulse.com were actually sent through Brevo's authorised servers.
# Without this, emails may land in spam or be rejected outright.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "brevo_dkim1" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "brevo1._domainkey.yorkpulse.com"
  type    = "CNAME"
  ttl     = 3600 # 1 hour — DKIM records don't change, high TTL reduces DNS query load

  records = ["b1.yorkpulse-com.dkim.brevo.com"]
}

# -----------------------------------------------------------------------------
# Brevo DKIM record 2 — DKIM key selector "brevo2".
# Brevo uses two DKIM selectors for key rotation — both must be present
# for 100% DKIM coverage. If brevo1 is being rotated, brevo2 is active, and vice versa.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "brevo_dkim2" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "brevo2._domainkey.yorkpulse.com"
  type    = "CNAME"
  ttl     = 3600

  records = ["b2.yorkpulse-com.dkim.brevo.com"]
}

# =============================================================================
# EMAIL — Resend DKIM (enables DKIM signing for emails sent via Resend)
# =============================================================================

# -----------------------------------------------------------------------------
# Resend DKIM TXT record — Resend uses a TXT-format DKIM public key (not CNAME).
# The p= field is the RSA public key that receiving servers use to verify
# that the email signature was created by Resend's private key.
# This record enables DKIM for any emails sent via the Resend service.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "resend_dkim" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "resend._domainkey.yorkpulse.com"
  type    = "TXT"
  ttl     = 3600

  records = [
    "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC/K/bzAZPiqBMSTPi+moGARgj1EKSe6R5B+QMHolgqWxnB++Qxz8nTnxMbf50k0pSO1G+7ptmrMPzMfN+EhusOn3IlwEBwQKN1EYmWszh6u+GF4ISUJY5J2I8vdfscdYGkBrHp9n2dbZ9xNq8bs8STSY4oifoRBQyVQIZ1RvKwCwIDAQAB"
  ]
}

# =============================================================================
# EMAIL — DMARC policy (tells receiving servers what to do with failing emails)
# =============================================================================

# -----------------------------------------------------------------------------
# DMARC TXT record — Domain-based Message Authentication, Reporting & Conformance.
# p=none: monitor-only mode — don't reject failing emails yet, just collect reports.
# rua=mailto:rua@dmarc.brevo.com: send aggregate reports to Brevo's DMARC inbox.
# After reviewing reports and confirming DKIM/SPF pass rates, graduate to:
#   p=quarantine (send to spam) → p=reject (block outright)
# Starting at p=none is the safe approach — prevents legitimate emails being blocked
# if DKIM or SPF has a misconfiguration during initial setup.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_dmarc.yorkpulse.com"
  type    = "TXT"
  ttl     = 3600

  records = ["v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"]
}

# =============================================================================
# EMAIL — Brevo domain verification (TXT on root domain)
# =============================================================================

# -----------------------------------------------------------------------------
# Brevo ownership verification TXT — Brevo requires this record to confirm
# you own the domain before allowing you to send email on its behalf.
# This is a one-time verification record; it does not affect email delivery
# once verified but should be kept in place (Brevo re-checks periodically).
# Placed on the root domain (@) — i.e. yorkpulse.com itself.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "brevo_verify" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "yorkpulse.com" # Root domain — equivalent to "@" in a zone file
  type    = "TXT"
  ttl     = 3600

  records = ["brevo-code:4212a1137e2c7761a299a315c0f061c9"]
}

# =============================================================================
# EMAIL — send.yorkpulse.com SPF + MX (Amazon SES bounce handling)
# =============================================================================

# -----------------------------------------------------------------------------
# send.yorkpulse.com SPF TXT record — Sender Policy Framework.
# Authorises Amazon SES servers to send email from the send.yorkpulse.com subdomain.
# include:amazonses.com expands to Amazon SES's IP ranges.
# ~all = soft fail — emails from unauthorised IPs are flagged but not rejected.
# This subdomain is used for bounce and complaint handling via SES,
# not for user-facing emails (those go through Brevo from yorkpulse.com directly).
# -----------------------------------------------------------------------------
resource "aws_route53_record" "ses_spf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "send.yorkpulse.com"
  type    = "TXT"
  ttl     = 3600

  records = ["v=spf1 include:amazonses.com ~all"]
}

# -----------------------------------------------------------------------------
# send.yorkpulse.com MX record — Mail eXchange for the send subdomain.
# MX 10 feedback-smtp.us-east-1.amazonses.com directs bounce notifications
# (delivery failures, spam complaints) to Amazon SES for processing.
# Priority 10 = primary mail server (lower number = higher priority).
# Without this MX record, SES cannot receive bounce/complaint feedback loops,
# which would cause your SES sending reputation to degrade over time.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "ses_mx" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "send.yorkpulse.com"
  type    = "MX"
  ttl     = 3600

  records = ["10 feedback-smtp.us-east-1.amazonses.com"]
}

# =============================================================================
# TRUST — CAA records (Certification Authority Authorization)
# Prevents any CA other than the listed ones from issuing TLS certificates
# for yorkpulse.com and api.yorkpulse.com. Mitigates certificate misissuance.
# =============================================================================

# -----------------------------------------------------------------------------
# CAA records for root domain yorkpulse.com.
# Authorises four CAs: Amazon (for ACM certs), Let's Encrypt (for any auto-TLS),
# Sectigo (common commercial CA), and Google PKI (for Google Cloud services).
# Any CA NOT in this list cannot issue a certificate for yorkpulse.com —
# even if someone social-engineers the CA with a valid-looking request.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "caa_root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "yorkpulse.com" # Root domain CAA
  type    = "CAA"
  ttl     = 3600

  records = [
    "0 issue \"amazon.com\"",      # AWS Certificate Manager (ACM)
    "0 issue \"letsencrypt.org\"", # Let's Encrypt (used by Vercel, Render, etc.)
    "0 issue \"sectigo.com\"",     # Sectigo (common commercial CA)
    "0 issue \"pki.goog\"",        # Google Trust Services (Google Cloud)
  ]
}

# -----------------------------------------------------------------------------
# CAA records for api.yorkpulse.com subdomain.
# Same four CAs authorised — must be explicitly listed for the subdomain
# because CAA records are NOT automatically inherited by subdomains in all
# validation implementations. Explicit is always safer.
# api.yorkpulse.com uses ACM (amazon.com) for its TLS certificate on the ALB.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "caa_api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.yorkpulse.com"
  type    = "CAA"
  ttl     = 3600

  records = [
    "0 issue \"amazon.com\"",      # AWS Certificate Manager (ACM) — active cert is here
    "0 issue \"letsencrypt.org\"", # Let's Encrypt — future flexibility
    "0 issue \"sectigo.com\"",     # Sectigo
    "0 issue \"pki.goog\"",        # Google Trust Services
  ]
}

# =============================================================================
# FRONTEND — Vercel records (keep the Next.js frontend live during migration)
# These records preserve the existing Vercel deployment.
# The frontend (yorkpulse.com) stays on Vercel — only the backend moves to AWS.
# =============================================================================

# -----------------------------------------------------------------------------
# Root domain A record → Vercel IP.
# Vercel's primary Anycast IP is 76.76.21.21 — routes to the nearest Vercel edge node.
# This keeps the Next.js frontend (Vercel) accessible at https://yorkpulse.com
# during and after the DNS migration to Route 53.
# NOTE: Route 53 does not support ALIAS records for non-AWS targets on root domains.
# Using a single A record to Vercel's Anycast IP is the correct approach here.
# Vercel's Anycast IP is stable — documented at vercel.com/docs/concepts/edge-network
# -----------------------------------------------------------------------------
resource "aws_route53_record" "root_a" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "yorkpulse.com" # Root domain — the Vercel frontend
  type    = "A"
  ttl     = 300 # 5 minutes — allows faster cutover if Vercel IP ever changes

  records = ["76.76.21.21"] # Vercel Anycast IP
}

# -----------------------------------------------------------------------------
# www CNAME → Vercel.
# cname.vercel-dns-017.com is the Vercel-assigned CNAME target for custom domains.
# This keeps https://www.yorkpulse.com working and redirecting to yorkpulse.com
# via Vercel's built-in www→apex redirect.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "www_cname" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.yorkpulse.com"
  type    = "CNAME"
  ttl     = 300

  records = ["cname.vercel-dns-017.com"]
}

# =============================================================================
# BACKEND — api.yorkpulse.com A record (placeholder until ALB is created)
# =============================================================================

# -----------------------------------------------------------------------------
# api subdomain A record — placeholder IP until the ALB is created.
# After "terraform apply" creates the ALB, run:
#   terraform output alb_dns_name
# Then update this record to a CNAME pointing to the ALB DNS name:
#   type    = "CNAME"
#   records = [aws_lb.main.dns_name]
#   ttl     = 60
# OR use an ALB alias record (see below) for zero-TTL instant failover.
#
# Why not CNAME the ALB directly now?
#   The ALB does not exist yet (ECS service depends on secrets being filled first).
#   A placeholder prevents NXDOMAIN responses (domain not found) for api.yorkpulse.com
#   which would break any cached DNS lookups during setup.
# Low TTL of 60 seconds means the update propagates quickly once the ALB is ready.
# -----------------------------------------------------------------------------
resource "aws_route53_record" "api_placeholder" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.yorkpulse.com"
  type    = "A"
  ttl     = 60 # Low TTL — easy to update quickly once ALB is ready

  # Placeholder loopback IP — returns immediately with ICMP unreachable.
  # Much better than NXDOMAIN: frontend CORS errors vs connection refused.
  # Replace with ALB alias record after terraform apply creates the ALB.
  records = ["127.0.0.1"]

  lifecycle {
    # Do NOT let Terraform revert this record to 127.0.0.1 after you update it
    # manually to the ALB. Remove this ignore_changes block once you've switched
    # to the ALB alias record approach below.
    ignore_changes = [records, ttl, type]
  }
}

# =============================================================================
# ALB ALIAS RECORD (commented out — uncomment AFTER terraform apply)
#
# Once the ALB exists (after a successful terraform apply with secrets filled),
# replace aws_route53_record.api_placeholder above with this alias record.
# Route 53 alias records for ALBs are free (no per-query charge) and support
# health-based routing — if the ALB is unhealthy, Route 53 stops resolving it.
#
# Steps to switch:
#   1. Comment out / remove aws_route53_record.api_placeholder above
#   2. Uncomment this block
#   3. Run: terraform apply
# =============================================================================
# resource "aws_route53_record" "api_alb" {
#   zone_id = data.aws_route53_zone.main.zone_id
#   name    = "api.yorkpulse.com"
#   type    = "A"
#
#   alias {
#     name                   = aws_lb.main.dns_name
#     zone_id                = aws_lb.main.zone_id  # ALB's Route 53 hosted zone (not our zone)
#     evaluate_target_health = true  # Route 53 won't resolve if ALB health checks are failing
#   }
# }
