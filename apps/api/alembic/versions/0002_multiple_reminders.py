"""Permit multiple independent reminder deliveries per user and event."""

from sqlalchemy import inspect, text

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    for constraint in inspect(op.get_bind()).get_unique_constraints("reminders"):
        if set(constraint["column_names"]) == {"user_id", "event_id"}:
            op.drop_constraint(constraint["name"], "reminders", type_="unique")


def downgrade():
    duplicate = op.get_bind().scalar(
        text("SELECT 1 FROM reminders GROUP BY user_id,event_id HAVING count(*)>1 LIMIT 1")
    )
    if duplicate:
        raise RuntimeError(
            "Cannot downgrade multiple reminders without discarding history; retain migration 0002."
        )
    op.create_unique_constraint("reminders_user_id_event_id_key", "reminders", ["user_id", "event_id"])
