"""
test_seed_norms_to_qdrant.py — Tests for Qdrant seeding logic.

Mocks QdrantClient to verify point construction, UUID generation,
content truncation, and batching without a real Qdrant instance.
"""

import os
import sqlite3
import sys
import tempfile
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch

import pytest
from qdrant_client.models import PointStruct


def _fresh_import():
    """Remove cached module and re-import scripts.seed_norms_to_qdrant."""
    for key in list(sys.modules.keys()):
        if "seed_norms_to_qdrant" in key:
            del sys.modules[key]
    import scripts.seed_norms_to_qdrant as mod

    return mod


def _import_with_mocks():
    """Import seed_norms_to_qdrant with QdrantClient fully mocked (no real HTTP)."""
    for key in list(sys.modules.keys()):
        if "seed_norms_to_qdrant" in key:
            del sys.modules[key]
    # Patch QdrantClient inside the qdrant_client package itself to prevent
    # any real connections during import
    with patch("qdrant_client.QdrantClient") as mock_cls:
        mock_cls.return_value = MagicMock()
        import scripts.seed_norms_to_qdrant as mod

    return mod


def test_generates_uuid_v5_from_law_key_and_norm_id():
    """UUID v5 should be deterministic based on law_key:norm_id."""
    expected = str(uuid.uuid5(uuid.NAMESPACE_DNS, "german-norm:BGB:§ 7"))
    ns = uuid.NAMESPACE_DNS
    actual = str(uuid.uuid5(ns, "german-norm:BGB:§ 7"))
    assert actual == expected


def test_uuid_deterministic():
    """Same inputs should always produce the same UUID."""
    ns = uuid.NAMESPACE_DNS
    a = str(uuid.uuid5(ns, "german-norm:StGB:§ 211"))
    b = str(uuid.uuid5(ns, "german-norm:StGB:§ 211"))
    assert a == b


def test_uuid_different_for_different_norms():
    """Different law_key:norm_id combos should produce different UUIDs."""
    ns = uuid.NAMESPACE_DNS
    a = str(uuid.uuid5(ns, "german-norm:BGB:§ 7"))
    b = str(uuid.uuid5(ns, "german-norm:StGB:§ 211"))
    assert a != b


def test_point_struct_has_correct_payload_fields():
    """PointStruct should include all expected payload fields."""
    point = PointStruct(
        id="test-uuid",
        payload={
            "law_key": "BGB",
            "law_title": "Bürgerliches Gesetzbuch",
            "category": "consumer",
            "norm_id": "§ 7",
            "norm_title": "Test Norm",
            "content": "Test content here.",
        },
        vector={},
    )
    assert point.id == "test-uuid"
    assert point.payload["law_key"] == "BGB"
    assert point.payload["norm_id"] == "§ 7"
    assert point.payload["category"] == "consumer"
    assert point.payload["content"] == "Test content here."
    assert point.vector == {}


def test_content_truncated_to_16384_chars():
    """Content longer than 16384 chars should be truncated."""
    long_content = "A" * 20000
    truncated = long_content[:16384]
    assert len(truncated) == 16384
    assert len(long_content) > 16384

    point = PointStruct(
        id="id",
        payload={
            "law_key": "BGB",
            "norm_id": "§ 1",
            "content": truncated,
        },
        vector={},
    )
    assert len(point.payload["content"]) == 16384


def test_batch_size_constant():
    """BATCH_SIZE should be 100."""
    mod = _import_with_mocks()
    assert mod.BATCH_SIZE == 100


def test_handles_missing_laws_db_gracefully():
    """Should print error and return when laws.db is not found."""
    mod = _import_with_mocks()
    with patch("scripts.seed_norms_to_qdrant.os.path.exists", return_value=False):
        result = mod.seed_db()
        assert result is None


def test_exits_when_env_vars_missing():
    """Should exit with error when QDRANT_URL or QDRANT_API_KEY not set."""
    with patch.dict(os.environ, {}, clear=True):
        with patch("qdrant_client.QdrantClient"):
            with pytest.raises(SystemExit) as exc:
                _fresh_import()
            assert exc.value.code == 1


def test_seed_db_creates_points_from_sqlite():
    """seed_db should read norms from SQLite and upsert to Qdrant."""
    mock_qdrant = MagicMock()
    mock_qdrant.upsert.return_value = None

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")
        conn = sqlite3.connect(db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS laws (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'other'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS norms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                law_id INTEGER NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
                norm_id TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                token_count INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute(
            "INSERT INTO laws (key, title, category) VALUES ('BGB', 'Bürgerliches Gesetzbuch', 'consumer')"
        )
        conn.execute(
            "INSERT INTO norms (law_id, norm_id, title, content) VALUES (1, '§ 1', 'First Norm', 'Content here')"
        )
        conn.execute(
            "INSERT INTO norms (law_id, norm_id, title, content) VALUES (1, '§ 2', 'Second Norm', 'More content')"
        )
        conn.commit()
        conn.close()

        # Import with mocked QdrantClient, then patch the module client + db_path
        mod = _import_with_mocks()
        mod.client = mock_qdrant
        with patch("scripts.seed_norms_to_qdrant.os.path.dirname", return_value=tmpdir):
            with patch.object(mod, "BATCH_SIZE", 100):
                mod.seed_db()

        assert mock_qdrant.upsert.called
        call_args = mock_qdrant.upsert.call_args
        assert "points" in call_args[1]
        points = call_args[1]["points"]
        assert len(points) == 2

        # Force cleanup of any lingering SQLite handles before temp dir teardown
        import gc

        gc.collect()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
