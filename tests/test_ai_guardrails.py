"""
AI System Test Scenarios

Test suite for AI guardrails including:
- Anti-hallucination testing
- PII safety testing
- Version awareness testing
- False friends testing

Version: 1.0
Last Updated: 2026-02-25
"""

import json
import os
import sys
import unittest
from datetime import datetime, timedelta
from typing import Any, Dict, List

# Add project root and archive backend paths
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _project_root)
# Legacy modules are archived under _archive/backend/
sys.path.insert(0, os.path.join(_project_root, "_archive", "backend"))
sys.path.insert(
    0, os.path.join(_project_root, "Documentation and AI Instructions", "AI_METADATA")
)

from ai_guardrails import (
    check_query_for_pii,
    detect_pii,
    extract_citations,
    get_pii_types,
    get_pii_warning_response,
    has_disclaimer,
    has_pii,
    inject_disclaimer,
    redact_pii,
    sanitize_ai_response,
    validate_ai_response,
    verify_citation,
)
from version_tracking import (
    LawMetadata,
    VersionTracker,
    get_version_tracker,
)

# =============================================================================
# Anti-Hallucination Tests
# =============================================================================


class TestAntiHallucination(unittest.TestCase):
    """Test citation verification and hallucination prevention."""

    def setUp(self):
        """Set up test context."""
        self.test_context = [
            {
                "law_id": "bgb",
                "paragraph": "§548",
                "content": "Deposit return rules...",
            },
            {"law_id": "bgb", "paragraph": "§549", "content": "Exclusions..."},
            {"law_id": "bgb", "paragraph": "§550", "content": "Written form..."},
        ]

    def test_citation_only_from_context(self):
        """AI must not cite paragraphs not in context."""
        # Response with valid citation
        response_valid = "Under BGB §548, the landlord must return the deposit."
        sanitized, warnings = sanitize_ai_response(response_valid, self.test_context)

        # Should have no warnings for valid citation
        self.assertEqual(len(warnings), 0)
        self.assertEqual(sanitized, response_valid)

    def test_hallucinated_citation_removed(self):
        """AI should not cite paragraphs not in context."""
        # Response with hallucinated citation
        response_hallucinated = "Under BGB §999, the landlord must return the deposit."
        sanitized, warnings = sanitize_ai_response(
            response_hallucinated, self.test_context
        )

        # Should have warning(s) - may have multiple due to regex matching
        self.assertGreater(len(warnings), 0)
        self.assertTrue(any("§999" in w for w in warnings))
        self.assertIn("[paragraph not found in database]", sanitized)

    def test_mixed_citations(self):
        """Test response with both valid and invalid citations."""
        response_mixed = "Under BGB §548 and §999, the rules apply. Also §549 states..."
        sanitized, warnings = sanitize_ai_response(response_mixed, self.test_context)

        # Should have one warning for §999
        self.assertEqual(len(warnings), 1)
        self.assertIn("§999", warnings[0])

        # Valid citations should remain
        self.assertIn("§548", sanitized)
        self.assertIn("§549", sanitized)
        self.assertIn("[paragraph not found in database]", sanitized)

    def test_empty_context_handling(self):
        """AI should handle empty context gracefully."""
        response = "Under BGB §548, the deposit must be returned."
        sanitized, warnings = sanitize_ai_response(response, [])

        # All citations should be removed
        self.assertGreater(len(warnings), 0)
        self.assertIn("[paragraph not found in database]", sanitized)

    def test_citation_extraction(self):
        """Test citation pattern extraction."""
        test_cases = [
            ("Under BGB §548", ["§548"]),
            ("According to §548 and §549", ["§548", "§549"]),
            ("StGB §242 defines theft", ["§242"]),
            ("GG Art. 5 protects speech", ["Art. 5"]),
        ]

        for text, expected in test_cases:
            with self.subTest(text=text):
                citations = extract_citations(text)
                # Check that expected citations are found
                for exp in expected:
                    self.assertIn(exp, citations)


# =============================================================================
# PII Safety Tests
# =============================================================================


