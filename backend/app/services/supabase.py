"""Supabase Auth service for OTP verification."""

import logging
import secrets
import string

from supabase import create_client, Client
from supabase_auth.errors import AuthApiError

from app.core.config import settings
from app.services.email import email_service

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 600  # 10 minutes
OTP_MAX_ATTEMPTS = 5
OTP_LOCKOUT_SECONDS = 900  # 15 minutes


async def _send_email_background(email: str, otp: str) -> None:
    """Send email in background — notify admin on failure."""
    try:
        success, message = await email_service.send_otp_email(email, otp)
        if not success:
            logger.error("OTP email failed for %s: %s", email, message)
            await email_service.send_admin_alert(email, message)
    except Exception as e:
        logger.error("Background email send failed for %s: %s", email, e)
        await email_service.send_admin_alert(email, str(e))


def _make_otp_key(email: str) -> str:
    return f"otp:{email.lower()}"

def _make_otp_attempts_key(email: str) -> str:
    return f"otp_attempts:{email.lower()}"

def _make_otp_lockout_key(email: str) -> str:
    return f"otp_lockout:{email.lower()}"

def _make_otp_pending_key(email: str) -> str:
    return f"otp_pending:{email.lower()}"


class SupabaseAuthService:
    """Service for handling Supabase Auth OTP operations."""

    def __init__(self):
        self._client: Client | None = None

    @property
    def client(self) -> Client:
        """Lazy initialization of Supabase client."""
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise ValueError("Supabase URL and key must be configured")
            self._client = create_client(settings.supabase_url, settings.supabase_key)
        return self._client

    def is_configured(self) -> bool:
        """Check if Supabase is properly configured."""
        return bool(settings.supabase_url and settings.supabase_key)

    def _make_otp(self) -> str:
        """Generate a cryptographically random 6-digit OTP code."""
        return ''.join(secrets.choice(string.digits) for _ in range(6))

    async def _store_otp(self, email: str, otp: str) -> None:
        """Persist OTP in Redis with a 10-minute TTL.

        Falls back to in-memory storage if Redis is unavailable.
        """
        from app.services.redis import redis_service
        try:
            await redis_service.set(_make_otp_key(email), otp, expire_seconds=OTP_TTL_SECONDS)
        except Exception as e:
            logger.warning("Redis OTP store failed, using in-memory fallback: %s", e)
            _otps_fallback[email.lower()] = otp

    async def _mark_otp_pending(self, email: str) -> None:
        """
        Record that a real OTP was just sent for this email, so resend-otp
        can require this marker before it's allowed to trigger another send.
        Without this, resend-otp has no DB lookup and no existing-user check
        at all — it's an open relay: any string shaped like a York email
        triggers a real Gmail send on the first call. Gating it behind "a
        signup/login already ran for this email" costs real users nothing
        (the frontend never calls resend before signup/login) and forces an
        attacker back through the fully rate-limited signup/login path.
        """
        from app.services.redis import redis_service
        try:
            await redis_service.set(_make_otp_pending_key(email), "1", expire_seconds=OTP_TTL_SECONDS)
        except Exception as e:
            logger.warning("Failed to set otp_pending marker for %s: %s", email, e)

    async def _check_daily_email_budget(self) -> bool:
        """
        Hard ceiling on real emails actually sent (not requests attempted)
        sitewide, over a rolling ~24h period. This is the true backstop: it
        protects the mailbox's send quota directly, so it can't be starved
        by any combination of rate-limit evasion upstream (IP rotation,
        fresh fake emails each request) — those affect how many requests get
        this far, not how low this ceiling is. Returns False once exhausted.
        """
        from app.services.redis import redis_service
        try:
            count = await redis_service.incr("otp_emails_sent_today")
            if count == 1:
                await redis_service.expire("otp_emails_sent_today", 86400)
            return count <= settings.otp_daily_email_budget
        except Exception:
            return True  # Redis unavailable — fail open, upstream limits still apply

    async def _is_otp_locked_out(self, email: str) -> bool:
        """Return True if the email is currently locked out due to too many failed attempts."""
        from app.services.redis import redis_service
        try:
            return await redis_service.get(_make_otp_lockout_key(email)) is not None
        except Exception:
            return False

    async def _record_failed_attempt(self, email: str) -> None:
        """Increment failed attempt counter; lock out after OTP_MAX_ATTEMPTS failures."""
        from app.services.redis import redis_service
        try:
            key = _make_otp_attempts_key(email)
            count = await redis_service.get(key)
            count = int(count) + 1 if count else 1
            await redis_service.set(key, str(count), expire_seconds=OTP_TTL_SECONDS)
            if count >= OTP_MAX_ATTEMPTS:
                await redis_service.set(_make_otp_lockout_key(email), "1", expire_seconds=OTP_LOCKOUT_SECONDS)
                await redis_service.delete(key)
                logger.warning("OTP lockout triggered for %s after %d failed attempts", email, count)
        except Exception as e:
            logger.warning("Failed to record OTP attempt for %s: %s", email, e)

    async def _clear_otp_attempts(self, email: str) -> None:
        """Clear attempt counter on successful verification."""
        from app.services.redis import redis_service
        try:
            await redis_service.delete(_make_otp_attempts_key(email))
        except Exception:
            pass

    async def _verify_and_consume_otp(self, email: str, code: str) -> bool:
        """Check the submitted code against the stored OTP and delete it on match.

        Enforces brute-force protection: locks out after OTP_MAX_ATTEMPTS failures.
        Tries Redis first, then in-memory fallback.
        """
        from app.services.redis import redis_service

        if await self._is_otp_locked_out(email):
            return False

        key = _make_otp_key(email)

        try:
            stored = await redis_service.get(key)
            if stored is not None:
                if stored == code:
                    await redis_service.delete(key)
                    await self._clear_otp_attempts(email)
                    return True
                await self._record_failed_attempt(email)
                return False
        except Exception as e:
            logger.warning("Redis OTP verify failed, checking in-memory fallback: %s", e)

        # In-memory fallback
        email_lower = email.lower()
        if email_lower in _otps_fallback:
            stored = _otps_fallback[email_lower]
            if stored == code:
                del _otps_fallback[email_lower]
                await self._clear_otp_attempts(email)
                return True

        await self._record_failed_attempt(email)
        return False

    # Test accounts with fixed OTPs — never receive real emails
    _TEST_ACCOUNTS: dict[str, str] = {
        "proftest@yorku.ca": "371649",
        "yorkpulse.app@gmail.com": "102938",
    }

    async def send_otp(self, email: str, force_dev_mode: bool = False) -> tuple[bool, str]:
        """Send OTP code to email.

        Priority:
        1. Test accounts: use fixed OTP, no email sent
        2. Dev mode (only when settings.debug is True): returns OTP in response
        3. SMTP configured: sends OTP via email (stored in Redis for verification)
        4. Fallback: Supabase magic link
        """
        # Fixed OTP for test accounts — works in any environment
        if email.lower() in self._TEST_ACCOUNTS:
            otp = self._TEST_ACCOUNTS[email.lower()]
            await self._store_otp(email, otp)
            await self._mark_otp_pending(email)
            return True, "Verification code sent to your email"

        # Dev mode — only active when the server itself has DEBUG=true.
        if settings.debug and force_dev_mode:
            otp = self._make_otp()
            await self._store_otp(email, otp)
            await self._mark_otp_pending(email)
            return True, f"[DEV MODE] Your verification code is: {otp}"

        # Circuit breaker on the mailbox's real daily send quota — checked
        # once here since every real-send path below funnels through it.
        if not await self._check_daily_email_budget():
            logger.critical("OTP EMAIL DAILY BUDGET EXHAUSTED — refusing further sends until it resets")
            return False, "We're experiencing unusually high volume right now. Please try again in a few hours."

        if email_service.is_configured():
            otp = self._make_otp()
            await self._store_otp(email, otp)
            await self._mark_otp_pending(email)
            # Awaited (not fire-and-forget): on Lambda, the execution environment
            # can freeze the instant this function returns, so a detached
            # asyncio.create_task() here has no guarantee of completing.
            await _send_email_background(email, otp)
            return True, "Verification code sent to your email"

        # Fallback to Supabase magic link
        try:
            self.client.auth.sign_in_with_otp({
                "email": email,
                "options": {"should_create_user": True},
            })
            await self._mark_otp_pending(email)
            return True, "Verification code sent to your email"
        except AuthApiError as e:
            return False, str(e.message)
        except Exception as e:
            return False, f"Failed to send verification code: {str(e)}"

    async def verify_otp(self, email: str, token: str, force_dev_mode: bool = False) -> tuple[bool, str, dict | None]:
        """Verify the submitted OTP code.

        For SMTP-based and dev-mode flows, checks Redis (or in-memory fallback).
        Falls through to Supabase verification for the magic-link fallback path.
        """
        # Dev mode — only when DEBUG=true on the server.
        if settings.debug and force_dev_mode:
            if await self._verify_and_consume_otp(email, token):
                return True, "Email verified successfully", {"dev_mode": True}
            return False, "Invalid or expired verification code.", None

        # SMTP path — OTP was stored in Redis when the email was sent.
        if email_service.is_configured():
            if await self._verify_and_consume_otp(email, token):
                return True, "Email verified successfully", {"verified_via": "smtp"}
            return False, "Invalid or expired verification code.", None

        # Supabase magic-link fallback verification
        try:
            response = self.client.auth.verify_otp({
                "email": email,
                "token": token,
                "type": "email",
            })
            if response.session:
                return True, "Email verified successfully", {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "expires_in": response.session.expires_in,
                }
            return False, "Verification failed", None

        except AuthApiError as e:
            error_msg = str(e.message)
            if "expired" in error_msg.lower():
                return False, "Verification code has expired. Please request a new one.", None
            if "invalid" in error_msg.lower():
                return False, "Invalid verification code. Please check and try again.", None
            return False, error_msg, None
        except Exception as e:
            return False, f"Verification failed: {str(e)}", None

    async def resend_otp(self, email: str, force_dev_mode: bool = False) -> tuple[bool, str]:
        """Resend OTP — overwrites any previously stored code."""
        return await self.send_otp(email, force_dev_mode)


# In-memory fallback used only when Redis is unavailable.
# Not shared across workers; Redis is the authoritative store.
_otps_fallback: dict[str, str] = {}

# Singleton instance
supabase_auth_service = SupabaseAuthService()
