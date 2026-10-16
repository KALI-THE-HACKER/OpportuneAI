"""add saved_jobs and user_job_events

Revision ID: 9d2b7f4e6c11
Revises: 3cfcb26a5c5b
Create Date: 2026-10-16 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9d2b7f4e6c11"
down_revision: Union[str, Sequence[str], None] = "3cfcb26a5c5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("saved_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["processed_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_id", name="uq_user_saved_job"),
    )
    op.create_index(op.f("ix_saved_jobs_job_id"), "saved_jobs", ["job_id"], unique=False)
    op.create_index(
        op.f("ix_saved_jobs_saved_at"), "saved_jobs", ["saved_at"], unique=False
    )
    op.create_index(op.f("ix_saved_jobs_user_id"), "saved_jobs", ["user_id"], unique=False)

    op.create_table(
        "user_job_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["processed_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_user_job_events_created_at"),
        "user_job_events",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_job_events_event_type"),
        "user_job_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_job_events_job_id"), "user_job_events", ["job_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_job_events_source"), "user_job_events", ["source"], unique=False
    )
    op.create_index(
        op.f("ix_user_job_events_user_id"), "user_job_events", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_job_events_user_id"), table_name="user_job_events")
    op.drop_index(op.f("ix_user_job_events_source"), table_name="user_job_events")
    op.drop_index(op.f("ix_user_job_events_job_id"), table_name="user_job_events")
    op.drop_index(op.f("ix_user_job_events_event_type"), table_name="user_job_events")
    op.drop_index(op.f("ix_user_job_events_created_at"), table_name="user_job_events")
    op.drop_table("user_job_events")

    op.drop_index(op.f("ix_saved_jobs_user_id"), table_name="saved_jobs")
    op.drop_index(op.f("ix_saved_jobs_saved_at"), table_name="saved_jobs")
    op.drop_index(op.f("ix_saved_jobs_job_id"), table_name="saved_jobs")
    op.drop_table("saved_jobs")
