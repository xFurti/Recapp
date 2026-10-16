"""Additive, idempotent schema changes for databases created by older versions.

`SQLModel.metadata.create_all` creates missing tables but never adds columns to
existing ones, so every new column on an existing table must be listed here.
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger("ieri.migrations")

# (table, column, DDL type and default)
COLUMNS: list[tuple[str, str, str]] = [
    ("daycard", "revision", "INTEGER NOT NULL DEFAULT 0"),
    ("daycard", "updated_by_member_id", "INTEGER REFERENCES member(id)"),
    ("subjectentry", "attachment_ids", "JSON"),
    ("classroom", "timezone", "VARCHAR NOT NULL DEFAULT 'Europe/Rome'"),
    ("classroom", "hours", "JSON"),
    ("classroom", "demo_token", "VARCHAR"),
    ("classroom", "demo_seen_on", "DATE"),
    ("member", "tour_seen_at", "TIMESTAMP"),
    ("upcomingitem", "published_at", "TIMESTAMP"),
]

# Only facts already in the database are used: an item inside a published day became
# public with that day (or later, if added afterwards); a standalone item was public as
# soon as it was created. Drafts stay NULL. Every statement only fills NULLs, so running
# them on each start is idempotent and also repairs a backfill interrupted after the
# column was added (SQLite commits ALTER TABLE on its own).
BACKFILLS: dict[tuple[str, str], list[str]] = {
    ("upcomingitem", "published_at"): [
        """
        UPDATE upcomingitem SET published_at = COALESCE((
            SELECT CASE
                WHEN daycard.published_at IS NULL THEN upcomingitem.created_at
                WHEN upcomingitem.created_at IS NOT NULL AND upcomingitem.created_at > daycard.published_at
                    THEN upcomingitem.created_at
                ELSE daycard.published_at
            END
            FROM daycard WHERE daycard.id = upcomingitem.card_id
        ), created_at)
        WHERE status = 'published' AND card_id IS NOT NULL AND published_at IS NULL
        """,
        """
        UPDATE upcomingitem SET published_at = created_at
        WHERE status = 'published' AND card_id IS NULL AND published_at IS NULL
        """,
    ],
}


def run_migrations(engine: Engine) -> list[str]:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    applied: list[str] = []
    with engine.begin() as conn:
        for table, column, ddl in COLUMNS:
            if table not in tables:
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            if column in existing:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            applied.append(f"{table}.{column}")
    with engine.begin() as conn:
        for (table, _column), statements in BACKFILLS.items():
            if table in tables:
                for statement in statements:
                    conn.execute(text(statement))
    for name in applied:
        log.warning("migration applied: %s", name)
    return applied
