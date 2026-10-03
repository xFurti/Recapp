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
    ("subjectentry", "attachment_ids", "JSON"),
    ("classroom", "timezone", "VARCHAR NOT NULL DEFAULT 'Europe/Rome'"),
    ("classroom", "hours", "JSON"),
    ("classroom", "demo_token", "VARCHAR"),
    ("classroom", "demo_seen_on", "DATE"),
]


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
    for name in applied:
        log.warning("migration applied: %s", name)
    return applied
