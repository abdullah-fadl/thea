# Policy Engine Service Setup & Deployment

## Overview

The Policy Engine is a **separate microservice** (FastAPI/Python) that handles policy document processing, AI-powered search, conflict detection, and other advanced policy features. It must be deployed as a **separate Render Web Service** from the main Next.js application.

## Architecture

- **Next.js Application**: Main web application (runs on port 3000 locally, or on Render at brand-xl.com)
- **Policy Engine Service**: Separate Python/FastAPI service (runs on port 8001 locally, or on Render with dynamic $PORT)
- **Communication**: Next.js API routes forward requests to Policy Engine service via HTTP

```
┌─────────────────┐         ┌──────────────────┐
│  Next.js Web    │  ────>  │  Policy Engine   │
│  (Render)       │  HTTP   │  (Render)        │
│  brand-xl.com   │         │  policy-engine   │
└─────────────────┘         └──────────────────┘
```

## Running Locally

### Prerequisites

- Python 3.9+ (3.11 recommended)
- pip

### Steps

1. Navigate to policy-engine directory:
   ```bash
   cd policy-engine
   ```

2. Create virtual environment (optional but recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables (create `.env` file):
   ```bash
   OPENAI_API_KEY=your_openai_key_here
   EMBEDDINGS_PROVIDER=openai
   OCR_PROVIDER=vision
   POLICY_ENGINE_DATA_DIR=./data
   ```

5. Start the service:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8001
   ```

6. Verify it's running:
   ```bash
   curl http://localhost:8001/health
   ```
   Should return: `{"status":"ok"}`

7. Update Next.js app `.env.local`:
   ```bash
   POLICY_ENGINE_URL=http://localhost:8001
   POLICY_ENGINE_TENANT_ID=default
   ```

## Deployment on Render

### Step 1: Create Policy Engine Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. **Connect Repository:**
   - Select **"Connect a repository"**
   - Choose **GitHub** as the Git provider
   - Search for and select: **`Yousefxll/HospitalOS2`** ✅
   - ⚠️ **CRITICAL**: Make sure it's `Yousefxll/HospitalOS2`, NOT `HMG-Dashboard`
   - Click **"Connect"**

4. Configure the service:

   **Basic Settings:**
   - **Name**: `policy-engine`
   - **Region**: Choose closest to your MongoDB/Next.js app
   - **Branch**: `main`
   - **Root Directory**: `policy-engine` ⚠️ **CRITICAL**: Must be `policy-engine` (not empty, not `/`)

   **Build & Deploy:**
   - **Environment**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**: 
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
     ⚠️ **IMPORTANT**: Use `$PORT` (Render-provided port), NOT `8001`

   **Instance Type**: 
   - Start with **Starter** (512 MB RAM)
   - Upgrade to **Standard** (1 GB RAM) if you process large PDFs

### Step 2: Configure Environment Variables

In Render Dashboard → policy-engine service → Environment:

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

**Optional (with defaults):**
```bash
POLICY_ENGINE_DATA_DIR=/var/data
OCR_PRESET=normal_ocr
VISION_OCR_MODEL=gpt-4o-mini
VISION_OCR_DETAIL=high
VISION_OCR_MAX_CONCURRENCY=2
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

**CORS Configuration:**
```bash
ALLOWED_ORIGINS=https://brand-xl.com,https://*.onrender.com,http://localhost:3000
```
⚠️ Note: Wildcards like `*.onrender.com` may not work in all CORS implementations. For production, list specific domains:
```bash
ALLOWED_ORIGINS=https://brand-xl.com,https://hospitalos2.onrender.com,http://localhost:3000
```

### Step 3: Configure Persistent Disk (Optional but Recommended)

If you want to persist policy data across redeployments:

1. In Render Dashboard → policy-engine service → **Disks**
2. Click **"Connect Disk"**
3. Configure:
   - **Name**: `policy-engine-data`
   - **Mount Path**: `/var/data`
   - **Size**: Start with 1 GB (expand as needed)

4. Set environment variable:
   ```bash
   POLICY_ENGINE_DATA_DIR=/var/data
   ```

⚠️ **Important**: Without a disk, all data will be **ephemeral** and reset on every redeploy. This is fine for testing, but production should use persistent storage.

### Step 4: Get Policy Engine Service URL

After deployment:
1. Go to Render Dashboard → policy-engine service
2. Copy the service URL (e.g., `https://policy-engine-xxxx.onrender.com`)
3. Test the health endpoint:
   ```bash
   curl https://policy-engine-xxxx.onrender.com/health
   ```
   Should return: `{"status":"ok"}`

### Step 5: Update Next.js Web App Configuration

1. Go to Render Dashboard → **Your Next.js web service** (the one running brand-xl.com)
2. Navigate to **Environment** tab
3. Add/Update:
   ```bash
   POLICY_ENGINE_URL=https://policy-engine-xxxx.onrender.com
   POLICY_ENGINE_TENANT_ID=default
   ```
   ⚠️ Replace `xxxx` with your actual service name/ID

4. **Save** and **Manual Deploy** (or wait for auto-deploy on next commit)

### Step 6: Verify Connection

1. Test from Next.js app:
   ```bash
   curl https://brand-xl.com/api/policy-engine/health
   ```
   Should return: `{"status":"ok"}`

2. Test policies endpoint:
   ```bash
   curl https://brand-xl.com/api/policy-engine/policies
   ```
   (Requires authentication cookie)

3. Check Render logs:
   - Next.js service logs should show successful connections
   - Policy Engine service logs should show incoming requests

## API Endpoints

### Health Check
```bash
GET /health
Response: {"status": "ok"}
```

### List Policies
```bash
GET /v1/policies?tenantId=default
Response: {"policies": [...]}
```

### AI Issues Detection
```bash
POST /v1/issues/ai?tenantId=default
Body: {"query": "search text"}
Response: {"issues": [...]}
```

### Ingest Policy
```bash
POST /v1/ingest?tenantId=default
Body: FormData with file
Response: {"jobId": "...", "status": "QUEUED"}
```

## Environment Variables Reference

### Policy Engine Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for embeddings/OCR |
| `EMBEDDINGS_PROVIDER` | No | `openai` | `openai` or `local` |
| `OCR_PROVIDER` | No | `auto` | `vision`, `tesseract`, or `auto` |
| `POLICY_ENGINE_DATA_DIR` | No | `./data` | Data directory (use `/var/data` with disk) |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `OCR_PRESET` | No | `normal_ocr` | OCR preset type |
| `VISION_OCR_MODEL` | No | `gpt-4o-mini` | Vision OCR model |
| `VISION_OCR_DETAIL` | No | `high` | Vision OCR detail level |
| `VISION_OCR_MAX_CONCURRENCY` | No | `2` | Max concurrent OCR requests |

### Next.js Web App

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POLICY_ENGINE_URL` | No | `http://localhost:8001` | Policy Engine service URL |
| `POLICY_ENGINE_TENANT_ID` | No | `default` | Tenant ID for multi-tenancy |

## Testing Endpoints

After deployment, test these endpoints:

### 1. Health Check
```bash
curl https://policy-engine-xxxx.onrender.com/health
```
Expected: `{"status":"ok"}`

### 2. List Policies (requires auth)
```bash
curl -X GET "https://policy-engine-xxxx.onrender.com/v1/policies?tenantId=default" \
  -H "Cookie: auth-token=your-token"
```
Expected: `{"policies": [...]}`

### 3. AI Issues Detection (requires auth)
```bash
curl -X POST "https://policy-engine-xxxx.onrender.com/v1/issues/ai?tenantId=default" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-token" \
  -d '{"query": "patient safety protocols"}'
```
Expected: `{"issues": [...]}`

## Troubleshooting

### Service Shows "Unavailable" in Web App

1. **Check Policy Engine service is running:**
   - Go to Render Dashboard → policy-engine service
   - Check **Logs** tab for errors
   - Verify service shows "Live" status

2. **Verify URL is correct:**
   - Check `POLICY_ENGINE_URL` in Next.js service environment variables
   - Test health endpoint directly: `curl https://policy-engine-xxxx.onrender.com/health`

3. **Check CORS configuration:**
   - Verify `ALLOWED_ORIGINS` includes your web domain
   - Check browser console for CORS errors
   - Policy Engine logs should show CORS preflight requests

4. **Check network connectivity:**
   - Policy Engine service must be publicly accessible
   - Next.js service must be able to reach Policy Engine URL

### Build Fails on Render

1. **Check Python version:**
   - Render should auto-detect Python 3.x
   - Ensure `requirements.txt` exists and is valid

2. **Check build logs:**
   - Look for pip install errors
   - Some packages may need system dependencies

3. **Memory issues:**
   - Upgrade to Standard instance (1 GB RAM)
   - Some ML models require significant memory

### Data Not Persisting

1. **Without persistent disk:**
   - Data resets on every redeploy (expected behavior)
   - Use Render Disk for production

2. **With persistent disk:**
   - Verify `POLICY_ENGINE_DATA_DIR=/var/data` is set
   - Check disk is mounted: `ls /var/data`
   - Verify disk size: Check Render Dashboard → Disks

### CORS Errors

1. **Check ALLOWED_ORIGINS:**
   ```bash
   # Wrong (wildcard may not work):
   ALLOWED_ORIGINS=https://*.onrender.com
   
   # Correct (list specific domains):
   ALLOWED_ORIGINS=https://brand-xl.com,https://hospitalos2.onrender.com
   ```

2. **Check credentials:**
   - Ensure `allow_credentials=True` in CORS middleware (already set)
   - Ensure cookies are sent with requests

### Performance Issues

1. **Upgrade instance type:**
   - Starter (512 MB) → Standard (1 GB) for better performance
   - Large PDFs may need more memory

2. **Optimize OCR settings:**
   - Reduce `VISION_OCR_MAX_CONCURRENCY` if hitting rate limits
   - Use `VISION_OCR_DETAIL=low` for faster processing (lower quality)

## Next Steps After Deployment

1. ✅ Policy Engine service deployed and accessible
2. ✅ Next.js app connected to Policy Engine
3. ✅ Test health endpoint from web app
4. ✅ Upload a test policy document
5. ✅ Verify AI features (search, conflicts) work
6. ✅ Monitor Render logs for errors
7. ✅ Set up persistent disk for production data

## Cost Considerations

- **Policy Engine Service**: Starts at $7/month (Starter) or $25/month (Standard)
- **Persistent Disk**: $0.25/GB/month (1 GB = $0.25/month)
- **Total**: ~$7-25/month depending on instance type and disk size

For production with heavy usage, consider upgrading to Standard instance ($25/month) for better performance and stability.