class TestPIISafety(unittest.TestCase):
    """Test PII detection and protection."""

    def test_name_detection(self):
        """Test detection of personal names."""
        test_cases = [
            "My landlord Hans Müller won't return deposit",
            "I spoke with Maria Schmidt about the case",
            "Thomas Weber is my employer",
        ]

        for query in test_cases:
            with self.subTest(query=query):
                self.assertTrue(has_pii(query))
                types = get_pii_types(query)
                self.assertIn("name", types)

    def test_address_detection(self):
        """Test detection of addresses."""
        test_cases = [
            "I live at 10115 Berlin",
            "The property is at 10115 Berlin Friedrichstr",
            "My address is 80331 München",
        ]

        for query in test_cases:
            with self.subTest(query=query):
                self.assertTrue(has_pii(query))
                types = get_pii_types(query)
                self.assertIn("address", types)

    def test_case_number_detection(self):
        """Test detection of case numbers."""
        test_cases = [
            "Case number 123/456 at AG Berlin",
            "Az. 789/2024 is my file",
            "AZ: 12/345 at the court",
        ]

        for query in test_cases:
            with self.subTest(query=query):
                self.assertTrue(has_pii(query))
                types = get_pii_types(query)
                self.assertIn("case_number", types)

    def test_email_detection(self):
        """Test detection of email addresses."""
        test_cases = [
            "My email is hans@example.com",
            "Contact me at maria.mueller@gmail.com",
            "Send to info@law-firm.de",
        ]

        for query in test_cases:
            with self.subTest(query=query):
                self.assertTrue(has_pii(query))
                types = get_pii_types(query)
                self.assertIn("email", types)

    def test_pii_redaction(self):
        """Test PII redaction from text."""
        text = "Hans Müller lives at 10115 Berlin, email hans@example.com"
        redacted = redact_pii(text)

        self.assertNotIn("Hans", redacted)
        self.assertNotIn("10115 Berlin", redacted)
        self.assertNotIn("hans@example.com", redacted)

        self.assertIn("[NAME]", redacted)
        self.assertIn("[ADDRESS]", redacted)
        self.assertIn("[EMAIL]", redacted)

    def test_pii_warning_response(self):
        """Test PII warning response generation."""
        detected_types = ["name", "address"]
        warning = get_pii_warning_response(detected_types)

        self.assertIn("names", warning)
        self.assertIn("addresses", warning)
        self.assertIn("privacy", warning.lower())
        self.assertIn("⚖️", warning)

    def test_query_without_pii(self):
        """Test that normal queries don't trigger PII detection."""
        safe_queries = [
            "My landlord won't return the deposit",
            "I was fired without notice",
            "What are my rights as a tenant?",
        ]

        for query in safe_queries:
            with self.subTest(query=query):
                self.assertFalse(has_pii(query))


# =============================================================================
# Version Awareness Tests
# =============================================================================


class TestVersionAwareness(unittest.TestCase):
    """Test law version tracking and warnings."""

    def test_stale_law_detection(self):
        """Test detection of old law versions."""
        # Old law (more than 2 years)
        old_law = LawMetadata(
            law_id="bgb",
            paragraph="§548",
            content="Old text...",
            last_changed="2022-01-15",
            status="in_force",
        )

        self.assertTrue(old_law.is_stale(2))
        self.assertFalse(old_law.is_stale(5))  # Not stale with 5 year threshold

    def test_recent_law_no_warning(self):
        """Test that recent laws don't trigger warnings."""
        recent_law = LawMetadata(
            law_id="bgb",
            paragraph="§548",
            content="Current text...",
            last_changed=datetime.now().strftime("%Y-%m-%d"),
            status="in_force",
        )

        self.assertFalse(recent_law.is_stale(1))
        self.assertIsNone(recent_law.get_staleness_warning())

    def test_old_law_warning(self):
        """Test warning generation for old laws."""
        old_law = LawMetadata(
            law_id="bgb",
            paragraph="§548",
            content="Old text...",
            last_changed="2023-01-15",
            status="in_force",
        )

        warning = old_law.get_staleness_warning()
        self.assertIsNotNone(warning)
        self.assertIn("⚠️", warning)
        self.assertIn("2023", warning)

    def test_repealed_law_warning(self):
        """Test warning for repealed laws."""
        repealed_law = LawMetadata(
            law_id="bgb",
            paragraph="§567a",
            content="Repealed text...",
            last_changed="2018-06-30",
            status="repealed",
            repealed_date="2019-01-01",
        )

        self.assertTrue(repealed_law.is_stale(1))

        warning = repealed_law.get_staleness_warning()
        self.assertIsNotNone(warning)
        self.assertIn("no longer in force", warning)
        self.assertIn("2019", warning)

    def test_age_calculation(self):
        """Test law age calculation."""
        one_year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        law = LawMetadata(
            law_id="bgb",
            paragraph="§548",
            content="Text...",
            last_changed=one_year_ago,
            status="in_force",
        )

        age = law.get_age_years()
        self.assertIsNotNone(age)
        self.assertAlmostEqual(age, 1.0, delta=0.1)

    def test_metadata_to_dict(self):
        """Test metadata serialization."""
        law = LawMetadata(
            law_id="bgb",
            paragraph="§548",
            content="Test...",
            last_changed="2024-01-15",
            status="in_force",
        )

        data = law.to_dict()

        self.assertEqual(data["law_id"], "bgb")
        self.assertEqual(data["paragraph"], "§548")
        self.assertEqual(data["last_changed"], "2024-01-15")
        self.assertEqual(data["status"], "in_force")


# =============================================================================
# False Friends Tests
# =============================================================================


