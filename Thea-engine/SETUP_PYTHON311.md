# إعداد Policy Engine مع Python 3.11

## الخطوات:

### 1. تثبيت Python 3.11:

```bash
brew install python@3.11
```

### 2. افتح Terminal جديد:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف venv القديم
rm -rf venv

# إنشاء جديد بـ Python 3.11
python3.11 -m venv venv

# تفعيل
source venv/bin/activate

# تثبيت الحزم (قد يستغرق 5-10 دقائق)
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# تشغيل
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. التحقق:

افتح terminal آخر:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## ملاحظة:

إذا لم يكن `python3.11` متوفر، استخدم:
```bash
/opt/homebrew/bin/python3.11 -m venv venv
```

أو:
```bash
$(brew --prefix python@3.11)/bin/python3.11 -m venv venv
```
