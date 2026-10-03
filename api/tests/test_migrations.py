from sqlalchemy import create_engine, inspect, text

from api.db import init_db


def test_migrations_add_missing_columns(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE classroom (id INTEGER PRIMARY KEY, code VARCHAR, name VARCHAR, label VARCHAR, is_demo BOOLEAN, rotation_anchor DATE, demo_seeded_on DATE, created_at DATETIME)"))
        c.execute(text("CREATE TABLE daycard (id INTEGER PRIMARY KEY, class_id INTEGER, day DATE, status VARCHAR, scribe_member_id INTEGER, author_member_id INTEGER, notes VARCHAR, created_at DATETIME, updated_at DATETIME, published_at DATETIME)"))
        c.execute(text("CREATE TABLE subjectentry (id INTEGER PRIMARY KEY, card_id INTEGER, position INTEGER, subject_code VARCHAR, hours VARCHAR, room VARCHAR, is_lab BOOLEAN, lesson_status VARCHAR, bullets JSON)"))
        c.execute(text("CREATE TABLE member (id INTEGER PRIMARY KEY, class_id INTEGER, nick VARCHAR, role VARCHAR, rotation_order INTEGER, active BOOLEAN, failed_attempts INTEGER, session_version INTEGER, created_at DATETIME)"))
        c.execute(text("INSERT INTO daycard (id, class_id, day, status, notes) VALUES (1, 1, '2026-10-01', 'draft', '')"))

    init_db(engine)
    init_db(engine)  # idempotent

    insp = inspect(engine)
    assert "revision" in {c["name"] for c in insp.get_columns("daycard")}
    assert "attachment_ids" in {c["name"] for c in insp.get_columns("subjectentry")}
    classroom_cols = {c["name"] for c in insp.get_columns("classroom")}
    assert {"timezone", "hours", "demo_token", "demo_seen_on"} <= classroom_cols
    assert "tour_seen_at" in {c["name"] for c in insp.get_columns("member")}
    assert {"cardcomment", "cardthanks"} <= set(insp.get_table_names())
    with engine.connect() as c:
        assert c.execute(text("SELECT revision FROM daycard WHERE id = 1")).scalar() == 0
