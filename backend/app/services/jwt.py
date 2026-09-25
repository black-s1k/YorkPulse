"""JWT token service for authentication."""

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


SANDBOX_REFRESH_TOKEN_DAYS = 36500  # effectively never expires


class TokenType:
    ACCESS = "access"
    REFRESH = "refresh"
    EMAIL_VERIFICATION = "email_verification"


class JWTService:
    """Service for creating and validating JWT tokens."""

    def __init__(self):
        self.secret_key = settings.jwt_secret_key
        self.algorithm = settings.jwt_algorithm
        self.access_token_expire_minutes = settings.access_token_expire_minutes
        self.refresh_token_expire_days = settings.refresh_token_expire_days

    def create_access_token(self, user_id: str, email: str) -> str:
        """Create a short-lived access token."""
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        payload = {
            "sub": user_id,
            "email": email,
            "type": TokenType.ACCESS,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),  # Unique token ID
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, user_id: str, email: str) -> str:
        """Create a long-lived refresh token.

        Sandbox accounts (the shared AI Ignite club login) stay signed in
        indefinitely: their refresh token is valid for 100 years instead of
        refresh_token_expire_days. Signing out on a device still ends that
        device's session; to cut off every device, deactivate the user (the
        refresh endpoint rejects inactive users).
        """
        days = (
            SANDBOX_REFRESH_TOKEN_DAYS
            if email.lower() in settings.sandbox_email_set
            else self.refresh_token_expire_days
        )
        expire = datetime.now(timezone.utc) + timedelta(days=days)
        payload = {
            "sub": user_id,
            "email": email,
            "type": TokenType.REFRESH,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def create_email_verification_token(self, email: str) -> str:
        """Create a token for email verification (magic link)."""
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        payload = {
            "sub": email,
            "type": TokenType.EMAIL_VERIFICATION,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_access_token(self, token: str) -> dict | None:
        """Verify an access token and return the payload."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            if payload.get("type") != TokenType.ACCESS:
                return None
            return payload
        except JWTError:
            return None

    def verify_refresh_token(self, token: str) -> dict | None:
        """Verify a refresh token and return the payload."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            if payload.get("type") != TokenType.REFRESH:
                return None
            return payload
        except JWTError:
            return None

    def verify_email_token(self, token: str) -> str | None:
        """Verify an email verification token and return the email."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            if payload.get("type") != TokenType.EMAIL_VERIFICATION:
                return None
            return payload.get("sub")
        except JWTError:
            return None

    def create_token_pair(self, user_id: str, email: str) -> tuple[str, str, int]:
        """Create both access and refresh tokens.

        Returns:
            Tuple of (access_token, refresh_token, expires_in_seconds)
        """
        access_token = self.create_access_token(user_id, email)
        refresh_token = self.create_refresh_token(user_id, email)
        expires_in = self.access_token_expire_minutes * 60
        return access_token, refresh_token, expires_in


# Singleton instance
jwt_service = JWTService()
