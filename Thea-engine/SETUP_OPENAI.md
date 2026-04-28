# إعداد OpenAI في policy-engine

## الخطوات:

### 1. تثبيت OpenAI package:

```bash
cd policy-engine
source venv/bin/activate
pip install openai>=1.0.0
```

### 2. إضافة OpenAI API Key:

#### في Terminal:
```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

#### أو في `.env` file في مجلد policy-engine:
```
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. إعادة تشغيل policy-engine:

```bash
# أوقف policy-engine الحالي (CTRL+C)
# ثم شغله من جديد:
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## التحقق:

```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

## الميزات المدعومة الآن:

1. **POST /v1/generate** - إنشاء سياسات جديدة
2. **POST /v1/harmonize** - توحيد السياسات
3. **POST /v1/conflicts** - الكشف عن التعارضات

كل endpoint سيفحص وجود `OPENAI_API_KEY`:
- ✅ إذا كان موجود: يستخدم OpenAI
- ❌ إذا لم يكن موجود: يرجع خطأ 503

## ملاحظة:

- جميع endpoints تستخدم `gpt-4o-mini` model (اقتصادي وسريع)
- يمكن الحصول على API key من: https://platform.openai.com/api-keys

