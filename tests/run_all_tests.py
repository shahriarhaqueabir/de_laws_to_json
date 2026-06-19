#!/usr/bin/env python3
"""
German Law Translation System - Test Suite Runner

This script runs all available tests for the German Law translation system.

Usage:
    python run_all_tests.py [--quick] [--verbose] [--test=NAME]

Options:
    --quick     Run only quick tests (skip AI/translation tests)
    --verbose   Show detailed output
    --test=NAME Run only specific test (e.g., --test=translation)

Available Tests:
    - dictionary: Dictionary lookup tests
    - dict_detailed: Detailed dictionary tests
    - diagnostic: Translation diagnostic tests
    - unified: Unified translation system tests
    - qa: Comprehensive QA review
    - broker: Broker API tests
    - create_qdrant: Qdrant collection creation tests
    - extract_metadata: Law metadata extraction tests
    - seed_qdrant: Qdrant seeding tests
    - download: Download pipeline tests
    - process: XML processing pipeline tests
    - dedupe: Data deduplication tests
    - payload_formats: JSON payload format validation
    - download_verify: Download source verification
    - data_pipeline: Data pipeline E2E validation
    - log_stream: Log stream validation
    - migrations: Supabase migration SQL validation
"""

import argparse
import os
import sys
import time
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Test configuration
TESTS = {
    "dictionary": {
        "file": "test_dict_lookup.py",
        "description": "Dictionary lookup tests",
        "quick": True,
    },
    "dict_detailed": {
        "file": "test_dict_detailed.py",
        "description": "Detailed dictionary tests",
        "quick": True,
    },
    "diagnostic": {
        "file": "test_translation_diagnostic.py",
        "description": "Translation diagnostic tests",
        "quick": False,
    },
    "unified": {
        "file": "test_unified_translation.py",
        "description": "Unified translation system tests",
        "quick": False,
    },
    "qa": {
        "file": "qa_translation_review.py",
        "description": "Comprehensive QA review",
        "quick": False,
    },
    "broker": {
        "file": "test_broker.py",
        "description": "Broker API tests",
        "quick": False,
    },
    "create_qdrant": {
        "file": "test_create_qdrant_collection.py",
        "description": "Qdrant collection creation tests",
        "quick": True,
    },
    "extract_metadata": {
        "file": "test_extract_laws_metadata.py",
        "description": "Law metadata extraction tests",
        "quick": True,
    },
    "seed_qdrant": {
        "file": "test_seed_norms_to_qdrant.py",
        "description": "Qdrant seeding tests",
        "quick": True,
    },
    "download": {
        "file": "test_download_de_laws.py",
        "description": "Download pipeline tests",
        "quick": True,
    },
    "process": {
        "file": "test_process_de_laws.py",
        "description": "XML processing pipeline tests",
        "quick": True,
    },
    "dedupe": {
        "file": "test_dedupe_processed_data.py",
        "description": "Data deduplication tests",
        "quick": True,
    },
    "payload_formats": {
        "file": "test_payload_formats.py",
        "description": "JSON payload format validation",
        "quick": True,
    },
    "download_verify": {
        "file": "test_download_verification.py",
        "description": "Download source verification",
        "quick": False,
    },
    "data_pipeline": {
        "file": "test_data_pipeline.py",
        "description": "Data pipeline E2E validation",
        "quick": True,
    },
    "log_stream": {
        "file": "test_log_stream.py",
        "description": "Log stream validation",
        "quick": True,
    },
    "migrations": {
        "file": "test_supabase_migrations.py",
        "description": "Supabase migration SQL validation",
        "quick": True,
    },
    "ai_guardrails": {
        "file": "test_ai_guardrails.py",
        "description": "AI guardrails (anti-hallucination, PII safety, version awareness, false friends)",
        "quick": True,
    },
    "system_settings": {
        "file": "test_system_settings.py",
        "description": "System settings and server status verification",
        "quick": True,
    },
}


def print_header():
    """Print test suite header."""
    print("\n" + "=" * 80)
    print("GERMAN LAW TRANSLATION SYSTEM - TEST SUITE")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python: {sys.version.split()[0]}")
    print(f"Working Directory: {os.getcwd()}")
    print("=" * 80)


def print_test_info(name, test_info):
    """Print information about a test."""
    print(f"\n{'─' * 80}")
    print(f"TEST: {name.upper()}")
    print(f"File: {test_info['file']}")
    print(f"Description: {test_info['description']}")
    print(f"Quick test: {'Yes' if test_info['quick'] else 'No'}")
    print(f"{'─' * 80}\n")


