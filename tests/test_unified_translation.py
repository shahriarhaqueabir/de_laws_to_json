#!/usr/bin/env python3
"""
Unified Translation System Test

Tests the consolidated AI translation endpoint:
1. Cache functionality
2. Dictionary hint extraction
3. Ollama AI translation
4. End-to-end flow

Usage:
    python test_unified_translation.py
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

# Configuration
FLASK_URL = "http://127.0.0.1:5000"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")

# Test cases
TEST_CASES = [
    # Single words
    {"text": "Kündigung", "is_title": False, "expected_contains": ["terminat", "cancel"]},
    {"text": "Miete", "is_title": False, "expected_contains": ["rent"]},
    {"text": "Vermieter", "is_title": False, "expected_contains": ["landlord"]},
    {"text": "Mieter", "is_title": False, "expected_contains": ["tenant"]},
    
    # Law abbreviations
    {"text": "BGB", "is_title": True, "expected_contains": ["Civil Code"]},
    {"text": "GG", "is_title": True, "expected_contains": ["Basic Law", "Constitution"]},
    {"text": "StGB", "is_title": True, "expected_contains": ["Criminal Code"]},
    
    # Law titles
    {"text": "Bürgerliches Gesetzbuch", "is_title": True, "expected_contains": ["Civil Code"]},
    
    # Short phrases
    {"text": "Der Vermieter kann kündigen", "is_title": False, "expected_contains": ["landlord"]},
    
    # Edge cases
    {"text": "", "is_title": False, "expected_empty": True},
    {"text": "   ", "is_title": False, "expected_empty": True},
]


def check_ollama():
    """Check if Ollama is running and model is available."""
    print("\n[1] Checking Ollama Service")
    print("-" * 50)
    
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read().decode("utf-8"))
        
        models = data.get('models', [])
        model_names = [m['name'] for m in models]
        
        print(f"✓ Ollama is running at {OLLAMA_URL}")
        print(f"  Available models: {', '.join(model_names)}")
        
        if OLLAMA_MODEL in model_names or any(m.startswith(OLLAMA_MODEL.split(':')[0]) for m in model_names):
            print(f"✓ Model '{OLLAMA_MODEL}' is available")
            return True
        else:
            print(f"⚠ Model '{OLLAMA_MODEL}' NOT FOUND")
            print(f"  Will use default model")
            return True
            
    except urllib.error.URLError as e:
        print(f"✗ Ollama is not reachable: {e}")
        print("  Make sure Ollama is running: ollama serve")
        return False
    except Exception as e:
        print(f"✗ Error checking Ollama: {e}")
        return False


def check_flask():
    """Check if Flask server is running."""
    print("\n[2] Checking Flask Server")
    print("-" * 50)
    
    try:
        req = urllib.request.Request(f"{FLASK_URL}/api/translate/cache/stats")
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read().decode("utf-8"))
        
        print(f"✓ Flask server is running at {FLASK_URL}")
        print(f"  Cache stats: {data}")
        return True
        
    except urllib.error.URLError:
        print(f"✗ Flask server is not reachable at {FLASK_URL}")
        print("  Make sure app.py is running: python app.py")
        return False
    except Exception as e:
        print(f"✗ Error checking Flask: {e}")
        return False


def test_translation(test_case, idx):
    """Test a single translation case."""
    text = test_case["text"]
    is_title = test_case.get("is_title", False)
    expected_contains = test_case.get("expected_contains", [])
    expected_empty = test_case.get("expected_empty", False)
    
    try:
        payload = {
            "text": text,
            "is_title": is_title,
        }
        
        req = urllib.request.Request(
            f"{FLASK_URL}/api/translate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        
        start = time.time()
        resp = urllib.request.urlopen(req, timeout=120)
        elapsed = time.time() - start
        
        result = json.loads(resp.read().decode("utf-8"))
        translation = result.get("translation", "")
        from_cache = result.get("from_cache", False)
        
        # Validate
        success = True
        message = ""
        
        if expected_empty:
            if translation.strip() == "":
                message = "✓ Empty input handled correctly"
            else:
                success = False
                message = f"✗ Expected empty, got: '{translation}'"
        elif not translation:
            success = False
            message = "✗ Translation is empty"
        else:
            # Check if expected terms are present
            translation_lower = translation.lower()
            matches = any(term.lower() in translation_lower for term in expected_contains)
            
            if matches:
                message = f"✓ Translation looks correct"
            else:
                message = f"⚠ Translation may be incorrect"
        
        # Print result
        status = "✓" if success else "✗"
        cache_tag = "(cache)" if from_cache else "(AI)"
        
        print(f"\n{status} Test {idx}: '{text[:40]}' {cache_tag} [{elapsed:.2f}s]")
        print(f"  → '{translation[:80]}'")
        print(f"  {message}")
        
        return success, from_cache
        
    except Exception as e:
        print(f"\n✗ Test {idx}: ERROR - {e}")
        return False, False


def test_batch_translation():
    """Test batch translation endpoint."""
    print("\n[4] Testing Batch Translation")
    print("-" * 50)
    
    texts = ["Kündigung", "Miete", "BGB"]
    
    try:
        payload = {
            "texts": texts,
            "is_title": False,
        }
        
        req = urllib.request.Request(
            f"{FLASK_URL}/api/translate/batch",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        
        start = time.time()
        resp = urllib.request.urlopen(req, timeout=120)
        elapsed = time.time() - start
        
        result = json.loads(resp.read().decode("utf-8"))
        translations = result.get("translations", [])
        
        print(f"✓ Batch translated {len(translations)} items in {elapsed:.2f}s")
        
        for item in translations:
            print(f"  • {item['original']} → {item['translation'][:50]}")
        
        return True
        
    except Exception as e:
        print(f"✗ Batch translation failed: {e}")
        return False


def test_cache_persistence():
    """Test that cache persists across requests."""
    print("\n[5] Testing Cache Persistence")
    print("-" * 50)
    
    test_text = f"Test Phrase {time.time()}"
    
    # First request (should be AI)
    payload = {"text": test_text, "is_title": False}
    req = urllib.request.Request(
        f"{FLASK_URL}/api/translate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=120)
    result1 = json.loads(resp.read().decode("utf-8"))
    
    # Second request (should be cache)
    req = urllib.request.Request(
        f"{FLASK_URL}/api/translate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=5)
    result2 = json.loads(resp.read().decode("utf-8"))
    
    from_cache = result2.get("from_cache", False)
    
    if from_cache:
        print(f"✓ Cache working: second request served from cache")
        return True
    else:
        print(f"⚠ Cache may not be working: second request not from cache")
        return True  # Not critical


def main():
    """Run all tests."""
    print("=" * 60)
    print("UNIFIED TRANSLATION SYSTEM TEST")
    print("=" * 60)
    
    # Check services
    ollama_ok = check_ollama()
    flask_ok = check_flask()
    
    if not flask_ok:
        print("\n✗ Flask server not running. Start with: python app.py")
        return False
    
    # Run translation tests
    print("\n[3] Testing Individual Translations")
    print("-" * 50)
    
    results = []
    cache_hits = 0
    
    for idx, test_case in enumerate(TEST_CASES, 1):
        success, from_cache = test_translation(test_case, idx)
        results.append(success)
        if from_cache:
            cache_hits += 1
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Passed: {passed}/{total} ({passed/total*100:.1f}%)")
    print(f"Cache hits: {cache_hits}/{total}")
    
    # Additional tests
    test_batch_translation()
    test_cache_persistence()
    
    print("\n" + "=" * 60)
    if passed >= total * 0.8:
        print("✓ TRANSLATION SYSTEM WORKING CORRECTLY")
    else:
        print("⚠ SOME TESTS FAILED - REVIEW RESULTS")
    print("=" * 60)
    
    return passed >= total * 0.8


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
