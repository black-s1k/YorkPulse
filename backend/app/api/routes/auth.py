"""Authentication API routes."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File

logger = logging.getLogger(__name__)
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import AdminUser, CurrentUser
from app.models.user import User
from app.schemas.auth import (
    ADMIN_EMAILS,
    AdminLoginRequest,
    AvatarUploadRequest,
    AvatarUploadResponse,
    IDUploadRequest,
    IDUploadResponse,
    IDVerificationRequest,
    IDVerificationResponse,
    LoginRequest,
    NameVerificationRequest,
    NameVerificationResponse,
    OTPResponse,
    ProfileUpdateRequest,
    PublicUserResponse,
    RefreshTokenRequest,
    ResendOTPRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    VerifyOTPRequest,
)
from app.models.signup_attempt import SignupAttempt
from app.services.email_validation import email_validation_service
from app.services.gemini import gemini_service
from app.services.jwt import jwt_service
from app.services.redis import redis_service
from app.services.storage import storage_service
from app.services.supabase import supabase_auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-process fallback for per-email OTP send rate limiting (when Redis is unavailable)
# key: email → last send timestamp
import time as _time
_otp_send_times: dict[str, float] = {}
OTP_SEND_COOLDOWN = 60  # seconds between OTP sends per email

async def _check_otp_send_rate_limit(email: str) -> None:
    """Raise 429 if this email has received an OTP in the last 60 seconds."""
    key = f"otp_send_cooldown:{email.lower()}"
    try:
        existing = await redis_service.get(key)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait 60 seconds before requesting another code.",
            )
        await redis_service.set(key, "1", expire_seconds=OTP_SEND_COOLDOWN)
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable — use in-process fallback
        now = _time.time()
        last = _otp_send_times.get(email.lower(), 0)
        if now - last < OTP_SEND_COOLDOWN:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait 60 seconds before requesting another code.",
            )
        _otp_send_times[email.lower()] = now


@router.post("/signup", response_model=SignupResponse)
async def signup(
    request: SignupRequest,
    http_request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Register a new user with York University email.

    1. Validates email is @yorku.ca or @my.yorku.ca
    2. Checks if email already exists and is verified
    3. Sends OTP verification email via Supabase (or locally if dev_mode)
    """
    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else "unknown")
    logger.info("SIGNUP attempt: email=%s ip=%s", request.email, real_ip)

    # Honeypot: a hidden field real users never see or fill in. Simple
    # scripted bots that blindly fill every form field (including hidden
    # ones) trip this. Return an identical-looking success response so
    # detection isn't revealed, but skip the DB writes and OTP email
    # entirely — costs us nothing and doesn't leak an oracle for telling
    # real accounts from fake ones.
    if request.hp:
        logger.warning("SIGNUP HONEYPOT TRIPPED: ip=%s", real_ip)
        return SignupResponse(message="Verification code sent to your email", email=request.email)

    # Check if user already exists and is verified
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()

    if existing_user and existing_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please login instead.",
        )

    # Log this attempt before rate limiting (captures attacker IPs even on blocked requests)
    was_blocked = False
    try:
        await _check_otp_send_rate_limit(request.email)
    except HTTPException:
        was_blocked = True
        raise
    finally:
        try:
            db.add(SignupAttempt(email=request.email, ip_address=real_ip, was_blocked=was_blocked))
            await db.commit()
        except Exception:
            pass  # Never let logging failure break the signup flow

    # Send OTP via Supabase (or locally if dev_mode)
    success, message = await supabase_auth_service.send_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    return SignupResponse(
        message=message,  # In dev mode, this includes the OTP
        email=request.email,
    )


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    request: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify email using magic link token.

    Returns JWT tokens on successful verification.
    """
    email = jwt_service.verify_email_token(request.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    # Find user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Mark email as verified
    user.email_verified = True
    await db.commit()

    # Generate tokens
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return VerifyEmailResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        requires_name_verification=not user.name_verified,
    )


@router.post("/login", response_model=SignupResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Request login OTP code.

    Sends a 6-digit OTP code to the user's email for passwordless login.
    If dev_mode=True, generates a local OTP instead of sending email.
    """
    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else "unknown")
    logger.info("LOGIN attempt: email=%s ip=%s", request.email, real_ip)

    if request.hp:
        logger.warning("LOGIN HONEYPOT TRIPPED: ip=%s", real_ip)
        return SignupResponse(message="Verification code sent to your email", email=request.email)

    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # For login, we check if user exists in our DB
    # But we still send OTP for both new and existing users
    # The verify-otp endpoint will handle user creation/login

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found for this email. Please sign up first.",
        )

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is banned",
        )

    await _check_otp_send_rate_limit(request.email)

    # Send OTP via Supabase (or locally if dev_mode)
    success, message = await supabase_auth_service.send_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    return SignupResponse(
        message=message,  # In dev mode, this includes the OTP
        email=request.email,
    )


