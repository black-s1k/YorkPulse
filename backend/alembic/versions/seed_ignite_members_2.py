"""Add Nikol, John (Marketing) and Ali (Forge) to the AI Ignite roster

Revision ID: seed_ignite_members_2
Revises: seed_ignite_members
Create Date: 2026-09-26
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision = 'seed_ignite_members_2'
down_revision = 'seed_ignite_members'
branch_labels = None
depends_on = None

ROSTER = [
    ("Nikol", None, ["marketing"]),
    ("John", None, ["marketing"]),
    ("Ali", None, ["forge"]),
]

members = sa.table(
    'ignite_members',
    sa.column('id', UUID(as_uuid=True)),
    sa.column('name', sa.String),
    sa.column('role', sa.String),
    sa.column('teams', ARRAY(sa.String)),
)


def upgrade() -> None:
    conn = op.get_bind()
    # skip anyone already added by hand on the Members page
    existing = {row[0].strip().lower() for row in conn.execute(sa.text("SELECT name FROM ignite_members"))}
    rows = [
        {"id": uuid.uuid4(), "name": name, "role": role, "teams": teams}
        for name, role, teams in ROSTER
        if name.lower() not in existing
    ]
    if rows:
        op.bulk_insert(members, rows)


def downgrade() -> None:
    conn = op.get_bind()
    # only remove the rows this migration could have added and that have no tasks
    conn.execute(
        sa.text(
            "DELETE FROM ignite_members m WHERE m.name = ANY(:names) "
            "AND NOT EXISTS (SELECT 1 FROM ignite_task_assignees a WHERE a.member_id = m.id)"
        ),
        {"names": [name for name, _, _ in ROSTER]},
    )
