"""Seed the AI Ignite member roster

Revision ID: seed_ignite_members
Revises: add_ignite_tracker
Create Date: 2026-09-25
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision = 'seed_ignite_members'
down_revision = 'add_ignite_tracker'
branch_labels = None
depends_on = None

ROSTER = [
    ("Sagarpreet Hooda", "Founder & President", ["exec"]),
    ("Nrup Patel", "Vice-President", ["exec"]),
    ("Nurjahan Ahmed Shiah", "Technical Lead, Forge Track", ["forge"]),
    ("Mehwish Saiyed", "Technical Lead, Forge Track", ["forge"]),
    ("Devyansh Raj", "Technical Lead, Spark Track", ["spark"]),
    ("Angad Ahluwalia", "Technical Lead, Spark Track", ["spark"]),
    ("Tatiana Dzyubenko", "Finance Lead", ["finance"]),
    ("Sebastien Ming Huang Mach", "Finance Lead", ["finance"]),
    ("Vianka Maria Fung Lu", "Finance Lead", ["finance"]),
    ("Frances Chikezie", "Finance Lead", ["finance"]),
    ("Arushi Bisht", "Marketing Lead", ["marketing"]),
    ("Ghalib Hassan", "Marketing Lead", ["marketing"]),
    ("Saharra Dhamrait", "Support Management & Marketing", ["support", "marketing"]),
    ("Andrei Outkin Perez", "Support Management", ["support"]),
    ("Manpreet Singh", "Support Management", ["support"]),
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
    existing = {row[0] for row in conn.execute(sa.text("SELECT name FROM ignite_members"))}
    rows = [
        {"id": uuid.uuid4(), "name": name, "role": role, "teams": teams}
        for name, role, teams in ROSTER
        if name not in existing
    ]
    if rows:
        op.bulk_insert(members, rows)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM ignite_members WHERE name = ANY(:names)"),
        {"names": [name for name, _, _ in ROSTER]},
    )
