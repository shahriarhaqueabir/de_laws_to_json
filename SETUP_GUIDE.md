# German Law Vault - Setup Guide

This guide provides step-by-step instructions for setting up German Law Vault from scratch.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Steps](#installation-steps)
3. [Optional: AI Features Setup](#optional-ai-features-setup)
4. [First Run](#first-run)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10/11, macOS 11+, or Linux |
| **Python** | 3.13 or higher |
| **RAM** | 4 GB (8 GB recommended) |
| **Storage** | 5 GB free space |
| **Internet** | Required for initial download |

### Recommended Requirements

| Component | Recommendation |
|-----------|----------------|
| **CPU** | 4+ cores (for faster processing) |
| **RAM** | 16 GB |
| **Storage** | 10 GB SSD |
| **GPU** | Optional (for AI features with Ollama) |

---

## Installation Steps

### Step 1: Install Python

#### Windows

1. Download Python 3.13 from [python.org](https://www.python.org/downloads/)
2. Run installer
3. ✅ **Check "Add Python to PATH"**
4. Click "Install Now"

Verify installation:
```bash
python --version
# Should show: Python 3.13.x
```

#### macOS

Using Homebrew (recommended):
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python
brew install python@3.13
```

Verify:
```bash
python3 --version
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install python3.13 python3.13-venv python3-pip
```

Verify:
```bash
python3 --version
```

### Step 2: Clone the Repository

```bash
# Navigate to your projects directory
cd ~/projects  # or your preferred location

# Clone the repository
git clone https://github.com/yourusername/german-law-vault.git

# Enter the project directory
cd german-law-vault
```

### Step 3: Create Virtual Environment

#### Windows

```bash
# Create virtual environment
python -m venv .venv

# Activate
.venv\Scripts\activate
```

You should see `(.venv)` in your command prompt.

#### macOS/Linux

```bash
# Create virtual environment
python3 -m venv .venv

# Activate
source .venv/bin/activate
```

You should see `(.venv)` in your terminal prompt.

### Step 4: Install Dependencies

```bash
# Upgrade pip first
pip install --upgrade pip

# Install project dependencies
pip install -r requirements.txt
```

Expected output:
```
Successfully installed Flask-3.1.0 requests-2.32.5 beautifulsoup4-4.14.3 ...
```

### Step 5: Download German Laws

```bash
python download_de_laws.py
```

**What happens:**
- Connects to gesetze-im-internet.de
- Downloads ~6,000+ law files
- Extracts to `de_federal_raw/` directory

**Duration:** 1-2 hours (depending on internet speed)

**Progress:**
```
[████████████████████] 100% | 6234/6234 laws downloaded
```

### Step 6: Process Laws into JSON

```bash
python process_de_laws.py
```

**What happens:**
- Parses all XML files
- Converts to structured JSON
- Tokenizes content for search

**Duration:** 20-40 minutes

**Progress:**
```
[████████████████████] 100% | 6234/6234 laws processed
```

### Step 7: Start the Application

```bash
python app.py
```

Expected output:
```
2025-02-24 10:00:00 [INFO] server: German Law Search Dashboard - Server Starting
2025-02-24 10:00:00 [INFO] server: Server will be available at: http://127.0.0.1:5000
2025-02-24 10:00:00 [INFO] server: Waiting for incoming connections...
2025-02-24 10:00:05 [INFO] indexing: Building search index...
2025-02-24 10:02:30 [INFO] indexing: Index built successfully: 6234 laws
2025-02-24 10:02:30 [INFO] server: * Running on http://127.0.0.1:5000
```

### Step 8: Open in Browser

Navigate to: **http://localhost:5000**

You should see the German Law Vault dashboard!

---

## Optional: AI Features Setup

AI features provide:
- Natural language explanations
- German-English translation
- Legal analysis

### Step 1: Install Ollama

#### Windows/macOS

1. Download from [ollama.ai](https://ollama.ai)
2. Run installer
3. Ollama runs automatically in background

#### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Step 2: Pull AI Model

```bash
# Download the recommended model
ollama pull qwen2.5:1.5b
```

**Model size:** ~1 GB

**Alternative models:**
```bash
ollama pull llama3.2:1b   # Llama 3.2 1B (very light)
ollama pull mistral       # Mistral 7B
```

### Step 3: Verify Ollama

```bash
# Check running models
ollama list

# Test generation
ollama run qwen2.5:1.5b "Hello, world!"
```

### Step 4: Enable AI in Application

The application automatically detects Ollama. Verify in settings:

1. Open http://localhost:5000
2. Click ⚙️ Settings
3. Check "AI Assistant Module" is **Active**

---

## First Run

### Initial Indexing

On first launch, the application builds a search index:

1. **Status shows "Indexing..."** - Wait 2-5 minutes
2. **Progress displayed** in top-right corner
3. **Status changes to "Ready"** when complete

### Test Search

Try these example searches:

| Query | Expected Results |
|-------|------------------|
| `BGB` | Civil Code articles |
| `landlord deposit` | Tenant rights laws |
| `fired without notice` | Employment termination laws |
| `Kündigung` | German termination laws |

---

## Verification

### Checklist

- [ ] Python 3.13+ installed
- [ ] Virtual environment activated
- [ ] Dependencies installed without errors
- [ ] `de_federal_raw/` contains law files
- [ ] `de_federal_json/` contains JSON files
- [ ] Application starts without errors
- [ ] Dashboard loads in browser
- [ ] Search returns results
- [ ] (Optional) AI features working

### Quick Test Commands

```bash
# Check Python version
python --version

# Check installed packages
pip list

# Verify law files exist
ls de_federal_json/  # Should show many .json files

# Test application import
python -c "from app import app; print('OK')"
```

### Expected File Structure

```
german-law-vault/
├── .venv/                    # Virtual environment
├── de_federal_raw/           # ~2 GB, XML files
│   ├── bgb/
│   ├── stgb/
│   └── ...
├── de_federal_json/          # ~1 GB, JSON files
│   ├── BGB.json
│   ├── StGB.json
│   └── ...
├── Logs/                     # Log files
│   ├── server.log
│   ├── error.log
│   └── indexing.log
├── static/                   # Frontend assets
├── templates/                # HTML templates
├── app.py
├── requirements.txt
└── README.md
```

---

## Troubleshooting

### Python Version Error

**Error:** `This project requires Python 3.13 or higher`

**Solution:**
```bash
# Check version
python --version

# If < 3.13, download from python.org
```

### Virtual Environment Issues

**Error:** `ModuleNotFoundError: No module named 'flask'`

**Solution:**
```bash
# Ensure venv is activated
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Download Failures

**Error:** `Connection timeout` or `HTTP Error`

**Solutions:**
1. Check internet connection
2. Increase timeout in `download_de_laws.py`:
   ```python
   DOWNLOAD_TIMEOUT = 180  # Increase from 90
   ```
3. Re-run download (resumes from checkpoint)

### Processing Errors

**Error:** `XML parsing failed`

**Solutions:**
1. Check `Logs/indexing.log` for details
2. Delete problematic file from `de_federal_raw/`
3. Re-run processing

### Application Won't Start

**Error:** `Address already in use`

**Solution:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

Or change port in `app.py`:
```python
PORT = 5001  # Use different port
```

### AI Features Not Working

**Error:** `Ollama unavailable`

**Solutions:**
1. Start Ollama: `ollama serve`
2. Pull model: `ollama pull qwen2.5:1.5b`
3. Check URL in `.env`:
   ```
   OLLAMA_URL=http://127.0.0.1:11434/api/chat
   ```

### Slow Performance

**Symptoms:** Slow search, long indexing

**Solutions:**
1. Move data to SSD if using HDD
2. Close other applications
3. Increase RAM if possible
4. Disable AI features if not needed

---

## Next Steps

After successful setup:

1. **Read the [USER_GUIDE.md](USER_GUIDE.md)** - Learn how to use the dashboard
2. **Explore the [DOCUMENTATION.md](DOCUMENTATION.md)** - Developer documentation
3. **Join the community** - Report issues, contribute features

---

## Getting Help

- **Documentation:** See README.md, USER_GUIDE.md, DOCUMENTATION.md
- **Issues:** Open a GitHub issue
- **Logs:** Check `Logs/` directory for error details

---

**Setup Complete! 🎉**

You're now ready to search German laws. Open http://localhost:5000 and start exploring!
