# حل مشكلة chromadb مع Python 3.14

## المشكلة:
Python 3.14 جديد جداً و chromadb لا يعمل معه بسبب مشاكل في التبعيات.

## الحل: استخدام Python 3.11 أو 3.12

### الخطوات:

#### 1. تثبيت Python 3.11 (إذا لم يكن مثبت):

```bash
brew install python@3.11
```

#### 2. إعادة إنشاء virtual environment باستخدام Python 3.11:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف virtual environment القديم
rm -rf venv

# إنشاء جديد بـ Python 3.11
python3.11 -m venv venv

# تفعيل
source venv/bin/activate

# تثبيت الحزم
pip install --upgrade pip
pip install -r requirements.txt

# تشغيل
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## أو: استخدام Python 3.12 (إذا متوفر):

```bash
brew install python@3.12

cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## بعد التشغيل:

افتح terminal آخر:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`
