# macOS Setup Instructions

This guide will help you set up the policy-engine service on macOS with Vision OCR support.

## Prerequisites

### 1. Install Python 3

Install Python 3 via Homebrew:

```bash
brew install python
```

This will install Python 3 and ensure `python3` and `python3 -m pip` commands are available.

### 2. Install Poppler (Required for Vision OCR)

Poppler provides the `pdftoppm` utility needed to convert PDF pages to images:

```bash
brew install poppler
```

Verify installation:
```bash
pdftoppm -v
```

You should see version information if Poppler is installed correctly.

### 3. Create Virtual Environment

**⚠️ CRITICAL: PEP 668 on macOS blocks pip installs into Homebrew-managed Python.**
**You MUST use a virtual environment (venv) to install dependencies.**

Navigate to the `policy-engine` directory and create a virtual environment:

```bash
cd policy-engine
python3 -m venv .venv
source .venv/bin/activate
```

You should see `(.venv)` in your terminal prompt, indicating the virtual environment is active.

### 4. Install Python Dependencies

With the virtual environment activated, install dependencies:

```bash
python -m pip install -U pip
python -m pip install -r requirements.txt
python -m pip install pdf2image pillow
```

**Important:** 
- Always activate the venv first: `source .venv/bin/activate`
- Use `python -m pip` (not `python3 -m pip` or `pip`) when venv is active
- Never install packages globally on macOS - always use venv

## Starting the Service

### Option 1: Using start.sh script (Recommended)

```bash
./start.sh
```

This script will:
- Create virtual environment `.venv` if needed
- Activate the virtual environment
- Install dependencies automatically
- Start the service on http://0.0.0.0:8001

### Option 2: Manual start

```bash
# Activate virtual environment
source .venv/bin/activate

# Verify venv is active (should see (.venv) in prompt)
# Install dependencies if not already installed
python -m pip install -U pip
python -m pip install -r requirements.txt
python -m pip install pdf2image pillow

# Start the service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Dependency Checks

The service will check for required dependencies on startup. You'll see messages like:

```
[Config] ✓ pdf2image is installed
[Config] ✓ Poppler (pdftoppm) is available
```

If dependencies are missing, warnings will be displayed:

```
[Config] ⚠️ WARNING: pdf2image is not installed
[Config]    Install with: python3 -m pip install pdf2image pillow

[Config] ⚠️ WARNING: Poppler (pdftoppm) not found in PATH
[Config]    Install with: brew install poppler
```

## Troubleshooting

### "pip: command not found"

If you get this error, always use `python3 -m pip` instead of `pip`:

```bash
# ❌ This may not work on macOS
pip install pdf2image

# ✅ Use this instead
python3 -m pip install pdf2image pillow
```

### "pdftoppm: command not found"

Install Poppler:

```bash
brew install poppler
```

Verify it's in your PATH:
```bash
which pdftoppm
```

If it's not found, add Homebrew's bin directory to your PATH:

```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Vision OCR returns "OCR_DEPS_MISSING" error

Install the missing Python packages **in the virtual environment**:

```bash
# Make sure venv is activated
source .venv/bin/activate

# Install missing packages
python -m pip install pdf2image pillow
```

### Vision OCR returns "POPPLER_MISSING" error

Install Poppler:

```bash
brew install poppler
```

## Verifying Installation

After setup, test the installation:

1. Start the service (see "Starting the Service" above)
2. Check health endpoint:
```bash
curl http://localhost:8001/health
```

Expected response:
```json
{"status": "ok"}
```

3. The startup logs should show:
```
[Config] ✓ pdf2image is installed
[Config] ✓ Poppler (pdftoppm) is available
```

## Next Steps

- Set up environment variables (see README.md)
- Configure OpenAI API key for Vision OCR:
  ```bash
  export OPENAI_API_KEY=your_key_here
  ```
- Start uploading and processing PDFs!
