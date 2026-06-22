"""
database/db.py — SQLite connection manager for German Law Vault.

Every caller should use get_db() as a context manager for short-lived
request-scoped connections, or get_connection() for longer-lived batch work.
WAL mode lets reads and writes happen concurrently without blocking each other.
"""

import os
import sqlite3
import threading
from contextlib import contextmanager

# Path to the SQLite database file (relative to project root)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "laws.db")

_local = threading.local()  # thread-local storage (unused for now; reserved for pooling)


def get_connection(path: str = DB_PATH) -> sqlite3.Connection:
    """
    Open and configure a new SQLite connection.

    Settings applied:
    - WAL journal mode   → concurrent reads while a write is in progress
    - foreign_keys ON    → CASCADE deletes work correctly
    - busy_timeout 5 s   → retry on lock rather than crashing immediately
    - row_factory        → rows behave like dicts (column access by name)
    """
    conn = sqlite3.connect(path, timeout=5, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")   # faster writes, still crash-safe with WAL
    conn.execute("PRAGMA cache_size=-32000")    # 32 MB page cache
    conn.execute("PRAGMA temp_store=MEMORY")
    return conn


def init_db(path: str = DB_PATH) -> None:
    """
    Initialise the database: create tables, indexes, and triggers if they
    do not already exist.  Safe to call multiple times (all statements use
    IF NOT EXISTS).
    """
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, encoding="utf-8") as fh:
        schema_sql = fh.read()

    conn = get_connection(path)
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


@contextmanager
def get_db(path: str = DB_PATH):
    """
    Context manager for a request-scoped SQLite connection.

    Usage::

        with get_db() as db:
            rows = db.execute("SELECT * FROM laws LIMIT 10").fetchall()
            # connection is automatically closed when the block exits
    """
    conn = get_connection(path)
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def db_is_ready(path: str = DB_PATH) -> tuple[bool, int]:
    """
    Check whether the database exists and contains law data.

    Returns:
        (ready: bool, law_count: int)
    """
    if not os.path.exists(path):
        return False, 0
    try:
        with get_db(path) as conn:
            count = conn.execute("SELECT COUNT(*) FROM laws").fetchone()[0]
            return count > 0, count
    except Exception:
        return False, 0
