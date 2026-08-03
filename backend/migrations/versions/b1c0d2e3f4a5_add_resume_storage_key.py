"""add resume storage key

Revision ID: b1c0d2e3f4a5
Revises: 86ec73c02fdf
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b1c0d2e3f4a5"
down_revision: str | Sequence[str] | None = "86ec73c02fdf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("resume_storage_key", sa.String(length=1024), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "resume_storage_key")
