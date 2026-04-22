# ابدأ من هنا - تشغيل Policy Engine

## الخطوات البسيطة:

### 1. افتح Terminal جديد

### 2. انسخ والصق هذه الأوامر بالترتيب:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
./start.sh
```

### 3. انتظر حتى ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### 4. اترك هذا Terminal مفتوحاً!

---

## إذا لم يعمل السكربت:

### حاول يدوياً:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# إنشاء virtual environment
python3 -m venv venv

# تفعيل virtual environment
source venv/bin/activate

# تثبيت الحزم الأساسية
pip install --upgrade pip
pip install 'uvicorn[standard]' fastapi python-multipart pydantic pydantic-settings chromadb

# تشغيل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## بعد التشغيل:

افتح terminal آخر وتحقق:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على 3000)
- ✅ Terminal 2: `./start.sh` أو الأوامر اليدوية (policy-engine على 8001)

بعد ذلك، اذهب إلى http://localhost:3000/policies ✅