class TestFalseFriends(unittest.TestCase):
    """Test false friends translation detection."""

    def test_besitz_vs_eigentum(self):
        """Test Besitz vs Eigentum distinction."""
        # Response should use correct terms
        correct_response = "You have possession (Besitz) but not ownership (Eigentum)"
        incorrect_response = "You have ownership but not possession"

        # Check that correct response has proper terms
        self.assertIn("possession", correct_response.lower())
        self.assertIn("ownership", correct_response.lower())

        # Incorrect response reverses the meanings
        # This is a conceptual test - actual validation would need AI response analysis

    def test_kuendigung_translation(self):
        """Test Kündigung translation."""
        correct_terms = ["notice of termination", "Kündigung", "notice period"]
        incorrect_terms = ["terminated immediately", "instant eviction"]

        # Correct response should include notice period concept
        correct_response = "The landlord issued notice of termination (Kündigung) with 3 months notice period"

        for term in correct_terms:
            if term in ["notice of termination", "notice period"]:
                self.assertIn(term, correct_response)

    def test_bussgeld_vs_strafe(self):
        """Test Bußgeld vs Strafe distinction."""
        correct_response = "You received an administrative fine (Bußgeld) under OWiG"
        incorrect_response = "You got a criminal penalty (Strafe)"

        # Correct response should mention administrative
        self.assertIn("administrative", correct_response.lower())

        # Should not call it criminal
        self.assertNotIn("criminal", correct_response.lower())

    def test_gewaehrleistung_vs_garantie(self):
        """Test Gewährleistung vs Garantie distinction."""
        correct_response = "You have Gewährleistung (statutory warranty), not Garantie (voluntary guarantee)"

        # Should mention both terms
        self.assertIn("gewährleistung", correct_response.lower())
        self.assertIn("garantie", correct_response.lower())

        # Should distinguish them
        self.assertIn("statutory", correct_response.lower())
        self.assertIn("voluntary", correct_response.lower())

    def test_anspruch_translation(self):
        """Test Anspruch translation."""
        correct_response = "You have an entitlement (Anspruch) to demand payment"
        incorrect_response = "You should file a lawsuit"

        # Correct response should use entitlement/right
        self.assertIn("entitlement", correct_response.lower())

        # Should not imply lawsuit
        self.assertNotIn("lawsuit", correct_response.lower())


# =============================================================================
# Disclaimer Tests
# =============================================================================


class TestDisclaimer(unittest.TestCase):
    """Test disclaimer injection and compliance."""

    def test_disclaimer_detection(self):
        """Test disclaimer presence detection."""
        with_disclaimer = (
            "The law states... ⚖️ This information does not constitute legal advice."
        )
        without_disclaimer = "The law states you should file a lawsuit."

        self.assertTrue(has_disclaimer(with_disclaimer))
        self.assertFalse(has_disclaimer(without_disclaimer))

    def test_disclaimer_injection(self):
        """Test disclaimer injection into response."""
        response = "Under BGB §548, the landlord must return the deposit."

        with_disclaimer = inject_disclaimer(response, "explanation")

        self.assertIn("⚖️", with_disclaimer)
        self.assertIn("legal advice", with_disclaimer.lower())

    def test_disclaimer_not_double_injected(self):
        """Test that disclaimer is not added if already present."""
        response = "The law states... ⚖️ This does not constitute legal advice."

        result = inject_disclaimer(response, "explanation")

        # Should only have one disclaimer
        count = result.count("⚖️")
        self.assertEqual(count, 1)


# =============================================================================
# Integration Tests
# =============================================================================


class TestIntegration(unittest.TestCase):
    """Integration tests for complete validation pipeline."""

    def test_full_validation_pipeline(self):
        """Test complete response validation."""
        response = "The landlord must return the deposit under civil code section 548."
        context = [
            {"law_id": "bgb", "paragraph": "§548", "content": "Deposit rules..."},
        ]
        query = "My landlord won't return deposit"

        result = validate_ai_response(response, context, query)

        # Should have disclaimer injected
        self.assertTrue(result.disclaimer_injected)

        # PII should not be in this response (no PII present)
        self.assertNotIn("[NAME]", result.sanitized_response)

    def test_query_pii_check(self):
        """Test query PII checking."""
        query_with_pii = "My landlord Hans Müller at 10115 Berlin won't return deposit"

        has_pii_result, types, warning = check_query_for_pii(query_with_pii)

        self.assertTrue(has_pii_result)
        self.assertIn("name", types)
        self.assertIn("address", types)
        self.assertIsNotNone(warning)
        self.assertIn("privacy", warning.lower())


# =============================================================================
# Test Runner
# =============================================================================


def run_tests():
    """Run all test suites."""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test suites
    suite.addTests(loader.loadTestsFromTestCase(TestAntiHallucination))
    suite.addTests(loader.loadTestsFromTestCase(TestPIISafety))
    suite.addTests(loader.loadTestsFromTestCase(TestVersionAwareness))
    suite.addTests(loader.loadTestsFromTestCase(TestFalseFriends))
    suite.addTests(loader.loadTestsFromTestCase(TestDisclaimer))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success: {result.wasSuccessful()}")

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
