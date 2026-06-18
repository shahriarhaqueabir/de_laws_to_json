"""
Server Watchdog - Auto-restart mechanism for German Law Search Dashboard

Monitors the Flask server health and automatically restarts it if it becomes unresponsive.
Also displays all logs (server, AI, dictionary, watchdog) in real-time.

Usage:
    python server_watchdog.py
"""

import os
import sys
import time
import subprocess
import threading
import urllib.request
import urllib.error
import signal
import atexit
from datetime import datetime
from typing import Optional, Tuple

# Configuration
HOST = "127.0.0.1"
PORT = 5000
HEALTH_ENDPOINT = f"http://{HOST}:{PORT}/api/dev/health"
STATUS_ENDPOINT = f"http://{HOST}:{PORT}/api/status"
CHECK_INTERVAL_SECONDS = 10
MAX_RESTART_ATTEMPTS = 5
RESTART_COOLDOWN_SECONDS = 30
HEALTH_TIMEOUT_SECONDS = 5

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(SCRIPT_DIR, ".venv", "Scripts", "python.exe")
APP_SCRIPT = os.path.join(SCRIPT_DIR, "app.py")
LOG_DIR = os.path.join(SCRIPT_DIR, "Logs")  # Capital L for consistency
WATCHDOG_LOG = os.path.join(LOG_DIR, "watchdog.log")

# Log files to monitor
LOG_FILES = {
    'SERVER': os.path.join(LOG_DIR, "server.log"),
    'AI': os.path.join(LOG_DIR, "ai.log"),
    'DICT': os.path.join(LOG_DIR, "dictionary.log"),
    'WATCH': WATCHDOG_LOG,
}

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)

# Global state
_server_process: Optional[subprocess.Popen] = None
_restart_count = 0
_last_restart_time = 0
_running = True
_log_positions = {}  # Track file read positions


def print_colored(text: str, color: str = "") -> None:
    """Print colored text to console (Windows compatible)."""
    # ANSI color codes (works in modern Windows terminals)
    colors = {
        'GREEN': '\033[92m',
        'YELLOW': '\033[93m',
        'RED': '\033[91m',
        'CYAN': '\033[96m',
        'MAGENTA': '\033[95m',
        'GRAY': '\033[90m',
        'RESET': '\033[0m',
    }
    
    color_code = colors.get(color.upper(), '')
    reset = colors.get('RESET', '')
    
    print(f"{color_code}{text}{reset}", flush=True)


def tail_all_logs() -> None:
    """Tail all log files and print new lines with color coding."""
    global _log_positions
    
    # Color mapping for log sources
    source_colors = {
        'SERVER': 'GREEN',
        'AI': 'MAGENTA',
        'DICT': 'YELLOW',
        'WATCH': 'CYAN',
    }
    
    for source, log_file in LOG_FILES.items():
        if not os.path.exists(log_file):
            continue
        
        try:
            # Get current file size
            file_size = os.path.getsize(log_file)
            
            # Initialize position if new file
            if log_file not in _log_positions:
                # Start from last 50 lines for new files
                try:
                    with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                        lines = f.readlines()
                        _log_positions[log_file] = file_size
                        # Show last 50 lines on startup
                        for line in lines[-50:]:
                            line = line.strip()
                            if line:
                                print_colored(f"[{source}] {line}", source_colors.get(source, ''))
                except Exception:
                    _log_positions[log_file] = 0
                continue
            
            # Check if file was truncated (rotated)
            if file_size < _log_positions[log_file]:
                _log_positions[log_file] = 0
            
            # Read new content
            if file_size > _log_positions[log_file]:
                with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                    f.seek(_log_positions[log_file])
                    new_content = f.read()
                    _log_positions[log_file] = f.tell()
                
                # Print new lines
                for line in new_content.splitlines():
                    line = line.strip()
                    if line:
                        print_colored(f"[{source}] {line}", source_colors.get(source, ''))
                        
        except Exception as e:
            # Silently ignore log reading errors
            pass


