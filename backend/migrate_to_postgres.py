"""
One-shot migration: local SQLite → Supabase PostgreSQL.

Usage:
    DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-...pooler.supabase.com:5432/postgres \
    python migrate_to_postgres.py

Reads every row from backend/french_trainer.db and inserts it into the
PostgreSQL database at DATABASE_URL.  IDs and foreign-key relationships
are preserved.  The local SQLite file is never touched.
"""

import os
import sqlite3
import sys
from datetime import datetime

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# 1.  Check preconditions
# ---------------------------------------------------------------------------

POSTGRES_URL = os.getenv("DATABASE_URL")
if not POSTGRES_URL:
    print("ERROR: DATABASE_URL environment variable is not set.")
    print("Export it first, then re-run this script.")
    sys.exit(1)

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "french_trainer.db")
if not os.path.exists(SQLITE_PATH):
    print(f"ERROR: local SQLite file not found at {SQLITE_PATH}")
    sys.exit(1)

print(f"Source:      {SQLITE_PATH}")
print(f"Destination: {POSTGRES_URL.split('@')[1] if '@' in POSTGRES_URL else POSTGRES_URL}")
print()

# ---------------------------------------------------------------------------
# 2.  Connect to both databases
# ---------------------------------------------------------------------------

# SQLite — standard library, read-only
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row

# PostgreSQL — SQLAlchemy (uses psycopg2)
pg_engine = create_engine(POSTGRES_URL)

# ---------------------------------------------------------------------------
# 3.  Create tables on PostgreSQL (if they don't exist yet)
# ---------------------------------------------------------------------------

from database import Base

Base.metadata.create_all(bind=pg_engine)
print("Tables ensured on PostgreSQL.")

# ---------------------------------------------------------------------------
# 4.  Read from SQLite → insert into PostgreSQL (dependency order)
# ---------------------------------------------------------------------------

TABLES = [
    "listening_sessions",
    "question_segments",
    "sentence_segments",
    "vocabulary_items",
    "review_logs",
]

TIMESTAMP_COLUMNS = {"created_at", "reviewed_at"}


def parse_row(table_name: str, row: dict) -> dict:
    """Convert SQLite row values so PostgreSQL accepts them."""
    cleaned = {}
    for key, value in row.items():
        if key in TIMESTAMP_COLUMNS and isinstance(value, str):
            # SQLite stores datetimes as strings like "2026-05-24 08:17:39.963817"
            cleaned[key] = datetime.strptime(value, "%Y-%m-%d %H:%M:%S.%f")
        elif value is None:
            cleaned[key] = None
        else:
            cleaned[key] = value
    return cleaned


with pg_engine.begin() as conn:
    for table_name in TABLES:
        cursor = sqlite_conn.execute(f"SELECT * FROM {table_name}")
        rows = [parse_row(table_name, dict(row)) for row in cursor.fetchall()]

        if not rows:
            print(f"  {table_name}: 0 rows — skipped")
            continue

        columns = list(rows[0].keys())
        col_str = ", ".join(columns)
        placeholders = ", ".join([f":{col}" for col in columns])

        conn.execute(
            text(f"INSERT INTO {table_name} ({col_str}) VALUES ({placeholders})"),
            rows,
        )
        print(f"  {table_name}: {len(rows)} rows migrated")

    # Reset PostgreSQL auto-increment sequences so new inserts don't collide
    for table_name in TABLES:
        conn.execute(
            text(
                f"SELECT setval("
                f"  pg_get_serial_sequence('{table_name}', 'id'), "
                f"  COALESCE((SELECT MAX(id) FROM {table_name}), 0)"
                f")"
            )
        )
    print()
    print("Sequences reset to match migrated IDs.")

# ---------------------------------------------------------------------------
# 5.  Verify row counts
# ---------------------------------------------------------------------------

print()
print("Verification — row count comparison:")
print(f"  {'Table':<25} {'SQLite':>8} {'PostgreSQL':>10}")
print(f"  {'-'*25} {'-'*8} {'-'*10}")

pg_session = sessionmaker(bind=pg_engine)()

for table_name in TABLES:
    sqlite_count = sqlite_conn.execute(
        f"SELECT COUNT(*) FROM {table_name}"
    ).fetchone()[0]
    pg_count = pg_session.execute(
        text(f"SELECT COUNT(*) FROM {table_name}")
    ).scalar()
    status = " OK" if sqlite_count == pg_count else " MISMATCH"
    print(f"  {table_name:<25} {sqlite_count:>8} {pg_count:>10} {status}")

pg_session.close()
sqlite_conn.close()

print()
print("Migration complete.")
