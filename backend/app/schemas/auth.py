"""Authentication schemas."""

import re
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator


def _load_admin_emails() -> set[str]:
    """Load admin emails from config (env var ADMIN_EMAILS, comma-separated)."""
    from app.core.config import settings
    return {e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()}


ADMIN_EMAILS = _load_admin_emails()


def is_valid_email(email: str) -> bool:
    """Check if email is valid (York email or admin exception)."""
    email_lower = email.lower()
    if email_lower in _load_admin_emails():
        return True
    return email_lower.endswith("@yorku.ca") or email_lower.endswith("@my.yorku.ca")


class SignupRequest(BaseModel):
    """Request schema for user signup."""

    email: EmailStr
    dev_mode: bool = False  # If True, use local OTP instead of email
    hp: str = ""  # Honeypot — hidden form field; real users never fill it in

    @field_validator("email")
    @classmethod
    def validate_york_email(cls, v: str) -> str:
        """Ensure email is a York University email or admin exception."""
        email_lower = v.lower()
        if not is_valid_email(email_lower):
            raise ValueError("Must use a York University email (@yorku.ca or @my.yorku.ca)")
        return email_lower


class SignupResponse(BaseModel):
    """Response schema for signup."""

    message: str
    email: str


class VerifyEmailRequest(BaseModel):
    """Request to verify email with magic link token."""

    token: str


class VerifyOTPRequest(BaseModel):
    """Request to verify email with OTP code."""

    email: EmailStr
    code: Annotated[str, Field(min_length=6, max_length=6, pattern=r"^\d{6}$")]
    dev_mode: bool = False  # If True, verify against local OTP

    @field_validator("email")
    @classmethod
    def validate_york_email(cls, v: str) -> str:
        """Ensure email is a York University email or admin exception."""
        email_lower = v.lower()
        if not is_valid_email(email_lower):
            raise ValueError("Must use a York University email")
        return email_lower


class ResendOTPRequest(BaseModel):
    """Request to resend OTP code."""

    email: EmailStr
    dev_mode: bool = False  # If True, generate local OTP
    hp: str = ""  # Honeypot — hidden form field; real users never fill it in

    @field_validator("email")
    @classmethod
    def validate_york_email(cls, v: str) -> str:
        """Ensure email is a York University email or admin exception."""
        email_lower = v.lower()
        if not is_valid_email(email_lower):
            raise ValueError("Must use a York University email")
        return email_lower


class OTPResponse(BaseModel):
    """Response for OTP operations."""

    success: bool
    message: str


class LoginRequest(BaseModel):
    """Request schema for login (OTP)."""

    email: EmailStr
    dev_mode: bool = False  # If True, use local OTP instead of email
    hp: str = ""  # Honeypot — hidden form field; real users never fill it in

    @field_validator("email")
    @classmethod
    def validate_york_email(cls, v: str) -> str:
        """Ensure email is a York University email or admin exception."""
        email_lower = v.lower()
        if not is_valid_email(email_lower):
            raise ValueError("Must use a York University email")
        return email_lower


class AdminLoginRequest(BaseModel):
    """Request schema for admin password login (no OTP)."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response with JWT tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class VerifyEmailResponse(BaseModel):
    """Response for email verification with user info."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    requires_name_verification: bool


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""

    refresh_token: str


class NameVerificationRequest(BaseModel):
    """Request to verify user's name."""

    name: Annotated[str, Field(min_length=2, max_length=100)]

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Clean and validate name."""
        # Remove extra whitespace
        cleaned = " ".join(v.split())
        # Check for valid characters (letters, spaces, hyphens, apostrophes)
        if not re.match(r"^[a-zA-Z\s\-']+$", cleaned):
            raise ValueError("Name can only contain letters, spaces, hyphens, and apostrophes")
        return cleaned


class NameVerificationResponse(BaseModel):
    """Response for name verification."""

    name_verified: bool
    requires_id_upload: bool
    message: str


class IDUploadRequest(BaseModel):
    """Request for presigned URL to upload student ID."""

    filename: str
    content_type: Annotated[str, Field(pattern=r"^image/(jpeg|png|webp)$")]


class IDUploadResponse(BaseModel):
    """Response with presigned upload URL."""

    upload_url: str
    file_key: str
    expires_in: int  # seconds


class IDVerificationRequest(BaseModel):
    """Request to verify uploaded student ID."""

    file_key: str


class IDVerificationResponse(BaseModel):
    """Response for ID verification."""

    success: bool
    extracted_name: str | None = None
    message: str


class UserResponse(BaseModel):
    """Public user response schema."""

    id: str
    email: str
    name: str
    name_verified: bool
    email_verified: bool
    is_admin: bool = False
    is_founder: bool = False
    program: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    campus_days: list[str] | None = None
    interests: list[str] | None = None

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    """Request to update user profile."""

    name: Annotated[str | None, Field(min_length=1, max_length=100)] = None
    program: Annotated[str | None, Field(min_length=3, max_length=200)] = None
    bio: Annotated[str | None, Field(min_length=20, max_length=500)] = None
    avatar_url: Annotated[str | None, Field(max_length=500)] = None
    campus_days: list[str] | None = None
    interests: list[str] | None = None

    @field_validator("program")
    @classmethod
    def validate_program(cls, v: str | None) -> str | None:
        """Validate program is not just whitespace."""
        if v is not None:
            v = v.strip()
            if len(v) < 3:
                raise ValueError("Program must be at least 3 characters")
        return v

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v: str | None) -> str | None:
        """Validate bio is not just whitespace."""
        if v is not None:
            v = v.strip()
            if len(v) < 20:
                raise ValueError("Bio must be at least 20 characters")
        return v


class AvatarUploadRequest(BaseModel):
    """Request for presigned URL to upload avatar."""

    filename: str
    content_type: Annotated[str, Field(pattern=r"^image/(jpeg|png|webp|gif)$")]


class AvatarUploadResponse(BaseModel):
    """Response with presigned upload URL for avatar."""

    upload_url: str
    file_url: str
    expires_in: int  # seconds


class PublicUserResponse(BaseModel):
    """Public user profile response (for viewing other users)."""

    id: str
    name: str
    name_verified: bool
    is_founder: bool = False
    program: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    interests: list[str] | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True

    @field_validator("interests")
    @classmethod
    def validate_interests(cls, v: list[str] | None) -> list[str] | None:
        """Validate interests (max 10)."""
        if v is None:
            return None
        if len(v) > 10:
            raise ValueError("Maximum 10 interests allowed")
        return [interest.strip()[:50] for interest in v]
