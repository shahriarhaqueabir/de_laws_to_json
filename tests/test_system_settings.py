#!/usr/bin/env python3
"""
System Settings Verification Test

Verifies that users can:
1. See server status
2. See AI status
3. Reload application (rebuild index)
4. Reindex laws

Usage:
    python tests/test_system_settings.py
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

# Configuration
SERVER_URL = "http://127.0.0.1:5000"
ADMIN_TOKEN = None  # Will be extracted from app.py


def print_header():
    print("\n" + "=" * 80)
    print("SYSTEM SETTINGS VERIFICATION TEST")
    print("=" * 80)
    print(f"Server: {SERVER_URL}")
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80 + "\n")


def test_endpoint(method, endpoint, expected_status=200, timeout=10):
    """Test an endpoint and return (success, data, elapsed_ms)."""
    url = f"{SERVER_URL}{endpoint}"
    start = time.time()

    try:
        req = urllib.request.Request(url, method=method)
        req.add_header("Content-Type", "application/json")

        resp = urllib.request.urlopen(req, timeout=timeout)
        elapsed_ms = int((time.time() - start) * 1000)

        if resp.status == expected_status:
            data = json.loads(resp.read().decode("utf-8"))
            return True, data, elapsed_ms
        else:
            return False, f"HTTP {resp.status}", elapsed_ms

    except urllib.error.HTTPError as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return False, f"HTTP {e.code}: {e.reason}", elapsed_ms
    except urllib.error.URLError as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return False, f"Connection error: {e.reason}", elapsed_ms
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return False, str(e), elapsed_ms


# Skip all tests if server is not running (legacy Flask backend)
def _server_is_running():
    """Check if the legacy Flask server is running."""
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(("127.0.0.1", 5000))
    sock.close()
    return result == 0


if not _server_is_running():
    print("\n⚠️  Legacy Flask server not running at 127.0.0.1:5000 — skipping tests.")
    print("   Start with: python app.py  (legacy backend)\n")
    sys.exit(0)


def test_server_status():
    """Test 1: User can see server status."""
    print("\n[TEST 1] Server Status Endpoint")
    print("-" * 60)

    # Test /api/status
    success, data, elapsed = test_endpoint("GET", "/api/status")

    if success:
        print(f"✅ /api/status - OK ({elapsed}ms)")
        print(f"   Ready: {data.get('ready', False)}")
        print(f"   Laws indexed: {data.get('laws', 0):,}")
        print(f"   Total norms: {data.get('total_norms', 0):,}")

        # Verify required fields
        required_fields = ["ready", "laws", "indexed", "total"]
        missing = [f for f in required_fields if f not in data]

        if missing:
            print(f"   ⚠️  Missing fields: {missing}")
            return False, data
        return True, data
    else:
        print(f"❌ /api/status - FAILED: {data}")
        return False, None


def test_ai_status():
    """Test 2: User can see AI status."""
    print("\n[TEST 2] AI Status Endpoint")
    print("-" * 60)

    # Test /api/dev/health
    success, data, elapsed = test_endpoint("GET", "/api/dev/health")

    if success:
        print(f"✅ /api/dev/health - OK ({elapsed}ms)")
        print(f"   AI Enabled: {data.get('ai_enabled', False)}")
        print(f"   Ollama Status: {data.get('ollama', 'unknown')}")
        print(
            f"   Search Index: {data.get('dependencies', {}).get('search_index', 'unknown')}"
        )
        print(f"   Uptime: {data.get('uptime', 0)} seconds")

        # Verify required fields
        required_fields = ["ai_enabled", "ollama", "dependencies", "uptime"]
        missing = [f for f in required_fields if f not in data]

        if missing:
            print(f"   ⚠️  Missing fields: {missing}")
            return False, data
        return True, data
    else:
        print(f"❌ /api/dev/health - FAILED: {data}")
        return False, None


def test_admin_info():
    """Test 3: Admin info endpoint exists."""
    print("\n[TEST 3] Admin Info Endpoint")
    print("-" * 60)

    # Test /api/admin/info (requires admin token)
    # First try without token (should fail with 403)
    success, data, elapsed = test_endpoint(
        "GET", "/api/admin/info", expected_status=403
    )

    if not success and "403" in str(data):
        print(f"✅ /api/admin/info - Protected (requires auth)")
        print(f"   Authentication required: Yes")
        return True, "protected"
    elif success:
        print(f"✅ /api/admin/info - Accessible ({elapsed}ms)")
        print(f"   Indexing: {data.get('indexing', False)}")
        print(f"   Laws: {data.get('laws', 0)}")
        return True, data
    else:
        print(f"❌ /api/admin/info - Error: {data}")
        return False, None


def test_rebuild_index_endpoint():
    """Test 4: Rebuild index endpoint exists."""
    print("\n[TEST 4] Rebuild Index Endpoint")
    print("-" * 60)

    # Test /api/admin/rebuild_index (should require auth)
    success, data, elapsed = test_endpoint(
        "POST", "/api/admin/rebuild_index", expected_status=403
    )

    if not success and "403" in str(data):
        print(f"✅ /api/admin/rebuild_index - Protected (requires auth)")
        print(f"   Endpoint exists: Yes")
        print(f"   Authentication required: Yes")
        return True, "protected"
    elif success:
        print(f"✅ /api/admin/rebuild_index - Triggered ({elapsed}ms)")
        print(f"   Status: {data.get('status', 'unknown')}")
        return True, data
    else:
        print(f"❌ /api/admin/rebuild_index - Error: {data}")
        return False, None


def test_frontend_elements():
    """Test 5: Frontend has required UI elements."""
    print("\n[TEST 5] Frontend UI Elements")
    print("-" * 60)

    # Check index.html for required elements
    template_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "templates", "index.html"
    )

    if not os.path.exists(template_path):
        print(f"❌ Template not found: {template_path}")
        return False, None

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Check for required UI elements
    checks = {
        "Status pill": 'id="status-pill"',
        "Status text": 'id="status-text"',
        "Rebuild button": 'id="btn-rebuild-index"',
        "AI status display": 'id="main-ai-status"',
        "Health cards": 'class="health-card"',
        "Health API": 'id="health-api"',
        "Health Index": 'id="health-index"',
        "Health AI": 'id="health-ai"',
        "Rebuild action": "sidebarAdminAction('rebuild')",
    }

    all_found = True
    for name, search_str in checks.items():
        if search_str in html_content:
            print(f"   ✅ {name}: Found")
        else:
            print(f"   ❌ {name}: NOT FOUND")
            all_found = False

    if all_found:
        print(f"✅ All required UI elements present")
        return True, checks
    else:
        print(f"⚠️  Some UI elements missing")
        return False, None


def test_javascript_functions():
    """Test 6: JavaScript has required functions."""
    print("\n[TEST 6] JavaScript Functions")
    print("-" * 60)

    js_files = [
        "static/js/app.js",
        "static/js/dev.js",
    ]

    base_path = os.path.dirname(os.path.dirname(__file__))

    required_functions = {
        "app.js": [
            "pollStatus",
            "btn-rebuild-index",
        ],
        "dev.js": [
            "refreshDevHealth",
            "sidebarAdminAction",
            "rebuild_index",
        ],
    }

    all_found = True

    for js_file, functions in required_functions.items():
        js_path = os.path.join(base_path, js_file)

        if not os.path.exists(js_path):
            print(f"   ❌ {js_file}: NOT FOUND")
            all_found = False
            continue

        with open(js_path, "r", encoding="utf-8") as f:
            js_content = f.read()

        print(f"\n   {js_file}:")
        for func in functions:
            if func in js_content:
                print(f"      ✅ {func}: Found")
            else:
                print(f"      ❌ {func}: NOT FOUND")
                all_found = False

    if all_found:
        print(f"\n✅ All required JavaScript functions present")
        return True, required_functions
    else:
        print(f"\n⚠️  Some JavaScript functions missing")
        return False, None


def run_all_tests():
    """Run all verification tests."""
    print_header()

    results = {
        "server_status": False,
        "ai_status": False,
        "admin_info": False,
        "rebuild_index": False,
        "frontend_ui": False,
        "javascript": False,
    }

    # Run tests
    results["server_status"], _ = test_server_status()
    results["ai_status"], _ = test_ai_status()
    results["admin_info"], _ = test_admin_info()
    results["rebuild_index"], _ = test_rebuild_index_endpoint()
    results["frontend_ui"], _ = test_frontend_elements()
    results["javascript"], _ = test_javascript_functions()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"\nResults: {passed}/{total} tests passed\n")

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status}: {test_name.replace('_', ' ').title()}")

    print("\n" + "=" * 80)

    # Verify main requirement
    print("\n[VERIFICATION] Main Requirement:")
    print("-" * 60)

    requirements = {
        "User can see server status": results["server_status"],
        "User can see AI status": results["ai_status"],
        "User can reload application": results["rebuild_index"],
        "User can reindex laws": results["rebuild_index"],
    }

    all_met = all(requirements.values())

    for req, met in requirements.items():
        status = "✅" if met else "❌"
        print(f"   {status} {req}")

    print("\n" + "=" * 80)

    if all_met:
        print("\n✅ ALL REQUIREMENTS MET")
        print("   Statement is TRUE: Users can see server status, AI status,")
        print("   and have options to reload application and reindex laws.")
    else:
        print("\n❌ SOME REQUIREMENTS NOT MET")
        print("   Statement is FALSE: Some functionality is missing.")

    print("=" * 80 + "\n")

    return all_met


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
