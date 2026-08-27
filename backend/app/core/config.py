from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "YorkPulse API"
    debug: bool = False
    allow_test_emails: bool = False  # Set to True to allow non-York emails for testing
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/yorkpulse"
    db_password: str = ""

    # Redis (Upstash — set UPSTASH_REDIS_URL in Render dashboard)
    # Restore note: old AWS ElastiCache endpoint was
    #   master.yorkpulse-prod-redis.qqbkxu.use1.cache.amazonaws.com:6379
    #   (TLS, auth token stored in Secrets Manager as /yorkpulse/prod/redis-auth-token)
    upstash_redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    refresh_token_expire_days: int = 30     # 1 month — reduces OTP email frequency

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "yorkpulse-uploads"

    # Gemini AI
    gemini_api_key: str = ""

    # Resend (Email) - Legacy, kept for backwards compatibility
    resend_api_key: str = ""

    # SMTP (Gmail)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    admin_email: str = ""  # Admin email for failure alerts
    admin_emails: str = "yorkpulse.app@gmail.com"  # Comma-separated emails that bypass York validation
    admin_password: str = ""  # Password for admin account (bypasses OTP)

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://yorkpulse.com",
        "https://www.yorkpulse.com",
    ]

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = "yorkpulse.app@gmail.com"

    # Rate Limiting
    rate_limit_requests: int = 30              # General endpoints: 30 req / 60s per IP
    rate_limit_window_seconds: int = 60
    rate_limit_auth_requests: int = 5          # Auth per-email: 5 req / 60s (brute-force guard)
    rate_limit_auth_ip_requests: int = 30      # Auth per-IP: 30 req / 60s (campus shared IPs)
    rate_limit_auth_window_seconds: int = 60
    rate_limit_whitelist_ips: str = ""         # Comma-separated IPs exempt from all rate limits
    blocked_ips: str = ""                      # Comma-separated IPs permanently blocked (403)

    # Global (sitewide) auth rate limits — count ALL requests to the endpoint
    # class combined, with no per-IP or per-email dimension. This is what
    # actually stops a botnet: rotating through thousands of source IPs (or
    # generating a fresh fake email each time) raises none of the per-IP or
    # per-email counters above, but every request still adds to this one
    # shared counter.
    #
    # The OTP-send bucket (signup/login/resend-otp) uses TWO windows, not
    # one: a single short window lets a "patient" attacker sit exactly at
    # the threshold indefinitely — 10 req/10s sustained is still 3,600/hour,
    # which blows past a Gmail account's ~500/day quota in under 10 minutes
    # despite technically respecting the limit. The hourly cap is the one
    # that actually protects the mailbox; the burst cap only smooths spikes.
    rate_limit_global_otp_burst_requests: int = 10
    rate_limit_global_otp_burst_window_seconds: int = 10     # → max 60/min burst
    rate_limit_global_otp_hourly_requests: int = 80
    rate_limit_global_otp_hourly_window_seconds: int = 3600  # → max 80/hour sustained, sitewide

    rate_limit_global_auth_requests: int = 60        # verify-otp+admin-login combined
    rate_limit_global_auth_window_seconds: int = 10  # → max 360/min sitewide (no email send, higher ceiling)

    # Hard ceiling on real emails actually SENT (not requests attempted),
    # sitewide, over a rolling ~24h period. The true backstop: it protects
    # Gmail's send quota directly, so nothing upstream evading the request
    # rate limits (IP rotation, fresh fake emails) can starve it. Default is
    # safely under a plain Gmail account's ~500/day limit — raise this if/
    # when this moves to Workspace (2000/day) or a transactional provider.
    otp_daily_email_budget: int = 350

    # Auto-block: an IP that trips any auth rate limit this many times within
    # the violation window gets hard-blocked (fast-path 403, no further
    # checks) for auto_block_duration_seconds. Makes IP rotation costly —
    # each burner IP only gets a few tries before it's benched.
    auth_violation_threshold: int = 3
    auth_violation_window_seconds: int = 600   # 10 minutes
    auto_block_duration_seconds: int = 900     # 15 minutes


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
