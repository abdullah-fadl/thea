# PHASE2_PLAN.md — خطة تنفيذ المرحلة الثانية

---

## الخطوة 1: Loading و Error States

```
نفذ الخطوة 1 من PHASE2_PLAN.md:

1. أنشئ 3 components مشتركة:
   - components/ui/PageLoading.tsx — skeleton loader لصفحة كاملة
   - components/ui/SectionLoading.tsx — skeleton loader لقسم
   - components/ui/PageError.tsx — صفحة خطأ مع زر retry + رجوع

2. أضف loading.tsx لكل route group:
   - app/(dashboard)/loading.tsx
   - app/(dashboard)/opd/loading.tsx
   - app/(dashboard)/er/loading.tsx
   - app/(dashboard)/ipd/loading.tsx
   - app/(dashboard)/billing/loading.tsx
   - app/(dashboard)/admin/loading.tsx
   - app/(portal)/loading.tsx
   - app/owner/loading.tsx
   - وأي مجلد route ثاني ما عنده loading.tsx

3. أضف error.tsx لكل route group (نفس القائمة فوق)
   - لازم يكون 'use client'
   - يعرض رسالة خطأ بالعربي
   - فيه زر "حاول مرة ثانية" و "رجوع"

4. أضف app/not-found.tsx — صفحة 404 بالعربي

5. تأكد yarn typecheck يمر
```

---

## الخطوة 2: نظام المراقبة والسجلات

```
نفذ الخطوة 2 من PHASE2_PLAN.md:

1. أنشئ lib/monitoring/logger.ts:
   - Structured logger بمستويات: debug, info, warn, error
   - في development: pretty print ملون
   - في production: JSON format
   - كل log فيه: timestamp, level, message, context

2. أنشئ lib/monitoring/health.ts:
   - فحص قاعدة البيانات (Prisma)
   - فحص الذاكرة
   - Uptime tracking

3. أنشئ أو عدّل app/api/health/route.ts:
   - GET يرجع: { status, database, uptime, memory, version }
   - ?detailed=true للتفاصيل الكاملة

4. استبدل console.log/error في app/api/ و lib/ بالـ logger:
   - logger.info() بدل console.log()
   - logger.error() بدل console.error()
   - أضف context (tenantId, userId) لكل log
   - لا تغير الملفات في scripts/

5. تأكد yarn typecheck يمر
```

---

## الخطوة 3: النسخ الاحتياطي

```
نفذ الخطوة 3 من PHASE2_PLAN.md:

1. أنشئ app/api/admin/backup/route.ts:
   - GET: حالة النسخ الاحتياطي
   - POST: يصدّر البيانات المهمة كـ JSON

2. أنشئ lib/backup/export.ts:
   - يصدّر: patients, encounters, bookings
   - يضغط بـ gzip
   - يرجع كملف قابل للتحميل

3. أنشئ scripts/backup.ts:
   - CLI script للنسخ الاحتياطي المجدول
   - Usage: npx tsx scripts/backup.ts --tenant=<id>

4. أضف تعليق في .env.example عن:
   - Supabase Point-in-Time Recovery
   - النسخ الاحتياطي اليومي التلقائي

5. تأكد yarn typecheck يمر
```

---

# ✅ بعد كل الخطوات

```bash
# Loading states
find app/ -name "loading.tsx" | wc -l  # > 8

# Error states  
find app/ -name "error.tsx" | wc -l  # > 8

# Health endpoint
test -f app/api/health/route.ts && echo "OK"

# Logger usage
grep -rn "from '@/lib/monitoring/logger'" app/api/ lib/ | wc -l  # > 50

# Backup endpoint
test -f app/api/admin/backup/route.ts && echo "OK"

# TypeScript
npx tsc --noEmit  # 0 errors
```
