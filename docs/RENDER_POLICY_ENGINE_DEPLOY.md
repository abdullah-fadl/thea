# Render Deployment for Policy Engine Service

## Quick Setup Guide

Follow these steps to deploy the Policy Engine service on Render.

### Step 1: Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. **Connect Repository:**
   - Select **"Connect a repository"**
   - Choose **GitHub** as the Git provider
   - Search for and select: **`Yousefxll/HospitalOS2`** ✅
   - ⚠️ **IMPORTANT**: Make sure it's `Yousefxll/HospitalOS2`, NOT `HMG-Dashboard`
   - Click **"Connect"**

### Step 2: Configure Service Settings

**Basic Settings:**
- **Name**: `policy-engine`
- **Region**: Choose closest to your main app (usually same as Next.js service)
- **Branch**: `main`
- **Root Directory**: `policy-engine` ⚠️ **CRITICAL**: Must be `policy-engine` (not empty, not `/`)
- **Runtime**: `Python 3`

**Build & Deploy:**
- **Build Command**: 
  ```bash
  pip install -r requirements.txt
  ```
- **Start Command**: 
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  ⚠️ **IMPORTANT**: Use `$PORT` (not `8001`), Render provides this dynamically

**Instance Type:**
- Start with **Starter** (512 MB RAM) for testing
- Upgrade to **Standard** (1 GB RAM) for production

### Step 3: Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add:

**Required:**
```bash
PYTHON_VERSION=3.11.11
```
⚠️ **CRITICAL**: Set this to avoid Pillow build failures on Python 3.13

```bash
OPENAI_API_KEY=sk-...your-key...
EMBEDDINGS_PROVIDER=openai
OCR_PROVIDER=vision
```

**CORS Configuration:**
```bash
ALLOWED_ORIGINS=https://brand-xl.com,https://hospitalos2.onrender.com,http://localhost:3000
```
⚠️ Replace `hospitalos2.onrender.com` with your actual Next.js service URL if different

**Optional (with defaults):**
```bash
POLICY_ENGINE_DATA_DIR=./data
OCR_PRESET=normal_ocr
VISION_OCR_MODEL=gpt-4o-mini
VISION_OCR_DETAIL=high
VISION_OCR_MAX_CONCURRENCY=2
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (first build may take 5-10 minutes)
3. Check **Logs** tab for any errors
4. Once deployed, copy the service URL (e.g., `https://policy-engine-xxxx.onrender.com`)

### Step 5: Update Main App Configuration

1. Go to Render Dashboard → Your **Next.js web service** (main app)
2. Navigate to **Environment** tab
3. Add/Update:
   ```bash
   POLICY_ENGINE_URL=https://policy-engine-xxxx.onrender.com
   ```
   ⚠️ Replace `xxxx` with your actual Policy Engine service name/ID

4. Click **"Save Changes"**
5. Go to **Manual Deploy** → **"Deploy latest commit"** (or wait for auto-deploy)

### Step 6: Verify Deployment

**Test Policy Engine Health:**
```bash
curl https://policy-engine-xxxx.onrender.com/health
```
Expected response:
```json
{"status":"ok"}
```

**Test from Main App:**
```bash
curl https://brand-xl.com/api/policy-engine/health
```
Expected response:
```json
{"status":"ok"}
```

**Check Logs:**
- Policy Engine service logs should show startup messages
- Main app logs should show successful connections to Policy Engine

## Troubleshooting

### Build Fails: "Pillow build error" or "Python version issues"

**Solution:**
- Ensure `PYTHON_VERSION=3.11.11` is set in environment variables
- Python 3.13 has compatibility issues with Pillow, use 3.11.11

### Build Fails: "No such file or directory: requirements.txt"

**Solution:**
- Verify **Root Directory** is set to `policy-engine` (not empty)
- Check that `requirements.txt` exists in the `policy-engine` directory

### Service Starts But Returns 503

**Solution:**
- Check **Start Command** uses `$PORT` (not hardcoded `8001`)
- Verify uvicorn is installed: check build logs for `pip install` output
- Check service logs for Python errors

### CORS Errors in Browser

**Solution:**
- Verify `ALLOWED_ORIGINS` includes your main app domain
- Check browser console for exact CORS error
- Policy Engine logs will show CORS preflight requests

### Connection Timeout from Main App

**Solution:**
- Verify `POLICY_ENGINE_URL` is correct in main app environment
- Test Policy Engine health endpoint directly
- Check if Policy Engine service shows "Live" status in Render dashboard

## Configuration Checklist

Use this checklist when setting up:

- [ ] Repository: `Yousefxll/HospitalOS2` (not HMG-Dashboard)
- [ ] Root Directory: `policy-engine`
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] PYTHON_VERSION: `3.11.11`
- [ ] OPENAI_API_KEY: Set (required)
- [ ] EMBEDDINGS_PROVIDER: `openai`
- [ ] OCR_PROVIDER: `vision`
- [ ] ALLOWED_ORIGINS: Includes main app domain
- [ ] Main app POLICY_ENGINE_URL: Set to Policy Engine service URL
- [ ] Health check passes: `/health` returns `{"status":"ok"}`

## After Deployment

1. ✅ Policy Engine service deployed and accessible
2. ✅ Main app `POLICY_ENGINE_URL` updated
3. ✅ Main app redeployed
4. ✅ Health check passes from both services
5. ✅ Test uploading a policy document
6. ✅ Verify Policy Library page shows policies (no "offline" banner)
