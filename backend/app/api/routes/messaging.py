"""Messaging API routes."""

import logging
import uuid

logger = logging.getLogger(__name__)
from datetime import UTC, datetime
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
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, VerifiedUser
from app.models.messaging import Conversation, ConversationStatus, Message
from app.models.user import User
from app.schemas.messaging import (
    ChatImageUploadRequest,
    ChatImageUploadResponse,
    ConversationCreate,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationResponse,
    MarkReadRequest,
    MessageCreate,
    MessageListResponse,
    MessageReplyInfo,
    MessageResponse,
    ParticipantInfo,
    PendingRequestsResponse,
)
from app.services.activity import activity_service
from app.services.storage import storage_service

router = APIRouter(prefix="/messages", tags=["Messaging"])


@router.get("/unread-count")
async def get_total_unread_count(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get total unread message count across all conversations for the current user."""
    # Get all active conversations for this user
    conversations_result = await db.execute(
        select(Conversation.id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
        .where(Conversation.status == ConversationStatus.ACTIVE)
    )
    conversation_ids = [c for c in conversations_result.scalars().all()]

    if not conversation_ids:
        return {"unread_count": 0}

    # Count unread messages (messages from others that haven't been read)
    unread_result = await db.execute(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id.in_(conversation_ids))
        .where(Message.sender_id != user.id)
        .where(Message.read_at.is_(None))
        .where(Message.is_deleted == False)
    )
    total_unread = unread_result.scalar() or 0

    return {"unread_count": total_unread}


@router.post("/upload-image", response_model=ChatImageUploadResponse)
async def get_chat_image_upload_url(
    request: ChatImageUploadRequest,
    user: VerifiedUser,
):
    """Get a presigned URL for uploading a chat image in DMs."""
    try:
        upload_url, file_path, file_url = storage_service.generate_upload_url(
            folder="chat-images",
            filename=request.filename,
            content_type=request.content_type,
            expires_in=300,  # 5 minutes
        )

        return ChatImageUploadResponse(
            upload_url=upload_url,
            file_url=file_url,
            expires_in=300,
        )
    except ValueError as e:
        logger.error("Message image upload URL error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Upload service unavailable. Please try again.",
        )


@router.post("/upload-image-direct")
async def upload_chat_image_direct(
    user: VerifiedUser,
    file: UploadFile = File(...),
):
    """Upload a chat image directly through the backend."""
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
            folder="chat-images",
            filename=file.filename or "chat-image.jpg",
            file_data=content,
            content_type=file.content_type,
        )

        return {"file_url": public_url}
    except Exception as e:
        logger.error("Message image direct upload error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image. Please try again.",
        )


def _message_to_response(message: Message) -> MessageResponse:
    """Convert message model to response."""
    reply_info = None
    if message.reply_to and not message.reply_to.is_deleted:
        reply_info = MessageReplyInfo(
            id=str(message.reply_to.id),
            sender_id=str(message.reply_to.sender_id),
            content=message.reply_to.content,
            image_url=message.reply_to.image_url,
        )
    return MessageResponse(
        id=str(message.id),
        conversation_id=str(message.conversation_id),
        sender_id=str(message.sender_id),
        content="" if message.is_deleted else message.content,
        image_url=None if message.is_deleted else message.image_url,
        reply_to=reply_info,
        is_deleted=message.is_deleted,
        is_read=message.read_at is not None,
        read_at=message.read_at,
        created_at=message.created_at,
    )


async def _get_conversation_response(
    conv: Conversation,
    current_user_id: uuid.UUID,
    db: AsyncSession,
) -> ConversationResponse:
    """Convert conversation model to response with participants array format."""
    # Build participants list
    participants = [
        ParticipantInfo(
            id=str(conv.user1.id),
            name=conv.user1.name or "Unknown",
            avatar_url=conv.user1.avatar_url,
        ),
        ParticipantInfo(
            id=str(conv.user2.id),
            name=conv.user2.name or "Unknown",
            avatar_url=conv.user2.avatar_url,
        ),
    ]

    # Get last message
    last_msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_message = last_msg_result.scalar_one_or_none()

    # Count unread messages (messages from the other user that haven't been read)
    unread_result = await db.execute(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == conv.id)
        .where(Message.sender_id != current_user_id)
        .where(Message.read_at.is_(None))
    )
    unread_count = unread_result.scalar() or 0

    return ConversationResponse(
        id=str(conv.id),
        participants=participants,
        initiator_id=str(conv.initiated_by),
        status=conv.status,
        last_message=_message_to_response(last_message) if last_message else None,
        last_message_at=last_message.created_at if last_message else None,
        unread_count=unread_count,
        context_type=conv.context_type,
        context_id=str(conv.context_id) if conv.context_id else None,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: ConversationStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """List user's conversations (active ones by default, excluding pending requests from others)."""
    query = (
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
        .where(Conversation.status != ConversationStatus.BLOCKED)
    )

    if status_filter:
        query = query.where(Conversation.status == status_filter)
    else:
        # By default, show active conversations and pending ones initiated by the user
        query = query.where(
            or_(
                Conversation.status == ConversationStatus.ACTIVE,
                and_(
                    Conversation.status == ConversationStatus.PENDING,
                    Conversation.initiated_by == user.id,
                ),
            )
        )

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Conversation.updated_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    conversations = result.scalars().all()

    items = []
    for conv in conversations:
        items.append(await _get_conversation_response(conv, user.id, db))

    return ConversationListResponse(
        items=items,
        total=total,
    )


@router.get("/requests", response_model=PendingRequestsResponse)
async def list_pending_requests(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List pending DM requests (others requesting to message you)."""
    query = (
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
        .where(Conversation.status == ConversationStatus.PENDING)
        .where(Conversation.initiated_by != user.id)
        .order_by(Conversation.created_at.desc())
    )

    result = await db.execute(query)
    conversations = result.scalars().all()

    requests = []
    for conv in conversations:
        requests.append(await _get_conversation_response(conv, user.id, db))

    return PendingRequestsResponse(requests=requests)


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def start_conversation(
    request: ConversationCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a new conversation (send DM request)."""
    recipient_id = uuid.UUID(request.recipient_id)

    if recipient_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Check recipient exists
    recipient_result = await db.execute(select(User).where(User.id == recipient_id))
    recipient = recipient_result.scalar_one_or_none()

    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing conversation (in either direction)
    existing = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(
            or_(
                and_(
                    Conversation.user1_id == user.id,
                    Conversation.user2_id == recipient_id,
                ),
                and_(
                    Conversation.user1_id == recipient_id,
                    Conversation.user2_id == user.id,
                ),
            )
        )
    )
    existing_conv = existing.scalar_one_or_none()

    if existing_conv:
        if existing_conv.status == ConversationStatus.BLOCKED:
            raise HTTPException(status_code=403, detail="Cannot message this user")
        # Return existing conversation
        return await _get_conversation_response(existing_conv, user.id, db)

    # Create new conversation
    conversation = Conversation(
        id=uuid.uuid4(),
        user1_id=user.id,
        user2_id=recipient_id,
        initiated_by=user.id,
        status=ConversationStatus.PENDING,
        context_type=request.context_type,
        context_id=uuid.UUID(request.context_id) if request.context_id else None,
    )

    db.add(conversation)
    await db.flush()

    # Create initial message
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=user.id,
        content=request.initial_message,
    )

    db.add(message)
    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(Conversation.id == conversation.id)
    )
    conversation = result.scalar_one()

    return await _get_conversation_response(conversation, user.id, db)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get conversation details."""
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    response = await _get_conversation_response(conversation, user.id, db)

    return ConversationDetailResponse(
        id=response.id,
        participants=response.participants,
        initiator_id=response.initiator_id,
        status=response.status,
        last_message=response.last_message,
        last_message_at=response.last_message_at,
        unread_count=response.unread_count,
        context_type=response.context_type,
        context_id=response.context_id,
        created_at=response.created_at,
        updated_at=response.updated_at,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def get_messages(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    before: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    """Get messages in a conversation."""
    # Verify access
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = conv_result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status == ConversationStatus.BLOCKED:
        raise HTTPException(status_code=403, detail="Conversation is blocked")

    # Build query for messages with reply_to relationship
    query = (
        select(Message)
        .options(selectinload(Message.reply_to))
        .where(Message.conversation_id == conversation.id)
    )

    # If before cursor provided, get messages before that message
    if before:
        # Get the timestamp of the cursor message
        cursor_result = await db.execute(
            select(Message.created_at).where(Message.id == before)
        )
        cursor_timestamp = cursor_result.scalar_one_or_none()
        if cursor_timestamp:
            query = query.where(Message.created_at < cursor_timestamp)

    # Get messages in descending order (newest first) for pagination
    query = query.order_by(Message.created_at.desc()).limit(limit + 1)

    result = await db.execute(query)
    messages = list(result.scalars().all())

    # Check if there are more messages
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    # Reverse to get chronological order (oldest first)
    messages = list(reversed(messages))

    return MessageListResponse(
        messages=[_message_to_response(m) for m in messages],
        has_more=has_more,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: str,
    request: MessageCreate,
    background_tasks: BackgroundTasks,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a message in a conversation."""
    # Verify access
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = conv_result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status == ConversationStatus.BLOCKED:
        raise HTTPException(status_code=403, detail="Conversation is blocked")

    if conversation.status == ConversationStatus.PENDING:
        # Only initiator can send while pending
        if str(conversation.initiated_by) != str(user.id):
            raise HTTPException(status_code=403, detail="Accept the request first")

    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_id=user.id,
        content=request.content,
        image_url=request.image_url,
        reply_to_id=uuid.UUID(request.reply_to_id) if request.reply_to_id else None,
    )

    db.add(message)

    # Update conversation timestamp
    conversation.updated_at = datetime.now(UTC)

    await db.commit()

    # Refresh and load reply_to relationship
    await db.refresh(message)
    if message.reply_to_id:
        reply_result = await db.execute(
            select(Message).where(Message.id == message.reply_to_id)
        )
        message.reply_to = reply_result.scalar_one_or_none()

    # Metadata only — length/has-attachment/conversation ID, never the
    # message body itself.
    await activity_service.emit(
        db,
        user_id=str(user.id),
        session_id=None,
        event_type="messaging.message_sent",
        category="messaging",
        entity_type="conversation",
        entity_id=str(conversation.id),
        properties={
            "content_length": len(request.content) if request.content else 0,
            "has_image": bool(request.image_url),
            "is_reply": bool(request.reply_to_id),
        },
    )

    # Push notification to recipient
    recipient_id = (
        conversation.user2_id
        if user.id == conversation.user1_id
        else conversation.user1_id
    )
    from app.services import push_service

    background_tasks.add_task(
        push_service.send_push_to_user,
        recipient_id,
        f"New message from {user.name or 'someone'}",
        request.content[:100] if request.content else "Sent an image",
        f"/messages/{conversation_id}",
        conversation_id,
    )

    return _message_to_response(message)


