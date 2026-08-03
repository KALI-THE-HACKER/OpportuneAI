"""merge multiple heads

Revision ID: 69d4a16565f6
Revises: a028d6f2e27e, b1c0d2e3f4a5
Create Date: 2026-08-03 11:04:32.647155

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "69d4a16565f6"
down_revision: Union[str, Sequence[str], None] = ("a028d6f2e27e", "b1c0d2e3f4a5")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
