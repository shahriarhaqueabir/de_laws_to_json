"""
Comprehensive Translation Diagnostic Tool

Tests all translation pathways:
1. Dictionary lookup (legal_dict.get_translations)
2. Fast translate endpoint (word-by-word + dictionary)
3. AI translate endpoint (Ollama)
4. Phrase translation
"""

import json
import urllib.request
import urllib.error
import sys
import os
import io

# Fix Windows console Unicode encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Use ASCII-safe symbols for Windows
CHECK = "[OK]"
WARN = "[!]"
CROSS = "[FAIL]"

print("=" * 70)
print("TRANSLATION DIAGNOSTIC TOOL")
print("=" * 70)

# ============================================================================
# TEST 1: Dictionary Database
# ============================================================================
print("\n[TEST 1] Dictionary Database Check")
print("-" * 50)

try:
    from dictionary.legal_dict import get_legal_dictionary
    
    legal_dict = get_legal_dictionary()
    
    if not legal_dict._db_exists:
        print(f"{CROSS} FAIL: Dictionary database not found!")
        print("   Run: python dictionary/build_dictionary_db.py")
    else:
        print(f"{CHECK} Dictionary database exists")
        
        # Test lookups
        test_words = ['Kündigung', 'Miete', 'Vermieter', 'Gesetz']
        for word in test_words:
            results = legal_dict.get_translations(word)
            if results:
                print(f"{CHECK} '{word}' -> {results[0]['english']} (source: {results[0]['source']})")
            else:
                print(f"{WARN} '{word}' -> No translation found")
                
except Exception as e:
    print(f"{CROSS} FAIL: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 2: Check JSON Data Files
# ============================================================================
print("\n[TEST 2] JSON Data Files Check")
print("-" * 50)

json_files = [
    './dictionary/dictionary.db',
    './ai_translations.json',
    './law_view_counts.json',
    './search_index.json'
]

for f in json_files:
    if os.path.exists(f):
        size = os.path.getsize(f)
        print(f"{CHECK} {f} ({size:,} bytes)")
    else:
        print(f"{CROSS} {f} NOT FOUND")

# ============================================================================
# TEST 3: Ollama AI Service
# ============================================================================
print("\n[TEST 3] Ollama AI Service Check")
print("-" * 50)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")

try:
    # Check if Ollama is running
    req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
    resp = urllib.request.urlopen(req, timeout=5)
    data = json.loads(resp.read().decode('utf-8'))
    print(f"{CHECK} Ollama is running at {OLLAMA_URL}")
    
    # Check available models
    models = data.get('models', [])
    model_names = [m['name'] for m in models]
    print(f"  Available models: {', '.join(model_names)}")
    
    if OLLAMA_MODEL in model_names:
        print(f"{CHECK} Model '{OLLAMA_MODEL}' is available")
    else:
        print(f"{WARN} Model '{OLLAMA_MODEL}' NOT FOUND - using default")
        
    # Test actual generation
    print(f"  Testing generation with '{OLLAMA_MODEL}'...")
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": "Translate 'Kündigung' to English. Return only the translation.",
        "stream": False
    }
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    resp = urllib.request.urlopen(req, timeout=30)
    data = json.loads(resp.read().decode('utf-8'))
    response_text = data.get('response', '').strip()
    print(f"{CHECK} Ollama response: '{response_text}'")
    
except urllib.error.URLError as e:
    print(f"{CROSS} FAIL: Ollama is not reachable - {e}")
    print("   Make sure Ollama is running: ollama serve")
except Exception as e:
    print(f"{CROSS} FAIL: {e}")

# ============================================================================
# TEST 4: Flask Server Endpoints
# ============================================================================
print("\n[TEST 4] Flask Server Endpoints Check")
print("-" * 50)

SERVER_URL = "http://127.0.0.1:5000"

def test_endpoint(method, endpoint, data=None):
    """Test a single endpoint."""
    try:
        url = f"{SERVER_URL}{endpoint}"
        if method == "GET":
            req = urllib.request.Request(url)
        else:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode('utf-8') if data else None,
                headers={"Content-Type": "application/json"}
            )
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.getcode(), json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except Exception as e:
        return None, str(e)

# Check if server is running
status_code, result = test_endpoint("GET", "/api/status")
if status_code == 200:
    print(f"{CHECK} Server is running at {SERVER_URL}")
else:
    print(f"{CROSS} FAIL: Server not reachable (status: {status_code})")
    print("   Make sure the Flask server is running: python app.py")
    sys.exit(1)

# Test unified translate endpoint
print("\n  Testing /api/translate:")
test_cases = [
    {"text": "Kündigung", "is_title": False},
    {"text": "Mieterhöhung", "is_title": False},
    {"text": "BGB", "is_title": False},
    {"text": "Bürgerliches Gesetzbuch", "is_title": True},
]

for test_data in test_cases:
    status, result = test_endpoint("POST", "/api/translate", test_data)
    if status == 200:
        translation = result.get('translation', 'N/A')
        from_cache = result.get('from_cache', False)
        print(f"  {CHECK} '{test_data['text']}' -> '{translation}' (cache: {from_cache})")
    else:
        print(f"  {CROSS} '{test_data['text']}' -> Error: {result}")

# Test dictionary_lookup endpoint
print("\n  Testing /api/dictionary_lookup:")
status, result = test_endpoint("POST", "/api/dictionary_lookup", {"text": "Kündigung"})
if status == 200:
    results = result.get('results', [])
    if results:
        print(f"  {CHECK} Found {len(results)} result(s): {results[0]['english']}")
    else:
        print(f"  {WARN} No results found")
else:
    print(f"  {CROSS} Error: {result}")

# ============================================================================
# TEST 5: Check Log Files
# ============================================================================
print("\n[TEST 5] Log Files Check")
print("-" * 50)

log_files = [
    './Logs/server.log',
    './Logs/error.log',
    './Logs/ai.log',
    './Logs/dictionary.log'
]

for log_file in log_files:
    if os.path.exists(log_file):
        size = os.path.getsize(log_file)
        # Read last few lines with error handling
        try:
            with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
                last_line = lines[-1].strip() if lines else "Empty"
            print(f"{CHECK} {log_file} ({size:,} bytes)")
            print(f"  Last entry: {last_line}")
        except Exception as e:
            print(f"{WARN} {log_file} - Could not read: {e}")
    else:
        print(f"{WARN} {log_file} NOT FOUND")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 70)
print("DIAGNOSTIC COMPLETE")
print("=" * 70)
print("""
If you see failures:
1. Dictionary issues → Run: python dictionary/build_dictionary_db.py
2. Ollama issues → Run: ollama serve (in another terminal)
3. Server issues → Run: python app.py
4. Check Logs/ directory for detailed error messages
""")
