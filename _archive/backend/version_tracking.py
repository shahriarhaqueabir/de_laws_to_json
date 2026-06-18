"""
AI Metadata Version Tracking Utility

Provides version tracking, staleness detection, and metadata injection
for German law paragraphs in the AI system.

Version: 1.0
Last Updated: 2026-02-25
"""

import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from enum import Enum

# Import logging configuration
from logging_config import get_ai_logger, get_indexing_logger

logger = get_ai_logger()
indexing_logger = get_indexing_logger()


class LawStatus(Enum):
    """Status of a law paragraph."""
    IN_FORCE = "in_force"
    AMENDED = "amended"
    REPEALED = "repealed"


@dataclass
class LawMetadata:
    """
    Metadata for a law paragraph including version information.
    
    Attributes:
        law_id: Law identifier (e.g., 'bgb', 'stgb')
        paragraph: Paragraph number (e.g., '§548')
        content: Paragraph text content
        last_changed: ISO date string of last change (e.g., '2024-03-15')
        status: Current status (in_force, amended, repealed)
        repealed_date: ISO date if repealed (optional)
        source_url: Original source URL
        xml_version: XML version from source
    """
    law_id: str
    paragraph: str
    content: str
    
    # Version information
    last_changed: Optional[str] = None
    status: str = LawStatus.IN_FORCE.value
    repealed_date: Optional[str] = None
    
    # Source information
    source_url: Optional[str] = None
    xml_version: Optional[str] = None
    
    def is_stale(self, threshold_years: int = 2) -> bool:
        """
        Check if law version is potentially outdated.
        
        Args:
            threshold_years: Number of years after which law is considered stale
            
        Returns:
            True if law is older than threshold, False otherwise
        """
        if not self.last_changed:
            return True
        
        try:
            change_date = datetime.fromisoformat(self.last_changed)
            age = datetime.now() - change_date
            return age > timedelta(days=threshold_years * 365)
        except (ValueError, TypeError):
            logger.warning(f"Invalid date format for {self.law_id} {self.paragraph}: {self.last_changed}")
            return True
    
    def get_age_years(self) -> Optional[float]:
        """
        Get the age of the law version in years.
        
        Returns:
            Age in years, or None if date is invalid
        """
        if not self.last_changed:
            return None
        
        try:
            change_date = datetime.fromisoformat(self.last_changed)
            age = datetime.now() - change_date
            return age.days / 365.25
        except (ValueError, TypeError):
            return None
    
    def get_staleness_warning(self) -> Optional[str]:
        """
        Generate warning message if law is potentially outdated.
        
        Returns:
            Warning message string, or None if no warning needed
        """
        if self.status == LawStatus.REPEALED.value:
            if self.repealed_date:
                return f"⚠️ This law is no longer in force. It was repealed on {self.repealed_date}."
            return "⚠️ This law is no longer in force."
        
        if self.is_stale(2):
            if self.last_changed:
                return (
                    f"⚠️ This law version is from {self.last_changed}. "
                    "Amendments may have occurred. Verify current version."
                )
            return "⚠️ This law version may be outdated. Verify current version."
        
        if self.is_stale(1):
            if self.last_changed:
                return f"ℹ️ This law version is from {self.last_changed}."
            return None
        
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "law_id": self.law_id,
            "paragraph": self.paragraph,
            "content": self.content,
            "last_changed": self.last_changed,
            "status": self.status,
            "repealed_date": self.repealed_date,
            "source_url": self.source_url,
            "xml_version": self.xml_version,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LawMetadata":
        """Create from dictionary."""
        return cls(
            law_id=data.get("law_id", "unknown"),
            paragraph=data.get("paragraph", ""),
            content=data.get("content", ""),
            last_changed=data.get("last_changed"),
            status=data.get("status", LawStatus.IN_FORCE.value),
            repealed_date=data.get("repealed_date"),
            source_url=data.get("source_url"),
            xml_version=data.get("xml_version"),
        )


