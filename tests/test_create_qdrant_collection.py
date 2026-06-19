"""
test_create_qdrant_collection.py — Tests for Qdrant collection creation.

Mocks QdrantClient to verify collection configuration without
connecting to an actual Qdrant instance.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch

import pytest


def _fresh_import():
    """Remove cached module and re-import scripts.create_qdrant_collection."""
    for key in list(sys.modules.keys()):
        if "create_qdrant_collection" in key:
            del sys.modules[key]
    import scripts.create_qdrant_collection as mod

    return mod


def test_uses_correct_collection_name():
    """Collection should be named 'german_norms'."""
    mock_client = MagicMock()
    with patch.dict(
        os.environ, {"QDRANT_URL": "http://test", "QDRANT_API_KEY": "test-key"}
    ):
        with patch("qdrant_client.QdrantClient", return_value=mock_client):
            mod = _fresh_import()
            call_kwargs = mock_client.recreate_collection.call_args[1]
            assert call_kwargs["collection_name"] == "german_norms"


def test_vector_params_size_and_distance():
    """Should set size=384 and distance=COSINE."""
    mock_client = MagicMock()
    # Remove the method so hasattr(client, 'get_fastembed_vector_params') is False
    del mock_client.get_fastembed_vector_params

    with patch.dict(
        os.environ, {"QDRANT_URL": "http://test", "QDRANT_API_KEY": "test-key"}
    ):
        with patch("qdrant_client.QdrantClient", return_value=mock_client):
            mod = _fresh_import()
            call_kwargs = mock_client.recreate_collection.call_args[1]
            vc = call_kwargs["vectors_config"]
            assert vc.size == 384
            assert vc.distance == "Cosine"


def test_creates_payload_indexes():
    """Should create payload indexes on law_key and category."""
    mock_client = MagicMock()
    del mock_client.get_fastembed_vector_params

    with patch.dict(
        os.environ, {"QDRANT_URL": "http://test", "QDRANT_API_KEY": "test-key"}
    ):
        with patch("qdrant_client.QdrantClient", return_value=mock_client):
            mod = _fresh_import()
            assert mock_client.create_payload_index.call_count >= 2
            fields = []
            for call in mock_client.create_payload_index.call_args_list:
                kwargs = call[1]
                assert kwargs["collection_name"] == "german_norms"
                fields.append(kwargs["field_name"])
            assert "law_key" in fields
            assert "category" in fields


def test_sets_scalar_quantization():
    """Should configure int8 scalar quantization."""
    mock_client = MagicMock()
    del mock_client.get_fastembed_vector_params

    with patch.dict(
        os.environ, {"QDRANT_URL": "http://test", "QDRANT_API_KEY": "test-key"}
    ):
        with patch("qdrant_client.QdrantClient", return_value=mock_client):
            mod = _fresh_import()
            call_kwargs = mock_client.recreate_collection.call_args[1]
            qc = call_kwargs["quantization_config"]
            assert qc.scalar.type == "int8"
            assert qc.scalar.always_ram is True


def test_exits_when_env_vars_missing():
    """Should exit with error when QDRANT_URL or QDRANT_API_KEY are missing."""
    with patch.dict(os.environ, {}, clear=True):
        with patch("qdrant_client.QdrantClient"):
            with pytest.raises(SystemExit) as exc:
                _fresh_import()
            assert exc.value.code == 1


def test_collection_recreation_does_not_error():
    """Calling recreate_collection on an existing collection should not raise."""
    mock_client = MagicMock()
    mock_client.recreate_collection.return_value = True

    with patch.dict(
        os.environ, {"QDRANT_URL": "http://test", "QDRANT_API_KEY": "test-key"}
    ):
        with patch("qdrant_client.QdrantClient", return_value=mock_client):
            mod = _fresh_import()
            assert mock_client.recreate_collection.called


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
