"""Add activity tracking tables

All four tables live in the existing Supabase Postgres database — no
separate AWS/NoSQL store (an earlier DynamoDB-based design was replaced
with this simpler, all-Postgres one; see the feature's implementation plan
for why). activity_events/activity_sessions use a real FK with ON DELETE
CASCADE, so deleting a user automatically purges their activity data with
no separate manual cleanup step required.

Revision ID: add_activity_tracking
Revises: add_signup_attempts
Create Date: 2026-09-09
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
        'activity_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('session_id', UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', UUID(as_uuid=True), nullable=True),
        sa.Column('request_method', sa.String(10), nullable=True),
        sa.Column('request_path', sa.String(255), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('properties', JSON(), nullable=True),
    )
    op.create_index('ix_activity_events_occurred_at', 'activity_events', ['occurred_at'])
    op.create_index('ix_activity_events_user_id', 'activity_events', ['user_id'])
    op.create_index('ix_activity_events_session_id', 'activity_events', ['session_id'])
    op.create_index('ix_activity_events_event_type', 'activity_events', ['event_type'])
    op.create_index('ix_activity_events_category', 'activity_events', ['category'])
    op.create_index('ix_activity_events_entity_id', 'activity_events', ['entity_id'])

    op.create_table(
        'activity_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('product_analytics_consented', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('replay_consented', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('consent_version', sa.String(50), nullable=True),
        sa.Column('device_type', sa.String(20), nullable=True),
        sa.Column('browser', sa.String(200), nullable=True),
        sa.Column('landing_path', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('event_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('replay_chunks', JSON(), nullable=True),
        sa.Column('replay_byte_size', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('ix_activity_sessions_user_id', 'activity_sessions', ['user_id'])

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
    op.drop_table('activity_sessions')
    op.drop_table('activity_events')
