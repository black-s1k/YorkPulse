"""Vault (anonymous forum) API routes."""

import logging
import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import (
    AdminUser,
    CurrentUser,
    CurrentUserOptional,
    VerifiedUser,
)
from app.models.vault import VaultCategory, VaultComment, VaultPost, VaultPostStatus
from app.schemas.user import UserMinimal
from app.schemas.vault import (
    FlagRequest,
    VaultCommentCreate,
    VaultCommentListResponse,
    VaultCommentResponse,
    VaultPostCreate,
    VaultPostListResponse,
    VaultPostResponse,
    VaultPostUpdate,
)
from app.services.activity import activity_service
from app.services.gemini import gemini_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault", tags=["Vault"])

# Constants
FLAG_THRESHOLD = 5  # Posts hidden after this many flags


def _post_to_response(post: VaultPost, current_user_id: str | None = None) -> VaultPostResponse:
    """Convert post model to response, hiding author if anonymous."""
    author = None
    if not post.is_anonymous:
        author = UserMinimal(
            id=str(post.author.id),
            name=post.author.name,
            avatar_url=post.author.avatar_url,
        )

    return VaultPostResponse(
        id=str(post.id),
        title=post.title,
        content=post.content,
        category=post.category,
        is_anonymous=post.is_anonymous,
        status=post.status,
        comment_count=post.comment_count,
        upvote_count=post.upvote_count,
        flag_count=post.flag_count,
        images=post.images,
        author=author,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _comment_to_response(comment: VaultComment) -> VaultCommentResponse:
    """Convert comment model to response, hiding author if anonymous."""
    author = None
    if not comment.is_anonymous:
        author = UserMinimal(
            id=str(comment.author.id),
            name=comment.author.name,
            avatar_url=comment.author.avatar_url,
        )

    return VaultCommentResponse(
        id=str(comment.id),
        post_id=str(comment.post_id),
        content=comment.content,
        is_anonymous=comment.is_anonymous,
        is_hidden=comment.is_hidden,
        parent_id=str(comment.parent_id) if comment.parent_id else None,
        author=author,
        created_at=comment.created_at,
    )


@router.post("/upload-image-direct")
async def upload_vault_image(
    user: VerifiedUser,
    file: UploadFile = File(...),
):
    """Upload an image directly for a vault post."""
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, and WebP are allowed.",
        )

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB.",
        )

    try:
        public_url = storage_service.upload_file(
            folder="vault",
            filename=file.filename or "image.jpg",
            file_data=content,
            content_type=file.content_type,
        )
        return {"public_url": public_url}
    except Exception as e:
        logger.error("Vault image upload error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image. Please try again.",
        )