@router.post("/conversations/{conversation_id}/accept", response_model=ConversationResponse)
async def accept_conversation(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept a pending conversation request."""
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status != ConversationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Conversation is not pending")

    if str(conversation.initiated_by) == str(user.id):
        raise HTTPException(status_code=400, detail="Cannot accept your own request")

    conversation.status = ConversationStatus.ACTIVE
    conversation.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(conversation)

    return await _get_conversation_response(conversation, user.id, db)


@router.post("/conversations/{conversation_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_conversation(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Decline and delete a pending conversation request."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status != ConversationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Conversation is not pending")

    if str(conversation.initiated_by) == str(user.id):
        raise HTTPException(status_code=400, detail="Cannot decline your own request")

    # Delete the conversation and its messages
    await db.delete(conversation)
    await db.commit()


@router.post("/conversations/{conversation_id}/block", response_model=dict)
async def block_conversation(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Block a user in a conversation."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.status = ConversationStatus.BLOCKED
    conversation.blocked_by = user.id
    conversation.updated_at = datetime.now(UTC)

    await db.commit()

    return {"message": "User blocked successfully"}


@router.post("/conversations/{conversation_id}/unblock", response_model=ConversationResponse)
async def unblock_conversation(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Unblock a user in a conversation."""
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.status != ConversationStatus.BLOCKED:
        raise HTTPException(status_code=400, detail="Conversation is not blocked")

    if str(conversation.blocked_by) != str(user.id):
        raise HTTPException(status_code=403, detail="Can only unblock if you blocked")

    conversation.status = ConversationStatus.ACTIVE
    conversation.blocked_by = None
    conversation.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(conversation)

    return await _get_conversation_response(conversation, user.id, db)


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_messages_read(
    conversation_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: MarkReadRequest | None = None,
):
    """Mark messages as read."""
    # Verify access
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(
            or_(
                Conversation.user1_id == user.id,
                Conversation.user2_id == user.id,
            )
        )
    )
    if not conv_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = datetime.now(UTC)

    if request and request.message_ids:
        # Mark specific messages
        for msg_id in request.message_ids:
            msg_result = await db.execute(
                select(Message)
                .where(Message.id == msg_id)
                .where(Message.conversation_id == conversation_id)
            )
            msg = msg_result.scalar_one_or_none()
            if msg and str(msg.sender_id) != str(user.id) and msg.read_at is None:
                msg.read_at = now
    else:
        # Mark all unread messages in conversation
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .where(Message.sender_id != user.id)
            .where(Message.read_at.is_(None))
        )
        messages = result.scalars().all()
        for msg in messages:
            msg.read_at = now

    await db.commit()


@router.delete("/conversations/{conversation_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    conversation_id: str,
    message_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete (unsend) a message."""
    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .where(Message.conversation_id == conversation_id)
        .where(Message.sender_id == user.id)
    )
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.is_deleted = True
    message.content = ""
    await db.commit()
