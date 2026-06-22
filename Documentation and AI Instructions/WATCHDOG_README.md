# Server Auto-Restart Watchdog

## Overview

The German Law Search Dashboard now includes an **automatic server restart mechanism** that monitors the backend server health and automatically restarts it if it becomes unresponsive or crashes.

## Components

### 1. Backend Watchdog (`server_watchdog.py`)

A background process that:
- Monitors the Flask server health via the `/api/dev/health` endpoint
- Checks server health every 10 seconds
- Automatically restarts the server if it becomes unresponsive
- Implements cooldown periods between restart attempts (30 seconds)
- Limits maximum restart attempts (5) before giving up
- Logs all activities to `logs/watchdog.log`

**Configuration Options** (in `server_watchdog.py`):
```python
CHECK_INTERVAL_SECONDS = 10      # How often to check server health
MAX_RESTART_ATTEMPTS = 5         # Maximum restart attempts before giving up
RESTART_COOLDOWN_SECONDS = 30    # Minimum time between restart attempts
HEALTH_TIMEOUT_SECONDS = 5       # Timeout for health check requests
```

### 2. Frontend Health Monitor (`static/js/dev.js`)

Browser-based monitoring that:
- Polls the server health every 10 seconds
- Detects when the server goes offline
- Shows a visual notification when the server is offline
- Displays a recovery notification when the server comes back online
- Tracks offline duration

### 3. Updated Launch Script (`run_dashboard.bat`)

The launch sequence now:
- Starts the watchdog process instead of the Flask server directly
- The watchdog handles starting and monitoring the Flask server
- Provides centralized logging for all server activities

### 4. Enhanced Log Viewer (`view_logs.ps1`)

Now monitors four log sources:
- `server.log` - Flask server logs (Green)
- `ai.log` - AI subsystem logs (Magenta)
- `dictionary.log` - Dictionary logs (Yellow)
- `watchdog.log` - Watchdog logs (Cyan)

## How It Works

### Startup Flow
```
1. run_dashboard.bat executes
2. server_watchdog.py starts
3. Watchdog starts Flask server (app.py)
4. Watchdog monitors server health every 10s
5. If server crashes → Watchdog restarts it automatically
```

### Recovery Flow
```
1. Server becomes unresponsive
2. Watchdog detects failure (3 consecutive failed health checks)
3. Watchdog terminates old server process
4. Watchdog starts new server process
5. Watchdog waits for server to become ready (60s timeout)
6. Frontend shows "Server Recovered" notification
```

## Visual Notifications

### Server Offline Notification
```
┌─────────────────────────────────────────┐
│ ⚠️  Server Offline                      │
│    The backend server is not responding.│
│    Auto-restart in progress...          │
│    Offline for 15 seconds               │
│                                    [⏳] │
└─────────────────────────────────────────┘
```

### Server Recovered Notification
```
┌─────────────────────────────────────────┐
│ ✅  Server Recovered                    │
│    The backend server is back online    │
│    and responding.                      │
└─────────────────────────────────────────┘
```

## Log Files

All logs are stored in the `logs/` directory:

| File | Description |
|------|-------------|
| `server.log` | Flask server startup and request logs |
| `watchdog.log` | Watchdog monitoring and restart activities |
| `ai.log` | AI subsystem and Ollama status |
| `dictionary.log` | Legal dictionary operations |
| `indexing.log` | Search index build operations |

## Manual Control

### Start Watchdog Manually
```bash
.venv\Scripts\python.exe server_watchdog.py
```

### Stop the Server
The watchdog will automatically terminate when:
- You press `Ctrl+C` in the watchdog console
- The browser window is closed (when using `run_dashboard.bat`)
- A SIGTERM/SIGINT signal is received

### Check Watchdog Status
```bash
# View watchdog log
type logs\watchdog.log

# Or use the live log viewer
powershell -ExecutionPolicy Bypass -File view_logs.ps1
```

## Troubleshooting

### Server Won't Start
1. Check `logs/watchdog.log` for error messages
2. Verify Ollama is running: `ollama list`
3. Check if port 5000 is in use: `netstat -ano | findstr :5000`
4. Ensure `.venv\Scripts\python.exe` exists

### Continuous Restart Loop
If the server keeps crashing and restarting:
1. Check `logs/server.log` for the actual error
2. Check `logs/error.log` for detailed errors
3. The watchdog will stop after 5 failed attempts
4. Fix the underlying issue before restarting

### Watchdog Not Running
If the watchdog process is not running:
1. Run `run_dashboard.bat` to start everything
2. Or manually run: `.venv\Scripts\python.exe server_watchdog.py`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Browser                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Frontend Health Monitor (dev.js)                     │  │
│  │  - Polls /api/dev/health every 10s                    │  │
│  │  - Shows offline/recovery notifications               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│                   Flask Server (app.py)                     │
│  - Port: 5000                                               │
│  - Endpoints: /api/dev/health, /api/status, etc.            │
└─────────────────────────────────────────────────────────────┘
                            ↕ Monitoring
┌─────────────────────────────────────────────────────────────┐
│              Watchdog (server_watchdog.py)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Health Checker                                       │  │
│  │  - Checks /api/dev/health every 10s                   │  │
│  │  - Tracks consecutive failures                        │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Restart Manager                                      │  │
│  │  - Cooldown: 30s between restarts                     │  │
│  │  - Max attempts: 5                                    │  │
│  │  - Process lifecycle management                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Keep the watchdog console visible** - You can see restart activities in real-time
2. **Monitor the logs** - Use the live log viewer to track all activities
3. **Don't run multiple instances** - Only one watchdog should run at a time
4. **Check Ollama status** - AI features require Ollama to be running
5. **Allow cooldown time** - The 30-second cooldown prevents rapid restart loops

## Future Enhancements

Potential improvements for future versions:
- Email/Slack notifications on server crashes
- Automatic error reporting
- Configurable thresholds via environment variables
- Web-based watchdog dashboard
- Automatic log rotation
- Performance metrics collection
