"""Add activity tracking tables (tracking_consents, user_activity_profiles)

The high-volume raw event log and session-replay data live in DynamoDB, not
Postgres — these are only the low-volume, FK-integrity-worth-having pieces:
the consent audit ledger and the per-user aggregate profile. See the
feature's implementation plan for the full architecture.

Revision ID: add_activity_tracking
Revises: add_signup_attempts
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = 'add_activity_tracking'
down_revision = 'add_signup_attempts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tracking_consents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy_version', sa.String(50), nullable=False),
        sa.Column('consent_scope', sa.String(50), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
    )
    op.create_index('ix_tracking_consents_user_id', 'tracking_consents', ['user_id'])

    op.create_table(
        'user_activity_profiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('last_computed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('total_sessions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_events', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_replay_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_page_views', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg_session_duration_seconds', sa.Float(), nullable=False, server_default='0'),
        sa.Column('days_active_last_30', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('most_active_hour_of_day', sa.Integer(), nullable=True),
        sa.Column('most_active_day_of_week', sa.Integer(), nullable=True),
        sa.Column('vault_posts_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('messages_sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('course_messages_sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('marketplace_listings_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quests_joined_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('gigs_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('feature_usage_breakdown', JSON(), nullable=True),
        sa.Column('engagement_score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('activity_label', sa.String(20), nullable=False, server_default='dormant'),
    )
    op.create_index('ix_user_activity_profiles_user_id', 'user_activity_profiles', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_table('user_activity_profiles')
    op.drop_table('tracking_consents')
