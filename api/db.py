from collections.abc import Iterator

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from .config import settings


def make_engine(url: str):
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


engine = make_engine(settings.database_url)


def init_db(bind=None) -> None:
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(bind or engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