@router.post("/admin-login", response_model=VerifyEmailResponse)
async def admin_login(
    request: AdminLoginRequest,
    http_request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Password-based login for the admin account only.
    Bypasses OTP entirely — no email is sent.
    """
    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else "unknown")
    logger.info("ADMIN LOGIN attempt: email=%s ip=%s", request.email, real_ip)

    # Global (not per-IP) wrong-password lockout — checked before anything
    # else. No Redis TTL is ever set on this key, so it stays tripped until
    # someone manually clears it; Redis being unavailable fails OPEN here
    # (consistent with the rest of the rate limiting) rather than locking
    # out admin login entirely on an unrelated Redis blip.
    try:
        failures = await redis_service.get("admin_login:failures")
    except Exception:
        failures = None
    if failures and int(failures) >= settings.admin_login_max_failed_attempts:
        logger.warning("ADMIN LOGIN: locked out (too many failed attempts), ip=%s", real_ip)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked due to repeated failed attempts.",
        )

    if request.email.lower() not in [e.lower() for e in ADMIN_EMAILS]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised.")

    if not settings.admin_password or request.password != settings.admin_password:
        try:
            new_count = await redis_service.incr("admin_login:failures")
            logger.warning("ADMIN LOGIN: wrong password, ip=%s, failures=%d", real_ip, new_count)
        except Exception:
            logger.warning("ADMIN LOGIN: wrong password, ip=%s (failure count unavailable)", real_ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password.")

    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin account not found.")

    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = real_ip
    await db.commit()

    access_token, refresh_token, expires_in = jwt_service.create_token_pair(str(user.id), user.email)
    logger.info("ADMIN LOGIN success: email=%s ip=%s", request.email, real_ip)

    return VerifyEmailResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        requires_name_verification=not user.name_verified,
    )


@router.post("/verify-otp", response_model=VerifyEmailResponse)
async def verify_otp(
    request: VerifyOTPRequest,
    http_request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify email using 6-digit OTP code.

    Creates user if new, returns JWT tokens on successful verification.
    If dev_mode=True, verifies against local OTP storage.
    """
    # Verify OTP with Supabase (or locally if dev_mode)
    success, message, session_data = await supabase_auth_service.verify_otp(
        request.email, request.code, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    # Find or create user in our database
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user:
        # Create new user
        is_admin = request.email.lower() in ADMIN_EMAILS
        user = User(
            id=uuid.uuid4(),
            email=request.email,
            name="York User",
            email_verified=True,  # Email is now verified via OTP
            name_verified=True,  # Auto-verify all users (simplified flow)
            is_admin=is_admin,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Mark email as verified if not already
        if not user.email_verified:
            user.email_verified = True

    # Track last login time and IP
    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else None)
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = real_ip
    logger.info("LOGIN success: email=%s ip=%s", user.email, real_ip)
    await db.commit()

    # Generate our own JWT tokens (for API auth)
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return VerifyEmailResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        requires_name_verification=not user.name_verified,
    )


@router.post("/resend-otp", response_model=OTPResponse)
async def resend_otp(
    request: ResendOTPRequest,
    http_request: Request,
):
    """
    Resend OTP verification code.

    Rate limited to prevent abuse - client should enforce 60s cooldown.
    If dev_mode=True, generates a local OTP instead of sending email.
    """
    real_ip = getattr(http_request.state, "real_ip", http_request.client.host if http_request.client else "unknown")

    if request.hp:
        logger.warning("RESEND-OTP HONEYPOT TRIPPED: ip=%s", real_ip)
        return OTPResponse(success=True, message="Verification code resent")

    # Require an actual pending verification (set when signup/login sent the
    # first code) before allowing a resend. Without this, resend-otp has no
    # DB lookup and no existing-user check at all — any string shaped like a
    # York email triggers a real send on the first call, making it an open
    # relay for email-bombing regardless of how many source IPs are used.
    # This costs real users nothing: the frontend never calls resend before
    # signup/login already ran.
    if not await redis_service.get(f"otp_pending:{request.email.lower()}"):
        logger.warning("RESEND-OTP WITH NO PENDING SESSION: email=%s ip=%s", request.email, real_ip)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending verification for this email. Please start over.",
        )

    await _check_otp_send_rate_limit(request.email)

    success, message = await supabase_auth_service.resend_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
            if "rate" in message.lower() or "limit" in message.lower()
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    return OTPResponse(
        success=True,
        message=message,  # In dev mode, this includes the OTP
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Refresh access token using refresh token.
    """
    payload = jwt_service.verify_refresh_token(request.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    email = payload.get("email")

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active or user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is no longer valid",
        )

    # Generate new tokens
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/verify-name", response_model=NameVerificationResponse)
async def verify_name(
    request: NameVerificationRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify user's name against email pattern.

    If first name appears in email, auto-verify.
    Otherwise, require ID upload.
    """
    if user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name already verified and cannot be changed",
        )

    # Check if name matches email pattern
    matches, reason = email_validation_service.name_matches_email(
        request.name, user.email
    )

    if matches:
        # Auto-verify
        user.name = request.name
        user.name_verified = True
        await db.commit()

        return NameVerificationResponse(
            name_verified=True,
            requires_id_upload=False,
            message=reason,
        )

    return NameVerificationResponse(
        name_verified=False,
        requires_id_upload=True,
        message=reason,
    )