def run_test(name, test_info, verbose=False):
    """
    Run a single test file.

    Returns:
        tuple: (success: bool, duration: float)
    """
    test_file = test_info["file"]
    test_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), test_file)

    if not os.path.exists(test_path):
        print(f"⚠️  Test file not found: {test_file}")
        return False, 0.0

    print_test_info(name, test_info)

    start_time = time.time()

    try:
        # Run the test file
        import subprocess

        result = subprocess.run(
            [sys.executable, test_path],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=not verbose,
            text=True,
            timeout=300,  # 5 minute timeout per test
        )

        duration = time.time() - start_time

        if result.returncode == 0:
            print(f"\n✅ {name.upper()} PASSED ({duration:.2f}s)")
            if not verbose and result.stdout:
                # Show last few lines of output
                lines = result.stdout.strip().split("\n")
                if len(lines) > 5:
                    print("\nLast 5 lines of output:")
                    for line in lines[-5:]:
                        print(f"  {line}")
            return True, duration
        else:
            print(f"\n❌ {name.upper()} FAILED ({duration:.2f}s)")
            if not verbose:
                if result.stderr:
                    print(f"\nError output:\n{result.stderr}")
                if result.stdout:
                    print(f"\nOutput:\n{result.stdout[-500:]}")  # Last 500 chars
            return False, duration

    except subprocess.TimeoutExpired:
        duration = time.time() - start_time
        print(f"\n❌ {name.upper()} TIMEOUT ({duration:.2f}s)")
        return False, duration
    except Exception as e:
        duration = time.time() - start_time
        print(f"\n❌ {name.upper()} ERROR: {e} ({duration:.2f}s)")
        return False, duration


def run_all_tests(quick_only=False, verbose=False, specific_test=None):
    """
    Run all tests or specific test.

    Args:
        quick_only: If True, skip slow tests
        verbose: If True, show detailed output
        specific_test: If set, run only this test
    """
    print_header()

    results = {
        "passed": [],
        "failed": [],
        "skipped": [],
        "durations": {},
    }

    # Determine which tests to run
    tests_to_run = []
    for name, info in TESTS.items():
        if specific_test and name != specific_test:
            continue
        if quick_only and not info["quick"]:
            results["skipped"].append(name)
            continue
        tests_to_run.append((name, info))

    if not tests_to_run:
        print("\n⚠️  No tests to run!")
        return results

    print(f"\n📋 Test Plan:")
    print(f"   Total tests: {len(tests_to_run)}")
    if results["skipped"]:
        print(f"   Skipped (slow): {len(results['skipped'])}")
    print()

    # Run tests
    total_start = time.time()

    for name, info in tests_to_run:
        success, duration = run_test(name, info, verbose)
        results["durations"][name] = duration

        if success:
            results["passed"].append(name)
        else:
            results["failed"].append(name)

    total_duration = time.time() - total_start

    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total duration: {total_duration:.2f}s")
    print(f"Passed: {len(results['passed'])}")
    print(f"Failed: {len(results['failed'])}")
    print(f"Skipped: {len(results['skipped'])}")

    if results["passed"]:
        print(f"\n✅ Passed ({len(results['passed'])}):")
        for name in results["passed"]:
            duration = results["durations"].get(name, 0)
            print(f"   • {name} ({duration:.2f}s)")

    if results["failed"]:
        print(f"\n❌ Failed ({len(results['failed'])}):")
        for name in results["failed"]:
            print(f"   • {name}")

    if results["skipped"]:
        print(f"\n⏭️  Skipped ({len(results['skipped'])}):")
        for name in results["skipped"]:
            print(f"   • {name}")

    print("\n" + "=" * 80)

    # Final status
    if not results["failed"] and results["passed"]:
        print("🎉 ALL TESTS PASSED!")
        return results
    elif results["failed"]:
        print(f"⚠️  {len(results['failed'])} TEST(S) FAILED")
        return results
    else:
        print("⚠️  NO TESTS WERE RUN")
        return results


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run German Law translation system tests"
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run only quick tests (skip AI/translation tests)",
    )
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    parser.add_argument(
        "--test", type=str, choices=list(TESTS.keys()), help="Run only specific test"
    )

    args = parser.parse_args()

    results = run_all_tests(
        quick_only=args.quick, verbose=args.verbose, specific_test=args.test
    )

    # Exit with appropriate code
    if results["failed"]:
        sys.exit(1)
    elif not results["passed"] and not results["skipped"]:
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
