"""
AI Guardrails Utility Module

Provides guardrail enforcement for AI responses including:
- PII detection and redaction
- Citation verification
- Disclaimer injection
- Response validation

Version: 1.0
Last Updated: 2026-02-25
"""

import re
import logging
import os
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime

# Import logging configuration
from logging_config import get_ai_logger, get_indexing_logger

# Try to import yaml for config loading
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

logger = get_ai_logger()
indexing_logger = get_indexing_logger()


# =============================================================================
# PII Detection
# =============================================================================

@dataclass
class PIIMatch:
    """Represents a detected PII instance."""
    type: str
    value: str
    position: int
    redacted: str


# PII patterns for detection
PII_PATTERNS = {
    "name": {
        # Match two or more capitalized words (handles German names with special chars)
        "pattern": r'\b[A-Z][A-Za-zäöüÄÖÜß]*(?:\s+[A-Z][A-Za-zäöüÄÖÜß]*)+\b',
        "description": "Capitalized names (Hans Müller)",
        "redact_to": "[NAME]",
    },
    "address": {
        # Match German ZIP codes (5 digits) followed by street
        "pattern": r'\b\d{5}\s+[A-Z][A-Za-zäöüÄÖÜß]*',
        "description": "ZIP + street (10115 Berlin)",
        "redact_to": "[ADDRESS]",
    },
    "case_number": {
        # Match various case number formats: 123/456, AZ: 123/456, Az. 789/2024
        "pattern": r'(?:AZ[:\s]*|Az\.?\s*)?\d+\s*/\s*\d+',
        "description": "Case number (AZ: 123/456)",
        "redact_to": "[CASE_NUMBER]",
    },
    "phone": {
        "pattern": r'\b\d{3,4}[/\s]?\d{3,}[/\s]?\d{2,4}\b',
        "description": "Phone numbers",
        "redact_to": "[PHONE]",
    },
    "email": {
        "pattern": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "description": "Email addresses",
        "redact_to": "[EMAIL]",
    },
    "date_of_birth": {
        "pattern": r'\b\d{1,2}\.\d{1,2}\.\d{4}\b',
        "description": "Date of birth (DD.MM.YYYY)",
        "redact_to": "[DATE_OF_BIRTH]",
    },
}

# Load PII patterns from config if available
def _load_pii_patterns_from_config():
    """Load PII patterns from guardrails.yaml config file."""
    global PII_PATTERNS
    
    if not YAML_AVAILABLE:
        return
    
    config_paths = [
        os.path.join(os.path.dirname(__file__), "Documentation and AI Instructions", "AI_CONFIG", "guardrails.yaml"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "Documentation and AI Instructions", "AI_CONFIG", "guardrails.yaml"),
    ]
    
    for config_path in config_paths:
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                
                pii_config = config.get('data_privacy', {}).get('pii_detection', {}).get('patterns', {})
                if pii_config:
                    PII_PATTERNS = {
                        name: {
                            "pattern": config_.get('regex', ''),
                            "description": config_.get('description', name),
                            "redact_to": config_.get('redact_to', f'[{name.upper()}]')
                        }
                        for name, config_ in pii_config.items()
                    }
                    logger.info(f"Loaded PII patterns from config: {config_path}")
                    return
        except Exception as e:
            logger.debug(f"Could not load PII config from {config_path}: {e}")
            continue

# Load config at module initialization
_load_pii_patterns_from_config()


def detect_pii(text: str) -> List[PIIMatch]:
    """
    Detect potential PII in text.
    
    Args:
        text: Text to scan for PII
        
    Returns:
        List of PIIMatch objects for detected PII
    """
    found = []
    
    for pii_type, config in PII_PATTERNS.items():
        pattern = config["pattern"]
        matches = re.finditer(pattern, text)
        
        for match in matches:
            found.append(PIIMatch(
                type=pii_type,
                value=match.group(),
                position=match.start(),
                redacted=config["redact_to"],
            ))
    
    return found


def redact_pii(text: str) -> str:
    """
    Redact all detected PII from text.
    
    Args:
        text: Text to redact
        
    Returns:
        Text with PII replaced by placeholders
    """
    redacted = text
    
    for pii_type, config in PII_PATTERNS.items():
        pattern = config["pattern"]
        redact_to = config["redact_to"]
        redacted = re.sub(pattern, redact_to, redacted)
    
    return redacted


def has_pii(text: str) -> bool:
    """
    Check if text contains any PII.
    
    Args:
        text: Text to check
        
    Returns:
        True if PII detected, False otherwise
    """
    return len(detect_pii(text)) > 0


