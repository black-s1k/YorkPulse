"""Add AI Ignite task tracker tables

Revision ID: add_ignite_tracker
Revises: add_activity_tracking
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision = 'add_ignite_tracker'
down_revision = 'add_activity_tracking'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ignite_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('role', sa.String(100), nullable=True),
        sa.Column('teams', ARRAY(sa.String(20)), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ignite_tasks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('team', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='not_started'),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('priority', sa.String(10), nullable=False, server_default='medium'),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_ignite_tasks_team', 'ignite_tasks', ['team'])
    op.create_index('ix_ignite_tasks_status', 'ignite_tasks', ['status'])

    op.create_table(
        'ignite_task_assignees',
        sa.Column('task_id', UUID(as_uuid=True), sa.ForeignKey('ignite_tasks.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('ignite_members.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_index('ix_ignite_task_assignees_member_id', 'ignite_task_assignees', ['member_id'])


def downgrade() -> None:
    op.drop_table('ignite_task_assignees')
    op.drop_table('ignite_tasks')
    op.drop_table('ignite_members')
