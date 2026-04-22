# Virtual Environment Setup (Required for macOS)

## Why Virtual Environment?

**PEP 668 on macOS blocks pip installs into Homebrew-managed Python** (externally-managed-environment). This is a Python security feature to prevent conflicts with system packages.

**You MUST use a virtual environment (venv) to install dependencies.**

## Quick Setup

```bash
cd policy-engine
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install -r requirements.txt
python -m pip install pdf2image pillow
```

## Starting the Service

### Using start.sh (Recommended)

The `start.sh` script automatically handles venv creation and activation:

```bash
./start.sh
```

### Manual Start

```bash
cd policy-engine
source .venv/bin/activate  # Activate venv first!
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Important Notes

1. **Always activate venv before installing packages:**
   ```bash
   source .venv/bin/activate  # You should see (.venv) in your prompt
   ```

2. **Use `python -m pip` (not `pip` or `python3 -m pip`) when venv is active:**
   ```bash
   # ✅ Correct (when venv is active)
   python -m pip install pdf2image pillow
   
   # ❌ Wrong (when venv is active)
   pip install pdf2image pillow
   python3 -m pip install pdf2image pillow
   ```

3. **Never install packages globally on macOS:**
   ```bash
   # ❌ This will fail on macOS due to PEP 668
   python3 -m pip install --user pdf2image pillow
   ```

4. **Verify venv is active:**
   ```bash
   which python  # Should point to .venv/bin/python
   echo $VIRTUAL_ENV  # Should show path to .venv
   ```

## Troubleshooting

### "externally-managed-environment" Error

If you see this error:
```
error: externally-managed-environment

× This environment is externally managed
```

**Solution:** You're trying to install globally. Use venv instead:

```bash
cd policy-engine
python3 -m venv .venv
source .venv/bin/activate
python -m pip install pdf2image pillow
```

### "pip: command not found"

If `pip` is not found, use `python -m pip`:

```bash
# Activate venv first
source .venv/bin/activate

# Then use python -m pip
python -m pip install pdf2image pillow
```

### Packages installed but not found

If packages are installed but Python can't find them:

1. Verify venv is active:
   ```bash
   which python  # Should be .venv/bin/python
   ```

2. Reinstall in venv:
   ```bash
   source .venv/bin/activate
   python -m pip install --force-reinstall pdf2image pillow
   ```

## Verifying Installation

After installing in venv, verify packages are available:

```bash
source .venv/bin/activate
python -c "import pdf2image, PIL; print('✓ OCR dependencies installed')"
```

Expected output:
```
✓ OCR dependencies installed
```

If you see `ImportError`, the packages are not installed in the active venv.