def get_pii_types(text: str) -> List[str]:
    """
    Get list of PII types detected in text.
    
    Args:
        text: Text to check
        
    Returns:
        List of PII type names
    """
    matches = detect_pii(text)
    return list(set(m.type for m in matches))


# =============================================================================
# Citation Verification
# =============================================================================

def extract_citations(text: str) -> List[str]:
    """
    Extract all paragraph citations from text.
    
    Args:
        text: Text to extract citations from
        
    Returns:
        List of citation strings (e.g., ['§548', 'BGB §242'])
    """
    citations = []
    
    # Pattern 1: Simple paragraph (§548, § 548)
    simple_pattern = r'§\s*(\d+[a-z]*)'
    for match in re.finditer(simple_pattern, text, re.IGNORECASE):
        citations.append(f"§{match.group(1)}")
    
    # Pattern 2: Law code with paragraph (BGB §548)
    law_code_pattern = r'(BGB|StGB|GG|StPO|ZPO|VwVfG|OWiG|BetrVG|MuSchG|BEEG|SGB)\s*§\s*(\d+[a-z]*)'
    for match in re.finditer(law_code_pattern, text, re.IGNORECASE):
        citations.append(f"{match.group(1).upper()} §{match.group(2)}")
    
    # Pattern 3: Article (Art. 5 GG)
    article_pattern = r'Art\.?\s*(\d+)(?:\s*(GG|BGB|StGB))?'
    for match in re.finditer(article_pattern, text, re.IGNORECASE):
        article = f"Art. {match.group(1)}"
        if match.group(2):
            article += f" {match.group(2).upper()}"
        citations.append(article)
    
    return citations


def normalize_citation(citation: str) -> str:
    """
    Normalize citation format for comparison.
    
    Args:
        citation: Citation string to normalize
        
    Returns:
        Normalized citation string
    """
    # Remove extra spaces
    normalized = re.sub(r'\s+', ' ', citation.strip())
    
    # Standardize format
    normalized = normalized.replace("§ ", "§")
    normalized = normalized.replace("Art. ", "Art.")
    
    return normalized


def verify_citation(cited_paragraph: str, context: List[Dict[str, Any]]) -> bool:
    """
    Verify that a cited paragraph exists in the retrieved context.
    
    Args:
        cited_paragraph: Paragraph citation to verify
        context: List of law results from search
        
    Returns:
        True if citation found in context, False otherwise
    """
    cited_normalized = normalize_citation(cited_paragraph)
    
    for item in context:
        law_id = item.get("law_id", "").upper()
        paragraph = item.get("paragraph", "")
        paragraph_normalized = normalize_citation(paragraph)
        
        # Check full citation match
        if cited_normalized == paragraph_normalized:
            return True
        
        # Check paragraph-only match (if no law code in citation)
        if cited_normalized.startswith("§"):
            if paragraph_normalized.endswith(cited_normalized):
                return True
        
        # Check law code + paragraph match
        if law_id and cited_normalized.startswith(law_id):
            if paragraph_normalized in cited_normalized or cited_normalized in paragraph_normalized:
                return True
    
    return False