@router.post("/upload-id", response_model=IDUploadResponse)
async def get_id_upload_url(
    request: IDUploadRequest,
    user: CurrentUser,
):
    """
    Get presigned URL to upload student ID photo.

    Returns a URL that the client can PUT the image to directly.
    """
    if user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name already verified",
        )

    try:
        upload_url, file_path, public_url = storage_service.generate_upload_url(
            folder="student-ids",
            filename=request.filename,
            content_type=request.content_type,
            expires_in=300,  # 5 minutes
        )

        return IDUploadResponse(
            upload_url=upload_url,
            file_key=file_path,  # Use file_path as file_key for compatibility
            expires_in=300,
        )
    except ValueError as e:
        logger.error("ID upload error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process request. Please try again.",
        )


@router.post("/verify-id", response_model=IDVerificationResponse)
async def verify_student_id(
    request: IDVerificationRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify uploaded student ID using Gemini Vision.

    Extracts name from ID and sets it as the user's verified name.
    """
    if user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name already verified",
        )

    # Get URL for the uploaded image
    try:
        image_url = storage_service.get_public_url("student-ids", request.file_key)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to access uploaded file",
        )

    # Extract name using Gemini
    success, extracted_name, message = await gemini_service.extract_name_from_id(
        image_url
    )

    if not success or not extracted_name:
        return IDVerificationResponse(
            success=False,
            extracted_name=None,
            message=message,
        )

    # Set verified name
    user.name = extracted_name
    user.name_verified = True
    await db.commit()

    # Delete the ID image for privacy
    storage_service.delete_file("student-ids", request.file_key)

    return IDVerificationResponse(
        success=True,
        extracted_name=extracted_name,
        message="Name verified successfully",
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(user: CurrentUser):
    """Get current user's profile."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        name_verified=user.name_verified,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
        is_founder=user.is_founder,
        program=user.program,
        bio=user.bio,
        avatar_url=user.avatar_url,
        campus_days=user.campus_days,
        interests=user.interests,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update current user's profile."""
    if request.name is not None:
        user.name = request.name.strip()
    if request.program is not None:
        user.program = request.program
    if request.bio is not None:
        user.bio = request.bio
    if request.avatar_url is not None:
        user.avatar_url = request.avatar_url
    if request.campus_days is not None:
        user.campus_days = request.campus_days
    if request.interests is not None:
        user.interests = request.interests

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        name_verified=user.name_verified,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
        is_founder=user.is_founder,
        program=user.program,
        bio=user.bio,
        avatar_url=user.avatar_url,
        campus_days=user.campus_days,
        interests=user.interests,
    )