@router.get("", response_model=VaultPostListResponse)
async def list_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUserOptional,
    category: VaultCategory | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """List vault posts with optional category filter."""
    query = (
        select(VaultPost)
        .options(selectinload(VaultPost.author))
        .where(VaultPost.status == VaultPostStatus.ACTIVE)
    )

    if category:
        query = query.where(VaultPost.category == category)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(VaultPost.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    posts = result.scalars().all()

    current_user_id = str(user.id) if user else None

    return VaultPostListResponse(
        items=[_post_to_response(p, current_user_id) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.post("", response_model=VaultPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    request: VaultPostCreate,
    background_tasks: BackgroundTasks,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new vault post."""
    # Pre-publish content moderation
    has_pii, pii_types = await gemini_service.check_for_pii(request.content)
    if has_pii:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content contains personal information ({', '.join(pii_types)}). Please remove it.",
        )

    # Check title for PII too
    has_pii, pii_types = await gemini_service.check_for_pii(request.title)
    if has_pii:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title contains personal information. Please remove it.",
        )

    post = VaultPost(
        id=uuid.uuid4(),
        title=request.title,
        content=request.content,
        category=request.category,
        is_anonymous=request.is_anonymous,
        images=request.images,
        user_id=user.id,
    )

    db.add(post)
    await db.commit()
    await db.refresh(post, ["author"])

    # Tracked like every other feature per the activity-tracking feature's
    # scope decision — metadata only (category/length/anonymity flag), never
    # the post content itself.
    await activity_service.emit(
        db,
        user_id=str(user.id),
        session_id=None,
        event_type="vault.post_created",
        category="vault",
        entity_type="vault_post",
        entity_id=str(post.id),
        properties={
            "category": request.category,
            "is_anonymous": request.is_anonymous,
            "content_length": len(request.content),
        },
    )

    from app.services import push_service

    background_tasks.add_task(
        push_service.send_push_broadcast,
        user.id,
        "New post in The Vault",
        request.title[:100],
        "/vault",
    )

    return _post_to_response(post, str(user.id))


@router.get("/{post_id}", response_model=VaultPostResponse)
async def get_post(
    post_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUserOptional,
):
    """Get a single vault post."""
    result = await db.execute(
        select(VaultPost)
        .options(selectinload(VaultPost.author))
        .where(VaultPost.id == post_id)
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status == VaultPostStatus.DELETED:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status == VaultPostStatus.HIDDEN:
        # Only show to author or admins
        if not user or str(user.id) != str(post.user_id):
            raise HTTPException(status_code=404, detail="Post not found")

    current_user_id = str(user.id) if user else None
    return _post_to_response(post, current_user_id)


@router.patch("/{post_id}", response_model=VaultPostResponse)
async def update_post(
    post_id: str,
    request: VaultPostUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a vault post (author only)."""
    result = await db.execute(
        select(VaultPost)
        .options(selectinload(VaultPost.author))
        .where(VaultPost.id == post_id)
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if str(post.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if request.title is not None:
        post.title = request.title
    if request.content is not None:
        post.content = request.content
    if request.category is not None:
        post.category = request.category

    await db.commit()
    await db.refresh(post)

    return _post_to_response(post, str(user.id))


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a vault post (author only)."""
    result = await db.execute(
        select(VaultPost).where(VaultPost.id == post_id)
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if str(post.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    post.status = VaultPostStatus.DELETED
    await db.commit()


@router.post("/{post_id}/flag", status_code=status.HTTP_204_NO_CONTENT)
async def flag_post(
    post_id: str,
    request: FlagRequest,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Flag a post for moderation."""
    result = await db.execute(
        select(VaultPost).where(VaultPost.id == post_id)
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Increment flag count
    post.flag_count += 1

    # Auto-hide if threshold reached
    if post.flag_count >= FLAG_THRESHOLD:
        post.status = VaultPostStatus.HIDDEN

    await db.commit()


# Comments endpoints

@router.get("/{post_id}/comments", response_model=VaultCommentListResponse)
async def list_comments(
    post_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUserOptional,
):
    """List comments on a post."""
    # Verify post exists
    post_result = await db.execute(
        select(VaultPost).where(VaultPost.id == post_id)
    )
    if not post_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(
        select(VaultComment)
        .options(selectinload(VaultComment.author))
        .where(VaultComment.post_id == post_id)
        .where(VaultComment.is_hidden == False)
        .order_by(VaultComment.created_at.asc())
    )
    comments = result.scalars().all()

    return VaultCommentListResponse(
        items=[_comment_to_response(c) for c in comments],
        total=len(comments),
    )


@router.post("/{post_id}/comments", response_model=VaultCommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: str,
    request: VaultCommentCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a comment on a post."""
    # Verify post exists and is active
    post_result = await db.execute(
        select(VaultPost).where(VaultPost.id == post_id)
    )
    post = post_result.scalar_one_or_none()

    if not post or post.status != VaultPostStatus.ACTIVE:
        raise HTTPException(status_code=404, detail="Post not found")

    # Verify parent comment if provided
    if request.parent_id:
        parent_result = await db.execute(
            select(VaultComment).where(VaultComment.id == request.parent_id)
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Parent comment not found")

    # Check for PII
    has_pii, _ = await gemini_service.check_for_pii(request.content)
    if has_pii:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment contains personal information. Please remove it.",
        )

    comment = VaultComment(
        id=uuid.uuid4(),
        post_id=uuid.UUID(post_id),
        user_id=user.id,
        content=request.content,
        is_anonymous=request.is_anonymous,
        parent_id=uuid.UUID(request.parent_id) if request.parent_id else None,
    )

    db.add(comment)

    # Update comment count on post
    post.comment_count += 1

    await db.commit()
    await db.refresh(comment, ["author"])

    return _comment_to_response(comment)


@router.delete("/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    post_id: str,
    comment_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a comment (author only)."""
    result = await db.execute(
        select(VaultComment)
        .where(VaultComment.id == comment_id)
        .where(VaultComment.post_id == post_id)
    )
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if str(comment.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Soft delete by hiding
    comment.is_hidden = True

    # Update comment count on post
    post_result = await db.execute(
        select(VaultPost).where(VaultPost.id == post_id)
    )
    post = post_result.scalar_one_or_none()
    if post:
        post.comment_count = max(0, post.comment_count - 1)

    await db.commit()


# --- Admin endpoints ---


@router.get("/admin/posts")
async def admin_list_posts(
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
):
    """List all vault posts including deleted (admin only)."""
    query = (
        select(VaultPost)
        .options(selectinload(VaultPost.author))
        .order_by(VaultPost.created_at.desc())
    )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    posts = result.scalars().all()

    return {
        "items": [
            {
                "id": str(p.id),
                "title": p.title,
                "category": p.category,
                "status": p.status,
                "is_anonymous": p.is_anonymous,
                "flag_count": p.flag_count,
                "author": (
                    {"id": str(p.author.id), "name": p.author.name}
                    if p.author
                    else None
                ),
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in posts
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (page * per_page) < total,
    }


@router.get("/admin/posts/{post_id}/comments")
async def admin_list_comments(
    post_id: str,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all comments for a post with real author names (admin only)."""
    result = await db.execute(
        select(VaultComment)
        .options(selectinload(VaultComment.author))
        .where(VaultComment.post_id == post_id)
        .order_by(VaultComment.created_at.asc())
    )
    comments = result.scalars().all()

    return {
        "items": [
            {
                "id": str(c.id),
                "content": c.content,
                "is_anonymous": c.is_anonymous,
                "is_hidden": c.is_hidden,
                "author": {"id": str(c.author.id), "name": c.author.name} if c.author else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in comments
        ],
        "total": len(comments),
    }


@router.delete("/admin/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_post(
    post_id: str,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Force-delete any vault post (admin only)."""
    result = await db.execute(select(VaultPost).where(VaultPost.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = VaultPostStatus.DELETED
    await db.commit()