class VersionTracker:
    """
    Tracks and manages law version metadata for AI responses.
    
    Provides methods for:
    - Injecting metadata into AI prompts
    - Checking staleness of law versions
    - Generating version warnings
    - Validating metadata completeness
    """
    
    # Staleness thresholds (in years)
    STALE_THRESHOLD_RECENT = 1
    STALE_THRESHOLD_MODERATE = 2
    
    def __init__(self):
        self._cache: Dict[str, LawMetadata] = {}
        self._cache_hits = 0
        self._cache_misses = 0
    
    def get_metadata(self, law_result: Dict[str, Any]) -> LawMetadata:
        """
        Get metadata from a law result dictionary.
        
        Args:
            law_result: Dictionary containing law data and metadata
            
        Returns:
            LawMetadata object
        """
        # Check cache first
        cache_key = f"{law_result.get('law_id', '')}_{law_result.get('paragraph', '')}"
        if cache_key in self._cache:
            self._cache_hits += 1
            return self._cache[cache_key]
        
        self._cache_misses += 1
        
        # Extract metadata
        meta = law_result.get("meta", {})
        metadata = LawMetadata(
            law_id=law_result.get("law_id", "unknown"),
            paragraph=law_result.get("paragraph", ""),
            content=law_result.get("content", ""),
            last_changed=meta.get("last_changed"),
            status=meta.get("status", LawStatus.IN_FORCE.value),
            repealed_date=meta.get("repealed_date"),
            source_url=law_result.get("source_url"),
            xml_version=meta.get("xml_version"),
        )
        
        # Cache the metadata
        self._cache[cache_key] = metadata
        
        return metadata
    
    def prepare_context(self, law_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare law context with version metadata for AI.
        
        Args:
            law_result: Dictionary containing law data and metadata
            
        Returns:
            Dictionary with formatted context for AI prompt
        """
        metadata = self.get_metadata(law_result)
        
        return {
            "law_name": metadata.law_id.upper(),
            "paragraph": metadata.paragraph,
            "paragraph_text": metadata.content,
            "last_updated": metadata.last_changed or "unknown",
            "status": metadata.status,
            "repealed_date": metadata.repealed_date,
            "source_url": metadata.source_url or "",
            "age_years": metadata.get_age_years(),
        }
    
    def inject_version_warning(self, response: str, law_result: Dict[str, Any]) -> str:
        """
        Inject version warning into AI response if needed.
        
        Args:
            response: Original AI response
            law_result: Law result with metadata
            
        Returns:
            Response with version warning appended if needed
        """
        metadata = self.get_metadata(law_result)
        warning = metadata.get_staleness_warning()
        
        if warning:
            return f"{response}\n\n{warning}"
        
        return response
    
    def validate_metadata(self, law_result: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        Validate metadata completeness and correctness.
        
        Args:
            law_result: Law result to validate
            
        Returns:
            Tuple of (is_valid, warnings_list)
        """
        warnings = []
        metadata = self.get_metadata(law_result)
        
        # Check required fields
        if not metadata.law_id or metadata.law_id == "unknown":
            warnings.append("Missing or invalid law_id")
        
        if not metadata.paragraph:
            warnings.append("Missing paragraph number")
        
        if not metadata.content:
            warnings.append("Missing content")
        
        # Check metadata
        if not metadata.last_changed:
            warnings.append("Missing last_changed date")
        
        if metadata.status not in [s.value for s in LawStatus]:
            warnings.append(f"Invalid status: {metadata.status}")
        
        # Check for PII in content (shouldn't happen)
        if self._detect_potential_pii(metadata.content):
            warnings.append("Potential PII detected in content")
        
        # Check date format
        if metadata.last_changed:
            try:
                datetime.fromisoformat(metadata.last_changed)
            except ValueError:
                warnings.append(f"Invalid date format: {metadata.last_changed}")
        
        # Check repealed date consistency
        if metadata.status == LawStatus.REPEALED.value and not metadata.repealed_date:
            warnings.append("Status is 'repealed' but no repealed_date provided")
        
        return len(warnings) == 0, warnings
    
    def _detect_potential_pii(self, content: str) -> bool:
        """
        Detect potential PII in content.
        
        Args:
            content: Text to check
            
        Returns:
            True if potential PII detected, False otherwise
        """
        import re
        
        # Simple patterns for PII detection
        patterns = [
            r'\b\d{5}\s+.+\b',  # ZIP + street
            r'\b[A-Z]{1,3}\s*\d+\s*/\s*\d+\b',  # Case number
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email
        ]
        
        for pattern in patterns:
            if re.search(pattern, content):
                return True
        
        return False
    
    def build_version_prompt(self, law_result: Dict[str, Any]) -> str:
        """
        Build version information string for AI prompt.
        
        Args:
            law_result: Law result with metadata
            
        Returns:
            Formatted version information string
        """
        metadata = self.get_metadata(law_result)
        
        parts = []
        
        # Status
        status_emoji = {
            LawStatus.IN_FORCE.value: "✅",
            LawStatus.AMENDED.value: "⚠️",
            LawStatus.REPEALED.value: "❌",
        }
        parts.append(f"Status: {status_emoji.get(metadata.status, 'ℹ️')} {metadata.status}")
        
        # Last changed
        if metadata.last_changed:
            parts.append(f"Last Updated: {metadata.last_changed}")
        
        # Age
        age = metadata.get_age_years()
        if age is not None:
            if age < 1:
                parts.append(f"Age: {int(age * 12)} months")
            else:
                parts.append(f"Age: {age:.1f} years")
        
        return "\n".join(parts)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        total = self._cache_hits + self._cache_misses
        hit_rate = self._cache_hits / total if total > 0 else 0
        
        return {
            "cache_size": len(self._cache),
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": f"{hit_rate:.2%}",
        }
    
    def clear_cache(self):
        """Clear the metadata cache."""
        self._cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0
        logger.info("Version tracker cache cleared")


# Global version tracker instance
_version_tracker: Optional[VersionTracker] = None


def get_version_tracker() -> VersionTracker:
    """
    Get or create the global version tracker instance.
    
    Returns:
        VersionTracker instance
    """
    global _version_tracker
    if _version_tracker is None:
        _version_tracker = VersionTracker()
        logger.info("Version tracker initialized")
    return _version_tracker


def prepare_law_context(law_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to prepare law context with metadata.
    
    Args:
        law_result: Law result dictionary
        
    Returns:
        Dictionary with formatted context for AI prompt
    """
    tracker = get_version_tracker()
    return tracker.prepare_context(law_result)


def inject_version_warning(response: str, law_result: Dict[str, Any]) -> str:
    """
    Convenience function to inject version warning into response.
    
    Args:
        response: Original AI response
        law_result: Law result with metadata
        
    Returns:
        Response with version warning appended if needed
    """
    tracker = get_version_tracker()
    return tracker.inject_version_warning(response, law_result)


def validate_law_metadata(law_result: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Convenience function to validate law metadata.
    
    Args:
        law_result: Law result to validate
        
    Returns:
        Tuple of (is_valid, warnings_list)
    """
    tracker = get_version_tracker()
    return tracker.validate_metadata(law_result)


# Example usage
if __name__ == "__main__":
    # Test the version tracker
    test_law = {
        "law_id": "bgb",
        "paragraph": "§548",
        "content": "Der Vermieter hat die dem Mieter gestellte Sicherheit...",
        "meta": {
            "last_changed": "2023-06-15",
            "status": "in_force",
        },
        "source_url": "https://www.gesetze-im-internet.de/bgb/__548.html",
    }
    
    tracker = get_version_tracker()
    
    # Prepare context
    context = tracker.prepare_context(test_law)
    print("Context:")
    for key, value in context.items():
        print(f"  {key}: {value}")
    
    # Check staleness
    metadata = tracker.get_metadata(test_law)
    print(f"\nIs stale (2 years): {metadata.is_stale(2)}")
    print(f"Age: {metadata.get_age_years():.2f} years")
    
    # Get warning
    warning = metadata.get_staleness_warning()
    print(f"\nWarning: {warning}")
    
    # Validate
    is_valid, warnings = tracker.validate_metadata(test_law)
    print(f"\nValid: {is_valid}")
    if warnings:
        print(f"Warnings: {warnings}")
    
    # Cache stats
    print(f"\nCache stats: {tracker.get_cache_stats()}")
