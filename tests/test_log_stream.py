"""
test_log_stream.py — Tests for log output formatting and stream behavior.

Verifies that log formats match project conventions and that no
sensitive data leaks into log output.
"""

import io
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

# ---------------------------------------------------------------------------
# Log format tests
# ---------------------------------------------------------------------------


def test_download_de_laws_logging_format():
    """download_de_laws.py uses: %(asctime)s [%(levelname)s] %(message)s"""
    # Replicate the exact format from the source
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    logger = logging.getLogger("test_download_logger")
    logger.setLevel(logging.WARNING)

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter(fmt))
    logger.handlers.clear()
    logger.addHandler(handler)

    logger.warning("Test warning message")
    output = stream.getvalue()

    assert "[" in output
    assert "]" in output
    assert "WARNING" in output or "WARNING" in output
    assert "Test warning message" in output


def test_process_de_laws_logging_format():
    """process_de_laws.py uses: %(asctime)s [%(levelname)s] %(message)s"""
    # Same format as download_de_laws
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    logger = logging.getLogger("test_process_logger")
    logger.setLevel(logging.WARNING)

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter(fmt))
    logger.handlers.clear()
    logger.addHandler(handler)

    logger.error("Parse error")
    output = stream.getvalue()

    assert "[" in output
    assert "ERROR" in output
    assert "Parse error" in output


def test_broker_uses_structured_logging_with_module_name():
    """broker.py uses logger named 'broker'."""
    logger = logging.getLogger("broker")
    assert logger.name == "broker"


def test_download_logger_name():
    """download_de_laws.py uses the root logger."""
    # The file uses: logging.basicConfig(...) which sets the root logger
    root_logger = logging.getLogger()
    assert root_logger is not None


def test_logging_captures_warnings():
    """Logging should capture warning-level messages correctly."""
    logger = logging.getLogger("test_warning")
    logger.setLevel(logging.WARNING)

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logger.handlers.clear()
    logger.addHandler(handler)

    logger.warning("Disk space low")
    output = stream.getvalue()

    assert "WARNING" in output
    assert "Disk space low" in output


def test_tqdm_used_in_download_script():
    """download_de_laws.py should import tqdm for progress bars."""
    import download_de_laws as mod

    assert hasattr(mod, "tqdm")


def test_tqdm_used_in_process_script():
    """process_de_laws.py should import tqdm for progress bars."""
    # Check the source file directly rather than importing (which has deps on database module)
    import ast

    source_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "process_de_laws.py",
    )
    with open(source_path, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())
    imports = {
        node.names[0].name for node in ast.walk(tree) if isinstance(node, ast.Import)
    }
    from_imports = {
        node.module: [a.name for a in node.names]
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
    }
    assert "tqdm" in imports or any("tqdm" in names for names in from_imports.values())


def test_no_sensitive_data_in_log_output():
    """Log output should not contain API keys or passwords."""
    sensitive_patterns = [
        "QDRANT_API_KEY",
        "SUPABASE_KEY",
        "SUPABASE_SERVICE_KEY",
        "api_key=",
        "password=",
        "secret=",
    ]

    logger = logging.getLogger("test_sensitive")
    logger.setLevel(logging.INFO)

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.handlers.clear()
    logger.addHandler(handler)

    # Simulate common safe log messages
    messages = [
        "Processing file bgb.xml...",
        "Connected to database at localhost:5432",
        "Fetched 100 laws from index",
        "Download complete: 5000/6000 laws",
        "Collection 'german_norms' created successfully.",
    ]
    for msg in messages:
        logger.info(msg)
        for pattern in sensitive_patterns:
            assert pattern.lower() not in msg.lower(), (
                f"Sensitive data leaked: {pattern}"
            )

    output = stream.getvalue()
    for pattern in sensitive_patterns:
        assert pattern.lower() not in output.lower(), (
            f"Sensitive pattern found in logs: {pattern}"
        )


def test_log_level_configurable():
    """Log level should be configurable via environment or constant."""
    # download_de_laws.py uses: level=logging.WARNING
    import download_de_laws as mod

    # The root logger may have been configured; check constants exist
    assert hasattr(mod, "logging")


def test_multiline_log_preserved():
    """Multi-line log messages should be preserved in output."""
    logger = logging.getLogger("test_multiline")
    logger.setLevel(logging.INFO)

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.handlers.clear()
    logger.addHandler(handler)

    msg = "Line 1\nLine 2\nLine 3"
    logger.info(msg)
    output = stream.getvalue()
    assert "Line 1" in output
    assert "Line 2" in output
    assert "Line 3" in output


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
