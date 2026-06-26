<#
.SYNOPSIS
    German Law Vault — Local AI Setup Script
.DESCRIPTION
    Automates setup of the Local AI tier (Ollama + broker) for German Law Vault.
    Checks prerequisites, installs dependencies, pulls recommended models, and starts the broker.
    Cross-platform: Windows PowerShell 5.1+ / PowerShell 7+.

    Usage:
        powershell -ExecutionPolicy Bypass -File scripts\setup-local-ai.ps1

    Flags:
        -SkipModelPull   Skip the model download prompt (just check + start broker)
        -Model <name>    Specify a different Ollama model (default: qwen2.5:1.5b)
        -Unattended      Run without prompts (auto-approve all)
.EXAMPLE
    .\scripts\setup-local-ai.ps1
    .\scripts\setup-local-ai.ps1 -Model mistral:latest
    .\scripts\setup-local-ai.ps1 -Unattended
#>

param(
    [switch]$SkipModelPull,
    [string]$Model = "qwen2.5:1.5b",
    [switch]$Unattended
)

$ErrorActionPreference = "Stop"
$script:exitCode = 0

# ── Helper Functions ──

function Write-Step($Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Info($Message) {
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Success($Message) {
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Warn($Message) {
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

function Write-Error($Message) {
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

function Get-UserYesNo($Prompt) {
    if ($Unattended) { return $true }
    $response = Read-Host "  $Prompt (y/n)"
    return $response -match '^[yY]'
}

function Get-UserChoice($Prompt, $Options) {
    if ($Unattended) { return $Options[0] }
    Write-Host "  $Prompt" -ForegroundColor Yellow
    for ($i = 0; $i -lt $Options.Count; $i++) {
        Write-Host "    [$($i+1)] $($Options[$i])"
    }
    $selection = Read-Host "  Enter number (1-$($Options.Count))"
    $idx = [int]$selection - 1
    if ($idx -ge 0 -and $idx -lt $Options.Count) {
        return $Options[$idx]
    }
    Write-Warn "Invalid selection, using default: $($Options[0])"
    return $Options[0]
}

# ── Main Script ──

Write-Host @"
╔══════════════════════════════════════════════╗
║   German Law Vault — Local AI Setup          ║
║   Automates Ollama + broker configuration     ║
╚══════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

Write-Host "`nThis script will:"
Write-Info "1. Check prerequisites (Ollama, Python, Node.js)"
Write-Info "2. Verify/install broker dependencies"
Write-Info "3. Offer to pull recommended Ollama models"
Write-Info "4. Start the local broker"
Write-Info "5. Verify end-to-end connectivity"
Write-Host ""

# ── Step 0: User Consent ──
if (-not $Unattended) {
    Write-Step "Prerequisite Check"
    Write-Info "This will check and potentially modify your local machine:"
    Write-Info "  • Python packages: fastapi, uvicorn, httpx (via pip)"
    if (-not $SkipModelPull) {
        Write-Info "  • Ollama model: $Model (~1-2GB download)"
    }
    Write-Info "  • May start new processes (broker on port 9000)"

    if (-not (Get-UserYesNo "Proceed with setup?")) {
        Write-Warn "Setup cancelled by user."
        exit 0
    }
}

# ── Step 1: Check Ollama ──
Write-Step "Checking Ollama"

$ollamaInstalled = $false
try {
    $ollamaVersion = & ollama --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $ollamaInstalled = $true
        Write-Success "Ollama installed: $ollamaVersion"
    }
} catch {
    # Not found
}

if (-not $ollamaInstalled) {
    Write-Warn "Ollama is not installed."
    if (Get-UserYesNo "Download and install Ollama from https://ollama.com/download?") {
        Write-Info "Opening download page in browser..."
        Start-Process "https://ollama.com/download"
        Write-Info "Please install Ollama, restart this script, and try again."
        Write-Info "After installing, run Ollama once to start the service."
        exit 1
    } else {
        Write-Error "Ollama is required for Local AI mode. Skipping setup."
        exit 1
    }
}

# Check if Ollama service is running
try {
    $ollamaHealth = Invoke-WebRequest -Uri "http://localhost:11434" -UseBasicParsing -TimeoutSec 5
    Write-Success "Ollama service is running on http://localhost:11434"
} catch {
    Write-Warn "Ollama service is not running."
    if (Get-UserYesNo "Attempt to start Ollama now?") {
        try {
            Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
            Write-Info "Waiting for Ollama to start..."
            Start-Sleep -Seconds 5
        } catch {
            Write-Error "Could not start Ollama. Please start it manually and try again."
            Write-Info "Run: ollama serve"
            exit 1
        }
    } else {
        Write-Warn "Ollama service required. Skipping setup."
        exit 1
    }
}

# ── Step 2: List existing models ──
Write-Step "Ollama Models"

$existingModels = @()
try {
    $tagsJson = & ollama list 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Existing models:"
        foreach ($line in $tagsJson) {
            if ($line -match '^(\S+)\s+') {
                $modelName = $matches[1]
                $existingModels += $modelName
                Write-Info "  • $modelName"
            }
        }
    }
} catch {}

if ($existingModels.Count -eq 0) {
    Write-Warn "No Ollama models found."
}

# ── Step 3: Pull recommended model ──
$RECOMMENDED_MODELS = @(
    @{ Name = "qwen2.5:1.5b"; Desc = "Fast, 1.5B params — best balance of speed/quality (default)" },
    @{ Name = "mistral:latest"; Desc = "Mistral 7B — higher quality, more RAM (~4GB)" },
    @{ Name = "phi:latest"; Desc = "Phi-3 mini 3.8B — good quality, moderate RAM (~3GB)" },
    @{ Name = "ministral-3:latest"; Desc = "Ministral 3B — compact, fast (~2GB)" }
)

$modelToUse = $Model
$modelExists = $existingModels -contains $modelToUse

if (-not $SkipModelPull -and -not $modelExists) {
    Write-Step "Model Selection"
    Write-Info "Recommended models for legal Q&A:"

    $choices = $RECOMMENDED_MODELS | ForEach-Object { "$($_.Name) — $($_.Desc)" }
    $selected = Get-UserChoice "Pick a model to download (or press Ctrl+C to cancel):" $choices

    # Extract model name from selection
    $modelToUse = ($selected -split ' —')[0].Trim()

    Write-Info "Selected model: $modelToUse"

    if (Get-UserYesNo "Download $modelToUse (~1-2GB)? This may take several minutes.") {
        Write-Info "Pulling $modelToUse... (this may take a while)"
        & ollama pull $modelToUse
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Model $modelToUse downloaded successfully."
        } else {
            Write-Error "Failed to download $modelToUse. Check your internet connection."
            exit 1
        }
    } else {
        Write-Info "Using existing model instead."
        # Fall back to first existing model or default
        if ($existingModels.Count -gt 0) {
            $modelToUse = $existingModels[0]
            Write-Info "Using existing model: $modelToUse"
        }
    }
} elseif ($modelExists) {
    Write-Success "Model $modelToUse already exists locally."
} else {
    Write-Info "Skipping model download (use -Model <name> to specify one)."
}

# ── Step 4: Check Python dependencies ──
Write-Step "Broker Dependencies"

$pythonCmd = "python"
try {
    $pyVer = & python --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "python not found" }
    Write-Success "Python: $pyVer"
} catch {
    try {
        $pyVer = & python3 --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = "python3"
            Write-Success "Python: $pyVer"
        } else { throw }
    } catch {
        Write-Error "Python is not installed. Install Python 3.10+ from https://python.org"
        exit 1
    }
}