@router.post("/avatar-upload", response_model=AvatarUploadResponse)
async def get_avatar_upload_url(
    request: AvatarUploadRequest,
    user: CurrentUser,
):
    """Get a presigned URL for uploading an avatar image."""
    try:
        upload_url, file_path, file_url = storage_service.generate_upload_url(
            folder="avatars",
            filename=request.filename,
            content_type=request.content_type,
            expires_in=300,  # 5 minutes
        )

        return AvatarUploadResponse(
            upload_url=upload_url,
            file_url=file_url,
            expires_in=300,
        )
    except ValueError as e:
        logger.error("Avatar upload URL error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Upload service unavailable. Please try again.",
        )


@router.post("/avatar-upload-direct")
async def upload_avatar_direct(
    user: CurrentUser,
    file: UploadFile = File(...),
):
    """Upload an avatar image directly through the backend."""
    # Validate content type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
        )

    # Validate file size (max 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB.",
        )

    try:
        # Upload directly to Supabase Storage
        public_url = storage_service.upload_file(
            folder="avatars",
            filename=file.filename or "avatar.jpg",
            file_data=content,
            content_type=file.content_type,
        )

        return {"file_url": public_url}
    except Exception as e:
        logger.error("Avatar direct upload error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar. Please try again.",
        )


@router.get("/users/{user_id}", response_model=PublicUserResponse)
async def get_public_profile(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a user's public profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return PublicUserResponse(
        id=str(user.id),
        name=user.name,
        name_verified=user.name_verified,
        is_founder=user.is_founder,
        program=user.program,
        bio=user.bio,
        avatar_url=user.avatar_url,
        interests=user.interests,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


# --- Admin endpoints ---


@router.get("/admin/users")
async def admin_list_users(
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
    search: Annotated[str | None, Query(max_length=100)] = None,
    sort_by: Annotated[str, Query()] = "last_login",
):
    """List all users (admin only). sort_by=last_login|created"""
    query = select(User)

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(User.name.ilike(term), User.email.ilike(term))
        )

    if sort_by == "created":
        query = query.order_by(User.created_at.desc())
    else:
        query = query.order_by(User.last_login_at.desc().nulls_last(), User.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "items": [
            {
                "id": str(u.id),
                "name": u.name,
                "email": u.email,
                "is_admin": u.is_admin,
                "is_banned": u.is_banned,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "last_login_ip": u.last_login_ip,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (page * per_page) < total,
    }


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: str,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Hard delete a user (admin only)."""
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if target_uuid == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == target_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()


@router.post("/admin/seed-otp")
async def admin_seed_otp(
    email: str,
    otp: str,
    _: AdminUser,
):
    """Admin only: manually seed a specific OTP into Redis for a given email (testing)."""
    from app.services.redis import redis_service
    await redis_service.set(f"otp:{email.lower()}", otp, expire_seconds=86400)
    return {"message": f"OTP seeded for {email}"}


@router.get("/admin/signup-attempts")
async def admin_list_signup_attempts(
    _: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    ip: str | None = Query(None),
):
    """Admin only: list signup attempts for forensic IP tracking."""
    query = select(SignupAttempt).order_by(SignupAttempt.attempted_at.desc())
    if ip:
        query = query.where(SignupAttempt.ip_address == ip)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    items_result = await db.execute(query.offset((page - 1) * per_page).limit(per_page))
    items = items_result.scalars().all()

    return {
        "items": [
            {
                "id": str(a.id),
                "email": a.email,
                "ip_address": a.ip_address,
                "attempted_at": a.attempted_at.isoformat() if a.attempted_at else None,
                "was_blocked": a.was_blocked,
            }
            for a in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (page * per_page) < total,
    }
