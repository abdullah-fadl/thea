# إعادة تشغيل Policy Engine Server

## المشكلة
Server يعيد خطأ OpenAI API key رغم أن `/v1/conflicts` لا يستخدم OpenAI.

## الحل

### 1. أوقف Server الحالي:
```bash
# ابحث عن process
ps aux | grep uvicorn

# أوقف process (استبدل PID بالرقم الفعلي)
kill <PID>
```

### 2. احذف ملفات Cache:
```bash
cd policy-engine
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -r {} + 2>/dev/null || true
```

### 3. أعد تشغيل Server:
```bash
cd policy-engine
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. اختبر:
```bash
curl -X POST http://localhost:8001/v1/conflicts \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"test","mode":"single","policyIdA":"test"}'
```

يجب أن يعيد خطأ 404 (policy not found) وليس خطأ OpenAI.

