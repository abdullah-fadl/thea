#!/bin/bash

# Script to start policy-engine
# REQUIRES: virtual environment (.venv) to avoid PEP 668 conflicts on macOS
cd "$(dirname "$0")"

# Try to use Python 3.11 or 3.12 (better compatibility with chromadb)
PYTHON_CMD="python3"
if [ -f "/opt/homebrew/opt/python@3.12/bin/python3.12" ]; then
    PYTHON_CMD="/opt/homebrew/opt/python@3.12/bin/python3.12"
    echo "Using Python 3.12 (better compatibility)"
elif command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
    echo "Using Python 3.12 (better compatibility)"
elif command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo "Using Python 3.11 (better compatibility)"
else
    echo "Warning: Using default Python (may be 3.14) which may have compatibility issues with chromadb"
    echo "Consider installing Python 3.12: brew install python@3.12"
fi

# Create virtual environment if it doesn't exist
VENV_DIR=".venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment with $PYTHON_CMD..."
    echo "NOTE: PEP 668 on macOS blocks pip installs into Homebrew-managed Python."
    echo "      All dependencies must be installed in a virtual environment."
    $PYTHON_CMD -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Verify venv is active (python should point to venv)
if [ -z "$VIRTUAL_ENV" ]; then
    echo "ERROR: Failed to activate virtual environment!"
    echo "Please run manually: source .venv/bin/activate"
    exit 1
fi

echo "Virtual environment active: $VIRTUAL_ENV"

# Upgrade pip first
echo "Upgrading pip..."
python -m pip install --upgrade pip setuptools wheel

# Install core packages if not installed
echo "Checking if packages are installed..."
python -c "import fastapi, uvicorn" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "Installing core packages (this may take a few minutes)..."
    python -m pip install 'uvicorn[standard]' fastapi python-multipart pydantic pydantic-settings
fi

# Check if additional packages are installed
python -c "import PyPDF2, chromadb" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing additional packages..."
    python -m pip install PyPDF2 chromadb sentence-transformers || echo "Some packages failed to install"
fi

# Always ensure OCR dependencies are installed (required for Vision OCR)
python -c "import pdf2image, PIL" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing OCR dependencies (pdf2image, pillow)..."
    python -m pip install pdf2image pillow
fi

# Install remaining optional packages
python -c "import pytesseract, easyocr, numpy, dotenv" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing optional packages..."
    python -m pip install pytesseract easyocr numpy python-dotenv || echo "Some optional packages failed to install"
fi

# Verify critical dependencies
echo ""
echo "Verifying installation..."
python -c "import fastapi, uvicorn, pdf2image, PIL" && echo "✓ Core dependencies OK" || echo "⚠️ Some dependencies missing"

echo ""
echo "Starting policy-engine on http://0.0.0.0:8001..."
echo "Press CTRL+C to stop"
echo ""

# Use python from venv (not python3)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
