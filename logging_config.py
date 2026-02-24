"""
Logging Configuration for German Law Dashboard

Provides separate loggers for different concerns:
- server: General server activity and connections
- error: Errors and exceptions only
- indexing: Index build progress and statistics
- dictionary: Dictionary operations and cache stats
- ratelimit: Rate limiting events
- ai: AI/Ollama interactions
"""

import logging
import os
from logging.handlers import RotatingFileHandler

LOGS_DIR = "./Logs"
os.makedirs(LOGS_DIR, exist_ok=True)

LOG_FORMAT = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def _create_logger(name: str, log_file: str, level: int = logging.INFO) -> logging.Logger:
    """Create a logger with file and console handlers."""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid adding duplicate handlers
    if logger.handlers:
        return logger
    
    # File handler with rotation (max 5MB, keep 3 backups)
    file_path = os.path.join(LOGS_DIR, log_file)
    file_handler = RotatingFileHandler(
        file_path, 
        encoding="utf-8",
        maxBytes=5 * 1024 * 1024,
        backupCount=3
    )
    file_handler.setFormatter(LOG_FORMAT)
    file_handler.setLevel(level)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(LOG_FORMAT)
    console_handler.setLevel(level)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger


# Create all loggers
server_logger = _create_logger("server", "server.log")
error_logger = _create_logger("error", "error.log", level=logging.ERROR)
indexing_logger = _create_logger("indexing", "indexing.log")
dictionary_logger = _create_logger("dictionary", "dictionary.log")
ratelimit_logger = _create_logger("ratelimit", "ratelimit.log")
ai_logger = _create_logger("ai", "ai.log")


def get_server_logger() -> logging.Logger:
    """Get the server logger for general server activity."""
    return server_logger


def get_error_logger() -> logging.Logger:
    """Get the error logger for exceptions and critical errors."""
    return error_logger


def get_indexing_logger() -> logging.Logger:
    """Get the indexing logger for index build progress."""
    return indexing_logger


def get_dictionary_logger() -> logging.Logger:
    """Get the dictionary logger for dictionary operations."""
    return dictionary_logger


def get_ratelimit_logger() -> logging.Logger:
    """Get the rate limit logger for rate limiting events."""
    return ratelimit_logger


def get_ai_logger() -> logging.Logger:
    """Get the AI logger for AI/Ollama interactions."""
    return ai_logger