def sanitize_ai_response(ai_output: str, context: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """
    Verify and sanitize AI response to remove hallucinated citations.
    
    Args:
        ai_output: Raw AI response
        context: List of law results from search
        
    Returns:
        Tuple of (sanitized_text, warnings_list)
    """
    warnings = []
    sanitized = ai_output
    
    # Extract all citations
    citations = extract_citations(ai_output)
    
    # Verify each citation
    for citation in citations:
        if not verify_citation(citation, context):
            warnings.append(f"Removed unverified citation: {citation}")
            # Replace with generic reference
            sanitized = sanitized.replace(citation, "[paragraph not found in database]")
    
    return sanitized, warnings


# =============================================================================
# Disclaimer Injection
# =============================================================================

DISCLAIMER_SHORT = "⚖️ This information does not constitute legal advice."
DISCLAIMER_FULL = "⚖️ This information does not constitute legal advice. Consult a qualified German attorney (Rechtsanwalt) for your specific case."

DISCLAIMER_PATTERNS = ["⚖️", "legal advice", "Rechtsanwalt", "does not constitute"]


def has_disclaimer(text: str) -> bool:
    """
    Check if text contains a legal disclaimer.
    
    Args:
        text: Text to check
        
    Returns:
        True if disclaimer found, False otherwise
    """
    text_lower = text.lower()
    return any(pattern.lower() in text_lower for pattern in DISCLAIMER_PATTERNS)


def inject_disclaimer(response: str, context: str = "info") -> str:
    """
    Inject appropriate disclaimer based on context.
    
    Args:
        response: AI response text
        context: Context type ('info', 'explanation', 'analysis', 'serious')
        
    Returns:
        Response with disclaimer appended
    """
    # Don't add if already present
    if has_disclaimer(response):
        return response
    
    # Choose disclaimer based on context
    if context in ["explanation", "analysis", "serious"]:
        disclaimer = DISCLAIMER_FULL
    else:
        disclaimer = DISCLAIMER_SHORT
    
    return f"{response}\n\n{disclaimer}"


# =============================================================================
# Response Validation
# =============================================================================

@dataclass
class ValidationResult:
    """Result of response validation."""
    valid: bool
    sanitized_response: str
    warnings: List[str]
    errors: List[str]
    disclaimer_injected: bool


def check_prohibited_content(response: str) -> Optional[str]:
    """
    Check for prohibited content in response.
    
    Args:
        response: AI response to check
        
    Returns:
        Prohibited category if found, None otherwise
    """
    prohibited_patterns = {
        "personal_legal_advice": [
            r"you should\s+(file|sue|contact)",
            r"i recommend\s+(you|your)",
            r"mein rat ist",
        ],
        "court_prediction": [
            r"you will\s+(win|lose)",
            r"the court will\s+(rule|decide)",
            r"werden\s+(gewinnen|verlieren)",
        ],
        "attorney_recommendation": [
            r"contact\s+lawyer\s+\w+",
            r"hire\s+attorney\s+\w+",
            r"anwalt\s+\w+\s+empfehlen",
        ],
    }
    
    response_lower = response.lower()
    
    for category, patterns in prohibited_patterns.items():
        for pattern in patterns:
            if re.search(pattern, response_lower):
                return category
    
    return None


def validate_ai_response(
    response: str,
    context: List[Dict[str, Any]],
    user_query: str
) -> ValidationResult:
    """
    Complete validation pipeline for AI responses.
    
    Args:
        response: Raw AI response
        context: List of law results from search
        user_query: Original user query
        
    Returns:
        ValidationResult with validation results
    """
    result = ValidationResult(
        valid=True,
        sanitized_response=response,
        warnings=[],
        errors=[],
        disclaimer_injected=False,
    )
    
    # 1. Check for PII in response
    if has_pii(response):
        result.warnings.append("PII detected in response - redacted")
        result.sanitized_response = redact_pii(result.sanitized_response)
    
    # 2. Verify citations
    sanitized, citation_warnings = sanitize_ai_response(result.sanitized_response, context)
    result.sanitized_response = sanitized
    result.warnings.extend(citation_warnings)
    
    # 3. Check for disclaimer
    if not has_disclaimer(result.sanitized_response):
        result.sanitized_response = inject_disclaimer(result.sanitized_response, "explanation")
        result.disclaimer_injected = True
    
    # 4. Check for prohibited content
    prohibited = check_prohibited_content(result.sanitized_response)
    if prohibited:
        result.errors.append(f"Prohibited content detected: {prohibited}")
        result.valid = False
    
    return result


# =============================================================================
# PII Warning Response
# =============================================================================

PII_WARNING_TEMPLATE = """⚠️ PRIVACY NOTICE

For your protection, please avoid sharing:
- Names (your name, other parties)
- Addresses or locations
- Case numbers or file references
- Dates of birth or personal identifiers

I've processed your question, but future messages should describe 
the situation generally without personal information.

Example:
✅ "My rental agreement was terminated"
❌ "My landlord Hans Müller at Berliner Str. 123 terminated my lease"

⚖️ This information does not constitute legal advice."""


def get_pii_warning_response(detected_types: List[str]) -> str:
    """
    Generate PII warning response.
    
    Args:
        detected_types: List of PII types detected
        
    Returns:
        Formatted warning response
    """
    type_names = {
        "name": "names",
        "address": "addresses",
        "case_number": "case numbers",
        "phone": "phone numbers",
        "email": "email addresses",
        "date_of_birth": "dates of birth",
    }
    
    detected_names = [type_names.get(t, t) for t in detected_types]
    
    if detected_names:
        intro = f"We detected personal information in your message: {', '.join(detected_names)}.\n\n"
    else:
        intro = ""
    
    return intro + PII_WARNING_TEMPLATE


# =============================================================================
# Ambiguous Query Response
# =============================================================================

AMBIGUOUS_QUERY_TEMPLATE = """Your query could relate to multiple legal areas. To help you better:

🔍 POSSIBLE INTERPRETATIONS:
{interpretations}

⚠️ IMPORTANT: When clarifying, please do NOT provide:
- Names (your name, landlord's name, employer's name)
- Addresses or locations
- Case numbers or file references
- Dates of birth or personal identifiers

Instead, describe the general situation:
✅ "My rental agreement was terminated"
❌ "My landlord Hans Müller at Berliner Str. 123 terminated my lease"

Please clarify which area applies to your situation.

⚖️ This information does not constitute legal advice."""


def get_ambiguous_query_response(interpretations: List[str]) -> str:
    """
    Generate ambiguous query response.
    
    Args:
        interpretations: List of possible interpretations
        
    Returns:
        Formatted response with options
    """
    formatted = "\n".join(f"{i+1}. {interp}" for i, interp in enumerate(interpretations))
    return AMBIGUOUS_QUERY_TEMPLATE.format(interpretations=formatted)


# =============================================================================
# Logging
# =============================================================================

def log_guardrail_action(
    session_id: str,
    action: str,
    details: Dict[str, Any],
    query_hash: Optional[str] = None
):
    """
    Log guardrail action for auditing.
    
    Args:
        session_id: Session identifier
        action: Action taken
        details: Action details
        query_hash: Hashed user query for reference
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "session_id": session_id,
        "action": action,
        "details": details,
        "query_hash": query_hash,
    }
    
    if action.startswith("pii_"):
        logger.warning(f"PII guardrail triggered: {action}")
    elif action.startswith("citation_"):
        indexing_logger.info(f"Citation guardrail: {action}")
    elif action.startswith("disclaimer_"):
        logger.info(f"Disclaimer guardrail: {action}")
    else:
        logger.info(f"Guardrail action: {action}")


# =============================================================================
# Convenience Functions
# =============================================================================

def process_ai_response(
    response: str,
    context: List[Dict[str, Any]],
    query: str,
    session_id: str = "unknown"
) -> Tuple[str, List[str], List[str]]:
    """
    Process AI response through all guardrails.
    
    Args:
        response: Raw AI response
        context: Search context for citation verification
        query: Original user query
        session_id: Session identifier for logging
        
    Returns:
        Tuple of (processed_response, warnings, errors)
    """
    # Validate response
    result = validate_ai_response(response, context, query)
    
    # Log validation results
    if result.warnings:
        log_guardrail_action(
            session_id,
            "validation_warnings",
            {"warnings": result.warnings},
            hash(query)
        )
    
    if result.errors:
        log_guardrail_action(
            session_id,
            "validation_errors",
            {"errors": result.errors},
            hash(query)
        )
    
    return result.sanitized_response, result.warnings, result.errors


def check_query_for_pii(query: str) -> Tuple[bool, List[str], Optional[str]]:
    """
    Check user query for PII and generate warning if needed.
    
    Args:
        query: User query to check
        
    Returns:
        Tuple of (has_pii, detected_types, warning_response)
    """
    detected = get_pii_types(query)
    
    if detected:
        return True, detected, get_pii_warning_response(detected)
    
    return False, [], None


# =============================================================================
# Module Initialization
# =============================================================================

def init_guardrails():
    """Initialize guardrail system."""
    logger.info("AI Guardrails initialized")
    indexing_logger.info("Citation verification ready")


# Auto-initialize on import
init_guardrails()


if __name__ == "__main__":
    # Test the guardrails
    print("Testing AI Guardrails...")
    
    # Test PII detection
    test_query = "My landlord Hans Müller at Berliner Str. 123 won't return deposit"
    has_pii_result, types, warning = check_query_for_pii(test_query)
    print(f"\nPII Test: {has_pii_result}")
    print(f"Types: {types}")
    print(f"Warning: {warning[:100]}...")
    
    # Test citation extraction
    test_response = "Under BGB §548 and §549, the landlord must return the deposit."
    citations = extract_citations(test_response)
    print(f"\nCitations extracted: {citations}")
    
    # Test citation verification
    test_context = [
        {"law_id": "bgb", "paragraph": "§548", "content": "Deposit rules..."},
    ]
    for citation in citations:
        verified = verify_citation(citation, test_context)
        print(f"Citation {citation}: {'✓' if verified else '✗'}")
    
    # Test disclaimer injection
    test_no_disclaimer = "The landlord must return the deposit under BGB §548."
    with_disclaimer = inject_disclaimer(test_no_disclaimer, "explanation")
    print(f"\nWith disclaimer:\n{with_disclaimer}")
    
    # Test full validation
    print("\n--- Full Validation Test ---")
    result = validate_ai_response(test_no_disclaimer, test_context, "Deposit?")
    print(f"Valid: {result.valid}")
    print(f"Warnings: {result.warnings}")
    print(f"Errors: {result.errors}")
    print(f"Disclaimer injected: {result.disclaimer_injected}")
    print(f"Sanitized:\n{result.sanitized_response}")
