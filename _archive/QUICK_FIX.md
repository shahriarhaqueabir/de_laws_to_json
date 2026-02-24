# Quick Fix for Translation Hang Issue

The translation system hangs because of SQLite connection issues in threaded mode.

## Immediate Fix

Run this to restart with a clean state:

```bash
# Kill all Python processes
taskkill /F /FI "IMAGENAME eq python.exe"

# Wait a moment
timeout /t 3

# Start fresh
python app.py
```

## Root Cause

The dictionary uses thread-local SQLite connections, but Flask's reloader creates child processes that inherit broken connection states.

## Permanent Fix Options

### Option 1: Disable Flask Reloader (Recommended for Production)

Already done in `app.py`:
```python
app.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)
```

### Option 2: Add Connection Timeout

Add to `dictionary/legal_dict.py`:
```python
def _get_connection(self):
    if not hasattr(self._local, 'connection') or self._local.connection is None:
        self._local.connection = sqlite3.connect(
            self.db_path, 
            timeout=30,  # Increased from 2 seconds
            check_same_thread=False
        )
        self._local.connection.row_factory = sqlite3.Row
        self._local.connection.execute("PRAGMA journal_mode=WAL")
        self._local.connection.execute("PRAGMA busy_timeout=30000")  # 30 second busy timeout
    return self._local.connection
```

### Option 3: Use Connection Pool

For high-traffic scenarios, implement a proper connection pool.

## Current Status

✅ Health endpoint fixed - shows "Ready" not "Building..."
✅ Ollama model: llama3.2:latest (correct)
⚠️ Translation: Intermittent hangs due to SQLite locking

## Workaround

If translations hang:
1. Refresh the page
2. Try again - second attempt usually works
3. Or restart server as shown above