# Install required packages
$brokerDir = Join-Path $PSScriptRoot "..\broker"
$reqFile = Join-Path $brokerDir "requirements.txt"

if (Test-Path $reqFile) {
    Write-Info "Installing Python dependencies from requirements.txt..."
    & $pythonCmd -m pip install -r $reqFile 2>&1 | Out-Null
} else {
    Write-Info "Installing Python dependencies (fastapi, uvicorn, httpx)..."
    & $pythonCmd -m pip install fastapi uvicorn httpx 2>&1 | Out-Null
}

if ($LASTEXITCODE -eq 0) {
    Write-Success "Python dependencies installed."
} else {
    Write-Error "Failed to install Python dependencies."
    exit 1
}

# ── Step 5: Kill any existing broker process ──
Write-Step "Starting Broker"

try {
    $oldBroker = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -match "broker.py"
    }
    if ($oldBroker) {
        Write-Info "Stopping existing broker process (PID: $($oldBroker.Id))..."
        $oldBroker | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
} catch {
    # Ignore errors checking for old broker
}

# Start broker in background
$brokerScript = Join-Path $brokerDir "broker.py"
$env:DEFAULT_MODEL = $modelToUse

Write-Info "Starting broker on http://localhost:9000 with model: $modelToUse"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $pythonCmd
$psi.Arguments = "-u `"$brokerScript`""
$psi.WorkingDirectory = $brokerDir
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.EnvironmentVariables["DEFAULT_MODEL"] = $modelToUse
$psi.EnvironmentVariables["BROKER_PORT"] = "9000"

$brokerProcess = [System.Diagnostics.Process]::Start($psi)

# Read initial output async
$outputBuilder = New-Object System.Text.StringBuilder
$readerTask = $brokerProcess.StandardOutput.ReadToEndAsync()

# Wait for broker to be ready
Start-Sleep -Seconds 3

# Check health endpoint
$healthOk = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $health = Invoke-WebRequest -Uri "http://localhost:9000/health" -UseBasicParsing -TimeoutSec 3
        if ($health.StatusCode -eq 200) {
            $healthData = $health.Content | ConvertFrom-Json
            if ($healthData.status -eq "ok") {
                $healthOk = $true
                Write-Success "Broker is running and connected to Ollama."
                Write-Info "  Models available: $($healthData.models -join ', ')"
                Write-Info "  Default model: $($healthData.default_model)"
                break
            }
        }
    } catch {
        # Still starting
    }
    Start-Sleep -Seconds 2
    Write-Info "  Waiting for broker... (attempt $($i+1))"
}

if (-not $healthOk) {
    Write-Error "Broker failed to start within 20 seconds."
    Write-Info "Check broker output for errors:"
    try { Write-Info $brokerProcess.StandardOutput.ReadToEnd() } catch {}
    exit 1
}

# ── Step 6: Test chat endpoint ──
Write-Step "Verification"

try {
    $testRes = Invoke-WebRequest -Uri "http://localhost:9000/api/chat" `
        -Method POST `
        -Body '{"message":"What is § 823 BGB?","stream":false,"model":"qwen2.5:1.5b"}' `
        -ContentType "application/json" `
        -UseBasicParsing `
        -TimeoutSec 30

    if ($testRes.StatusCode -eq 200) {
        $testData = $testRes.Content | ConvertFrom-Json
        if ($testData.response -and $testData.response -ne "") {
            Write-Success "Chat endpoint works! Response received ($($testData.response.Length) chars)."
        } else {
            Write-Warn "Chat endpoint responded but response was empty. Check the model."
        }
    } else {
        Write-Warn "Chat endpoint returned status $($testRes.StatusCode)."
    }
} catch {
    Write-Warn "Chat test failed: $($_.Exception.Message)"
    Write-Info "The broker is running but the chat test failed. The model may still be loading."
}

# ── Summary ──
Write-Host @"

╔══════════════════════════════════════════════╗
║   Setup Complete                             ║
╠══════════════════════════════════════════════╣
║  • Ollama:    Running (localhost:11434)       ║
║  • Broker:    Running (localhost:9000)        ║
║  • Model:     $modelToUse
║                                              ║
║  Next steps:                                  ║
║  1. Open http://localhost:3000/chat           ║
║  2. Ensure mode is set to "Local AI"          ║
║  3. Start chatting!                           ║
╚══════════════════════════════════════════════╝
"@ -ForegroundColor Green

exit 0
