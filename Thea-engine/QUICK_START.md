# تشغيل Policy Engine - دليل سريع

## الخطوات:

### 1. افتح Terminal جديد

### 2. شغّل هذه الأوامر:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# إنشاء venv جديد بـ Python 3.12
rm -rf venv
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv

# تفعيل
source venv/bin/activate

# تثبيت الحزم الأساسية
pip install --upgrade pip
pip install 'uvicorn[standard]' fastapi python-multipart pydantic pydantic-settings PyPDF2 chromadb==0.4.18

# (اختياري) تثبيت باقي الحزم للوظائف الكاملة
pip install sentence-transformers pdf2image pytesseract easyocr Pillow numpy python-dotenv

# شغّل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. يجب أن ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### 4. التحقق:

افتح terminal آخر:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على 3000)
- ✅ Terminal 2: الأوامر أعلاه (policy-engine على 8001)

اذهب إلى http://localhost:3000/policies ✅
