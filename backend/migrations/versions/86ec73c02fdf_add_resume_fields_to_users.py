"""add resume fields to users

Revision ID: 86ec73c02fdf
Revises: 68cc82b16b5f
Create Date: 2026-07-27 23:18:29.352481

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "86ec73c02fdf"
down_revision: str | Sequence[str] | None = "68cc82b16b5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add resume columns to users table."""
    op.add_column(
        "users", sa.Column("resume_file_name", sa.String(length=500), nullable=True)
    )
    op.add_column("users", sa.Column("resume_size_kb", sa.Integer(), nullable=True))
    op.add_column(
        "users", sa.Column("resume_uploaded_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "users", sa.Column("resume_status", sa.String(length=50), nullable=True)
    )
    op.add_column("users", sa.Column("resume_text", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "resume_extracted_skills",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "users",
        sa.Column("resume_experience_level", sa.String(length=100), nullable=True),
    )
    op.add_column("users", sa.Column("resume_years_total", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("resume_confidence", sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove resume columns from users table."""
    op.drop_column("users", "resume_confidence")
    op.drop_column("users", "resume_years_total")
    op.drop_column("users", "resume_experience_level")
    op.drop_column("users", "resume_extracted_skills")
    op.drop_column("users", "resume_text")
    op.drop_column("users", "resume_status")
    op.drop_column("users", "resume_uploaded_at")
    op.drop_column("users", "resume_size_kb")
    op.drop_column("users", "resume_file_name")
