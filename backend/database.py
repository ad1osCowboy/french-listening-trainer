"""
Database setup with SQLAlchemy.
Uses SQLite locally; set DATABASE_URL to a PostgreSQL URL (e.g. Supabase) in production.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./french_trainer.db")

is_sqlite = DATABASE_URL.startswith("sqlite")

connect_args: dict = {}
if is_sqlite:
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite,  # keep PostgreSQL connections healthy
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on startup."""
    Base.metadata.create_all(bind=engine)
