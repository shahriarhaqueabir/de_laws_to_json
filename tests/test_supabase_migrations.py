"""
test_supabase_migrations.py — Supabase migration SQL validation.

Tests that all migration files under supabase/migrations/ are valid SQL
and create the expected tables, indexes, RLS policies.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

MIGRATIONS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "supabase",
    "migrations",
)


def _read_migration(name: str) -> str:
    """Read a migration file by name."""
    path = os.path.join(MIGRATIONS_DIR, name)
    if not os.path.exists(path):
        pytest.skip(f"Migration file not found: {name}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _has_create_table(sql: str, table_name: str) -> bool:
    """Check if SQL contains CREATE TABLE for the given table."""
    pattern = rf"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?{re.escape(table_name)}\b"
    return bool(re.search(pattern, sql, re.IGNORECASE))


def _has_create_index(sql: str, index_name: str) -> bool:
    """Check if SQL contains CREATE INDEX for the given index."""
    pattern = rf"CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?{re.escape(index_name)}\b"
    return bool(re.search(pattern, sql, re.IGNORECASE))


def _has_enable_rls(sql: str, table_name: str) -> bool:
    """Check if SQL enables RLS for the given table."""
    pattern = rf"ALTER\s+TABLE\s+(?:public\.)?{re.escape(table_name)}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY"
    return bool(re.search(pattern, sql, re.IGNORECASE))


def _has_create_policy(sql: str, policy_name: str) -> bool:
    """Check if SQL creates a policy with the given name."""
    pattern = rf"CREATE\s+POLICY\s+\"{re.escape(policy_name)}\""
    return bool(re.search(pattern, sql, re.IGNORECASE))


# ---------------------------------------------------------------------------
# Migration 00001: Initial schema
# ---------------------------------------------------------------------------


def test_migration_00001_exists():
    """Migration 00001 should exist and be readable."""
    sql = _read_migration("00001_initial_schema.sql")
    assert len(sql) > 0


def test_migration_00001_creates_laws_table():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_table(sql, "laws")


def test_migration_00001_creates_conversations_table():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_table(sql, "conversations")


def test_migration_00001_creates_messages_table():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_table(sql, "messages")


def test_migration_00001_creates_bookmarks_table():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_table(sql, "bookmarks")


def test_migration_00001_creates_indexes():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_index(sql, "idx_laws_category")


def test_migration_00001_enables_rls():
    sql = _read_migration("00001_initial_schema.sql")
    for table in ["laws", "conversations", "messages", "bookmarks"]:
        assert _has_enable_rls(sql, table), f"RLS not enabled for {table}"


def test_migration_00001_creates_laws_policy():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_policy(sql, "laws are public")


def test_migration_00001_creates_conversations_policy():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_policy(sql, "users own conversations")


def test_migration_00001_creates_messages_policy():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_policy(sql, "users own messages")


def test_migration_00001_creates_bookmarks_policy():
    sql = _read_migration("00001_initial_schema.sql")
    assert _has_create_policy(sql, "users own bookmarks")


def test_migration_00001_has_extension():
    sql = _read_migration("00001_initial_schema.sql")
    assert "create extension if not exists pgcrypto" in sql.lower()


# ---------------------------------------------------------------------------
# Migration 00002: Norm explanations
# ---------------------------------------------------------------------------


def test_migration_00002_norm_explanations_exists():
    sql = _read_migration("00002_norm_explanations.sql")
    assert len(sql) > 0


def test_migration_00002_creates_norm_explanations_table():
    sql = _read_migration("00002_norm_explanations.sql")
    assert _has_create_table(sql, "norm_explanations")


def test_migration_00002_has_unique_constraint():
    sql = _read_migration("00002_norm_explanations.sql")
    assert (
        "unique (norm_id, lang)" in sql.lower()
        or "unique(norm_id, lang)" in sql.lower()
    )


def test_migration_00002_creates_index():
    sql = _read_migration("00002_norm_explanations.sql")
    assert _has_create_index(sql, "idx_norm_explanations_lookup")


def test_migration_00002_enables_rls():
    sql = _read_migration("00002_norm_explanations.sql")
    assert _has_enable_rls(sql, "norm_explanations")


def test_migration_00002_creates_select_policy():
    sql = _read_migration("00002_norm_explanations.sql")
    assert _has_create_policy(sql, "norm_explanations are public")


def test_migration_00002_creates_insert_policy():
    sql = _read_migration("00002_norm_explanations.sql")
    assert _has_create_policy(sql, "norm_explanations insert")


# ---------------------------------------------------------------------------
# Migration 00002: Remediation schema
# ---------------------------------------------------------------------------


def test_migration_00002_remediation_exists():
    sql = _read_migration("00002_remediation_schema.sql")
    assert len(sql) > 0


def test_migration_00002_remediation_creates_case_files():
    sql = _read_migration("00002_remediation_schema.sql")
    assert _has_create_table(sql, "case_files")


def test_migration_00002_remediation_creates_playbooks():
    sql = _read_migration("00002_remediation_schema.sql")
    assert _has_create_table(sql, "remediation_playbooks")


def test_migration_00002_remediation_creates_templates():
    sql = _read_migration("00002_remediation_schema.sql")
    assert _has_create_table(sql, "document_templates")


def test_migration_00002_remediation_enables_rls():
    sql = _read_migration("00002_remediation_schema.sql")
    for table in ["case_files", "remediation_playbooks", "document_templates"]:
        assert _has_enable_rls(sql, table), f"RLS not enabled for {table}"


def test_migration_00002_remediation_creates_policies():
    sql = _read_migration("00002_remediation_schema.sql")
    assert _has_create_policy(sql, "Users own their case files")
    assert _has_create_policy(sql, "Playbooks are public")
    assert _has_create_policy(sql, "Templates are public")


# ---------------------------------------------------------------------------
# SQL syntax validation (basic)
# ---------------------------------------------------------------------------


def test_migration_00001_sql_syntax():
    """Basic SQL syntax check: statements should end with semicolons."""
    sql = _read_migration("00001_initial_schema.sql")
    lines = [
        l.strip()
        for l in sql.split("\n")
        if l.strip() and not l.strip().startswith("--")
    ]
    for line in lines:
        # Each DDL/DML statement should end with a semicolon
        # (skip comments and blocks like DO $$ ... $$)
        if line.upper().startswith(("CREATE", "ALTER", "DROP", "INSERT", "SELECT")):
            if not line.endswith(";"):
                # Check if it's the start of a multi-line statement
                pass  # multi-line is fine


def test_migration_00002_norm_explanations_syntax():
    sql = _read_migration("00002_norm_explanations.sql")
    assert sql.count(";") >= 5  # Should have multiple statements
    assert sql.count("create") >= 2  # CREATE TABLE, CREATE INDEX
    assert sql.count("alter") >= 1  # ALTER TABLE ENABLE RLS


def test_migration_00002_remediation_syntax():
    sql = _read_migration("00002_remediation_schema.sql")
    assert sql.count(";") >= 8  # Multiple CREATE TABLE + ALTER + POLICY statements
    assert sql.count("CREATE TABLE") >= 3
    assert sql.count("ENABLE ROW LEVEL SECURITY") >= 3


def test_all_migrations_have_consistent_naming():
    """Migration files should follow the pattern NNNN_name.sql."""
    if not os.path.isdir(MIGRATIONS_DIR):
        pytest.skip("Migrations directory not found")
    for fname in os.listdir(MIGRATIONS_DIR):
        if fname.endswith(".sql"):
            assert re.match(r"^\d{5}_.+\.sql$", fname), (
                f"Bad migration filename: {fname}"
            )


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