def log(message: str, level: str = "INFO") -> None:
    """Log a message to both console and file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}"
    print_colored(log_line, 'CYAN')  # Watchdog logs in cyan
    try:
        with open(WATCHDOG_LOG, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")
    except Exception:
        pass


def check_server_health() -> Tuple[bool, str]:
    """Check if the server is healthy and responding."""
    try:
        req = urllib.request.Request(HEALTH_ENDPOINT)
        with urllib.request.urlopen(req, timeout=HEALTH_TIMEOUT_SECONDS) as resp:
            if resp.status == 200:
                return True, "healthy"
            return False, f"unhealthy_status_{resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"http_error_{e.code}"
    except urllib.error.URLError as e:
        return False, f"url_error_{e.reason}"
    except Exception as e:
        return False, f"exception_{type(e).__name__}"


def is_server_process_running() -> bool:
    """Check if the server process is still running."""
    global _server_process
    if _server_process is None:
        return False
    return _server_process.poll() is None


def kill_server_process() -> None:
    """Kill the server process if it exists."""
    global _server_process
    if _server_process is not None:
        try:
            if _server_process.poll() is None:
                _server_process.terminate()
                try:
                    _server_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    _server_process.kill()
                    _server_process.wait(timeout=2)
                log("Server process terminated")
        except Exception as e:
            log(f"Error terminating server: {e}", "WARNING")
        finally:
            _server_process = None


def start_server() -> bool:
    """Start the Flask server process."""
    global _server_process
    
    if not os.path.exists(APP_SCRIPT):
        log(f"App script not found: {APP_SCRIPT}", "ERROR")
        return False
    
    python_exe = VENV_PYTHON
    if not os.path.exists(python_exe):
        python_exe = sys.executable
        log(f"Using system Python: {python_exe}", "WARNING")
    
    try:
        # Start server with output redirected to log file
        server_log = os.path.join(LOG_DIR, "server.log")
        with open(server_log, "a", encoding="utf-8") as log_file:
            _server_process = subprocess.Popen(
                [python_exe, APP_SCRIPT],
                stdout=log_file,
                stderr=subprocess.STDOUT,
                cwd=SCRIPT_DIR,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
        
        log(f"Server started with PID {_server_process.pid}")
        return True
    except Exception as e:
        log(f"Failed to start server: {e}", "ERROR")
        _server_process = None
        return False


def wait_for_server_ready(timeout: int = 90) -> bool:
    """Wait for the server to become ready.
    
    Args:
        timeout: Maximum seconds to wait (default 90s for slow startup)
    """
    start_time = time.time()
    log(f"Waiting for server to become ready (timeout: {timeout}s)...")

    while time.time() - start_time < timeout:
        if not is_server_process_running():
            log("Server process exited during startup", "ERROR")
            return False

        healthy, status = check_server_health()
        if healthy:
            log(f"Server is ready! Status: {status}")
            return True

        time.sleep(2)  # Check every 2 seconds

    log(f"Server failed to become ready within {timeout}s", "ERROR")
    return False


def attempt_restart() -> bool:
    """Attempt to restart the server with cooldown and max attempts check."""
    global _restart_count, _last_restart_time
    
    current_time = time.time()
    
    # Check cooldown
    if current_time - _last_restart_time < RESTART_COOLDOWN_SECONDS:
        remaining = int(RESTART_COOLDOWN_SECONDS - (current_time - _last_restart_time))
        log(f"Restart cooldown active, {remaining}s remaining", "WARNING")
        return False
    
    # Check max attempts
    if _restart_count >= MAX_RESTART_ATTEMPTS:
        log(f"Max restart attempts ({MAX_RESTART_ATTEMPTS}) reached. Giving up.", "ERROR")
        return False
    
    _restart_count += 1
    _last_restart_time = current_time
    
    log(f"Restart attempt {_restart_count}/{MAX_RESTART_ATTEMPTS}")
    
    # Kill existing process
    kill_server_process()
    
    # Start new process
    if start_server():
        if wait_for_server_ready(timeout=60):
            log("Server restarted successfully", "SUCCESS")
            return True
        else:
            log("Server failed to become ready after restart", "ERROR")
            return False
    else:
        log("Failed to start server process", "ERROR")
        return False


def monitor_loop() -> None:
    """Main monitoring loop with live log display."""
    global _running, _restart_count, _last_restart_time

    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 3
    LOG_TAIL_INTERVAL = 0.5  # Check logs every 500ms

    log(f"Watchdog started - monitoring server at {HEALTH_ENDPOINT}")
    log(f"Check interval: {CHECK_INTERVAL_SECONDS}s, Max restarts: {MAX_RESTART_ATTEMPTS}")
    print_colored("\n--- Live Log Feed (Server, AI, Dictionary, Watchdog) ---\n", 'GRAY')

    last_health_check = time.time()

    while _running:
        try:
            # Always tail logs (non-blocking)
            tail_all_logs()
            
            # Check health only at intervals
            if time.time() - last_health_check >= CHECK_INTERVAL_SECONDS:
                last_health_check = time.time()
                
                # Check if server process is running
                if not is_server_process_running():
                    log("Server process is not running!", "WARNING")
                    consecutive_failures += 1
                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        if attempt_restart():
                            consecutive_failures = 0
                        else:
                            log("Restart failed, will retry on next check", "ERROR")
                    continue

                # Check server health
                healthy, status = check_server_health()

                if healthy:
                    if consecutive_failures > 0:
                        log(f"Server recovered after {consecutive_failures} failures")
                        consecutive_failures = 0
                    # Reset restart count after successful health check
                    with threading.Lock():
                        if _restart_count > 0:
                            _restart_count = max(0, _restart_count - 1)
                else:
                    log(f"Server health check failed: {status}", "WARNING")
                    consecutive_failures += 1

                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        if attempt_restart():
                            consecutive_failures = 0
                        else:
                            log("Restart failed, will retry on next check", "ERROR")
            
            # Small sleep to prevent CPU spinning
            time.sleep(LOG_TAIL_INTERVAL)

        except Exception as e:
            log(f"Monitor loop error: {e}", "ERROR")
            consecutive_failures += 1
            time.sleep(CHECK_INTERVAL_SECONDS)


def signal_handler(signum, frame) -> None:
    """Handle shutdown signals gracefully."""
    global _running
    log(f"Received signal {signum}, shutting down watchdog...")
    _running = False
    kill_server_process()
    log("Watchdog stopped")
    sys.exit(0)


def cleanup() -> None:
    """Cleanup on exit."""
    global _running
    _running = False
    kill_server_process()


def main() -> None:
    """Main entry point."""
    global _server_process
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    atexit.register(cleanup)
    
    log("=" * 60)
    log("German Law Search Dashboard - Server Watchdog")
    log("=" * 60)
    
    # Check if server is already running
    healthy, status = check_server_health()
    if healthy:
        log("Existing server detected and healthy - adopting it")
        # We'll still monitor it, but won't try to kill it
    else:
        log("No healthy server detected - starting one")
        if not start_server():
            log("Failed to start initial server. Watchdog cannot continue.", "ERROR")
            return
        if not wait_for_server_ready(timeout=60):
            log("Server failed to start. Watchdog cannot continue.", "ERROR")
            return
    
    # Start monitoring
    try:
        monitor_loop()
    except KeyboardInterrupt:
        log("Keyboard interrupt received")
    finally:
        cleanup()


if __name__ == "__main__":
    main()
