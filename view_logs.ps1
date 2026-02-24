# Combined Log Viewer for German Law Dashboard
# Displays server, AI, and watchdog logs in a clean, human-readable format

param(
    [string]$LogsDir = ".\Logs",
    [int]$TailLines = 50
)

$serverLog = Join-Path $LogsDir "server.log"
$aiLog = Join-Path $LogsDir "ai.log"
$dictLog = Join-Path $LogsDir "dictionary.log"
$watchdogLog = Join-Path $LogsDir "watchdog.log"

# Color themes
$colors = @{
    "INFO" = "Green"
    "WARNING" = "Yellow"
    "ERROR" = "Red"
    "DEBUG" = "Gray"
    "SUCCESS" = "Cyan"
}

# Source colors
$sourceColors = @{
    "SERVER" = "Green"
    "AI" = "Magenta"
    "DICT" = "Yellow"
    "WATCH" = "Cyan"
}

function Format-LogLine {
    param([string]$Line, [string]$Source)
    
    # Extract timestamp and level
    if ($Line -match '^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] (.*)$') {
        $timestamp = $matches[1]
        $level = $matches[2]
        $message = $matches[3]
        
        # Get color based on level
        $color = $colors[$level] ?? "White"
        $sourceColor = $sourceColors[$Source] ?? "White"
        
        # Format with icons
        $icon = switch ($level) {
            "INFO" { "ℹ" }
            "WARNING" { "⚠" }
            "ERROR" { "❌" }
            "DEBUG" { "🐛" }
            "SUCCESS" { "✅" }
            default { "•" }
        }
        
        Write-Host "[$Source]" -ForegroundColor $sourceColor -NoNewline
        Write-Host " $icon " -NoNewline
        Write-Host "$message" -ForegroundColor $color
    }
    else {
        # Unformatted line
        Write-Host "[$Source] $Line" -ForegroundColor Gray
    }
}

function Show-Header {
    Clear-Host
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     German Law Dashboard — Live System Logs              ║" -ForegroundColor Cyan
    Write-Host "╠═══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "║  [SERVER] Green   │  [AI] Magenta   │  [DICT] Yellow    ║" -ForegroundColor White
    Write-Host "║  [WATCH] Cyan     │  Press Ctrl+C to exit               ║" -ForegroundColor White
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Starting live monitor..." -ForegroundColor Gray
    Write-Host ""
}

# Ensure Logs directory exists
if (!(Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

# Ensure log files exist
foreach ($logFile in @($serverLog, $aiLog, $dictLog, $watchdogLog)) {
    if (!(Test-Path $logFile)) { New-Item -ItemType File -Path $logFile -Force | Out-Null }
}

# Track file positions
$positions = @{
    $serverLog = 0
    $aiLog = 0
    $dictLog = 0
    $watchdogLog = 0
}

# Source labels
$logLabels = @{
    $serverLog = "SERVER"
    $aiLog = "AI"
    $dictLog = "DICT"
    $watchdogLog = "WATCH"
}

# Show header
Show-Header

try {
    while ($true) {
        foreach ($logFile in @($serverLog, $aiLog, $dictLog, $watchdogLog)) {
            if (Test-Path $logFile) {
                $file = Get-Item $logFile
                $currentSize = $file.Length
                
                if ($currentSize -gt $positions[$logFile]) {
                    $content = Get-Content $logFile -Raw
                    $source = $logLabels[$logFile]
                    
                    if ($positions[$logFile] -gt 0) {
                        $newContent = $content.Substring($positions[$logFile])
                    } else {
                        # First read - take last N lines
                        $allLines = $content -split "`n" | Where-Object { $_.Trim() }
                        $startIndex = [Math]::Max(0, $allLines.Count - $TailLines)
                        $newContent = ($allLines[$startIndex..($allLines.Count-1)] -join "`n") + "`n"
                    }
                    
                    if ($newContent.Trim()) {
                        $newContent -split "`n" | ForEach-Object {
                            $line = $_.Trim()
                            if ($line) {
                                Format-LogLine -Line $line -Source $source
                            }
                        }
                    }
                    
                    $positions[$logFile] = $currentSize
                }
            }
        }
        
        Start-Sleep -Milliseconds 500
    }
}
catch [Management.Automation.Host.UserInterruptException] {
    Write-Host ""
    Write-Host "  Log viewer stopped." -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}
