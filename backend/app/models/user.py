from decimal import Decimal

from datetime import datetime

from sqlalchemy import String, Boolean, ARRAY, Text, Integer, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    """User model for York University students."""

    __tablename__ = "users"

    # Authentication
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Trust system
    completed_transactions: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Gig marketplace stats
    gig_rating_avg: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        default=0,
        nullable=False,
    )
    gigs_completed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    total_earned: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=0,
        nullable=False,
    )

    # Admin flag
    is_admin: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Founder badge — granted to all users who existed at launch
    is_founder: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Persona flag — marks accounts controlled by admin for platform seeding
    is_persona: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Profile (name is immutable after verification)
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    name_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Optional profile fields
    program: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Arrays for preferences
    campus_days: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(20)),
        nullable=True,
    )
    interests: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(50)),
        nullable=True,
    )

    # Activity tracking
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(45),   # fits IPv4 and IPv6
        nullable=True,
    )

    # Account status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_banned: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    vault_posts: Mapped[list["VaultPost"]] = relationship(
        "VaultPost",
        back_populates="author",
        lazy="dynamic",
    )
    vault_comments: Mapped[list["VaultComment"]] = relationship(
        "VaultComment",
        back_populates="author",
        lazy="dynamic",
    )
    marketplace_listings: Mapped[list["MarketplaceListing"]] = relationship(
        "MarketplaceListing",
        back_populates="seller",
        lazy="dynamic",
    )
    buddy_requests: Mapped[list["BuddyRequest"]] = relationship(
        "BuddyRequest",
        back_populates="host",
        lazy="dynamic",
    )
    reviews_given: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewer_id",
        back_populates="reviewer",
        lazy="dynamic",
    )
    reviews_received: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewed_id",
        back_populates="reviewed",
        lazy="dynamic",
    )
    # Transaction relationships
    sales_transactions: Mapped[list["MarketplaceTransaction"]] = relationship(
        "MarketplaceTransaction",
        foreign_keys="MarketplaceTransaction.seller_id",
        back_populates="seller",
        lazy="dynamic",
    )
    purchase_transactions: Mapped[list["MarketplaceTransaction"]] = relationship(
        "MarketplaceTransaction",
        foreign_keys="MarketplaceTransaction.buyer_id",
        back_populates="buyer",
        lazy="dynamic",
    )
    # Marketplace review relationships
    marketplace_reviews_given: Mapped[list["MarketplaceReview"]] = relationship(
        "MarketplaceReview",
        foreign_keys="MarketplaceReview.reviewer_id",
        back_populates="reviewer",
        lazy="dynamic",
    )
    marketplace_reviews_received: Mapped[list["MarketplaceReview"]] = relationship(
        "MarketplaceReview",
        foreign_keys="MarketplaceReview.reviewee_id",
        back_populates="reviewee",
        lazy="dynamic",
    )
    # Report relationships
    reports_submitted: Mapped[list["UserReport"]] = relationship(
        "UserReport",
        foreign_keys="UserReport.reporter_id",
        back_populates="reporter",
        lazy="dynamic",
    )
    reports_received: Mapped[list["UserReport"]] = relationship(
        "UserReport",
        foreign_keys="UserReport.reported_user_id",
        back_populates="reported_user",
        lazy="dynamic",
    )
    # Course membership relationships
    course_memberships: Mapped[list["CourseMember"]] = relationship(
        "CourseMember",
        back_populates="user",
        lazy="dynamic",
    )
    # Feedback submissions
    feedback_submissions: Mapped[list["UserFeedback"]] = relationship(
        "UserFeedback",
        back_populates="user",
        lazy="dynamic",
    )
    # Gig relationships
    gigs: Mapped[list["Gig"]] = relationship(
        "Gig",
        back_populates="poster",
        lazy="dynamic",
    )
    gig_responses: Mapped[list["GigResponse"]] = relationship(
        "GigResponse",
        back_populates="responder",
        lazy="dynamic",
    )
    gig_transactions_as_provider: Mapped[list["GigTransaction"]] = relationship(
        "GigTransaction",
        foreign_keys="GigTransaction.provider_id",
        back_populates="provider",
        lazy="dynamic",
    )
    gig_transactions_as_client: Mapped[list["GigTransaction"]] = relationship(
        "GigTransaction",
        foreign_keys="GigTransaction.client_id",
        back_populates="client",
        lazy="dynamic",
    )
    gig_ratings_given: Mapped[list["GigRating"]] = relationship(
        "GigRating",
        foreign_keys="GigRating.rater_id",
        back_populates="rater",
        lazy="dynamic",
    )
    gig_ratings_received: Mapped[list["GigRating"]] = relationship(
        "GigRating",
        foreign_keys="GigRating.ratee_id",
        back_populates="ratee",
        lazy="dynamic",
    )
    # Residence membership relationships
    residence_memberships: Mapped[list["ResidenceMember"]] = relationship(
        "ResidenceMember",
        back_populates="user",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


# Import for type hints (avoid circular imports)
from app.models.vault import VaultPost, VaultComment  # noqa: E402, F401
from app.models.marketplace import MarketplaceListing  # noqa: E402, F401
from app.models.buddy import BuddyRequest  # noqa: E402, F401
from app.models.review import Review  # noqa: E402, F401
from app.models.transaction import MarketplaceTransaction  # noqa: E402, F401
from app.models.marketplace_review import MarketplaceReview  # noqa: E402, F401
from app.models.report import UserReport  # noqa: E402, F401
from app.models.course import CourseMember  # noqa: E402, F401
from app.models.feedback import UserFeedback  # noqa: E402, F401
from app.models.gig import Gig, GigResponse, GigTransaction, GigRating  # noqa: E402, F401
from app.models.residence import ResidenceMember  # noqa: E402, F401
from app.models.activity import TrackingConsent, UserActivityProfile  # noqa: E402, F401
