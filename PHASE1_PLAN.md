# PHASE1_PLAN.md — خطة تنفيذ المرحلة الأولى

---

## الخطوة 1: تثبيت Zod + إنشاء Validation Schemas

```
نفذ الخطوة 1 من PHASE1_PLAN.md:

1. ثبت Zod:
   yarn add zod

2. أنشئ مجلد lib/validation/ وفيه schema لكل domain:
   - opd.schema.ts — schemas لكل OPD POST/PUT/PATCH routes
   - auth.schema.ts — schemas لـ login, register, change-password, 2fa
   - patient.schema.ts — schemas لإنشاء/تعديل مريض
   - billing.schema.ts — schemas للفوترة
   - scheduling.schema.ts — schemas للحجوزات
   - orders.schema.ts — schemas للطلبات
   - admin.schema.ts — schemas لإعدادات الأدمن
   - shared.schema.ts — أشياء مشتركة (pagination, dates, etc.)

3. اقرأ كل POST/PUT/PATCH route في app/api/ وصمم schema مناسب له
   - اقرأ الـ body fields اللي يستخدمها حالياً
   - حولها لـ Zod schema مع types صحيحة
   - أضف validation messages واضحة

4. تأكد yarn typecheck يمر
```

---

## الخطوة 2: تطبيق Validation على كل Route

```
نفذ الخطوة 2 من PHASE1_PLAN.md:

1. أنشئ lib/validation/helpers.ts فيه:
   - validateBody(body, schema) — يرجع { data } أو { error: NextResponse }
   - هالـ helper يستخدمه كل route

2. طبّق الـ validation على كل POST/PUT/PATCH route:
   
   ابدأ بالأهم:
   - app/api/opd/** (كل الـ OPD routes)
   - app/api/auth/** (login, change-password, etc.)
   - app/api/billing/** 
   
   ثم:
   - app/api/patients/**
   - app/api/scheduling/**
   - app/api/orders/**
   - app/api/admin/**
   - app/api/owner/**
   - وكل route ثاني فيه POST/PUT/PATCH

   Pattern:
   const parsed = schema.safeParse(body);
   if (!parsed.success) {
     return NextResponse.json(
       { error: 'Validation failed', details: parsed.error.flatten() },
       { status: 400 }
     );
   }

3. تأكد yarn typecheck يمر بعد كل مجموعة
```

---

## الخطوة 3: Error Handler موحد

```
نفذ الخطوة 3 من PHASE1_PLAN.md:

1. أنشئ lib/core/errors.ts فيه:
   - class ApiError (base)
   - class BadRequestError (400)
   - class NotFoundError (404)
   - class ConflictError (409)
   - class ForbiddenError (403)
   - function withErrorHandler(handler) — يلف أي route

2. أنشئ lib/core/safeBody.ts:
   - async function safeParseBody(req) — يقرأ JSON بأمان

3. طبّق withErrorHandler على كل route:
   
   قبل:
   export const POST = withAuthTenant(async (req, ctx) => {
     // ... code that might throw
   });

   بعد:
   export const POST = withAuthTenant(
     withErrorHandler(async (req, ctx) => {
       // ... same code, but errors are caught automatically
     })
   );

4. تأكد yarn typecheck يمر
```

---

## الخطوة 4: .env.example شامل

```
نفذ الخطوة 4 من PHASE1_PLAN.md:

1. اسكن كل env vars في المشروع:
   grep -rn "process.env\." --include="*.ts" --include="*.tsx" | grep -oP 'process\.env\.\K[A-Z_]+' | sort -u

2. أنشئ .env.example في جذر المشروع فيه:
   - كل env var مستخدم
   - مقسم بفئات (Database, Auth, App, etc.)
   - كل var فيه:
     - شرح بالعربي والإنجليزي
     - هل هو مطلوب أو اختياري
     - مثال على القيمة
   - الـ Supabase DATABASE_URL و DIRECT_URL
   - الـ THEA_OWNER_EMAIL=thea@thea.com.sa

3. احذف أي legacy brand vars لو باقي في أي مكان
```

---

## الخطوة 5: Docker

```
نفذ الخطوة 5 من PHASE1_PLAN.md:

1. عدّل next.config.js — أضف: output: 'standalone'

2. أنشئ Dockerfile:
   - Multi-stage: deps → build → runner
   - Node 20 Alpine
   - npx prisma generate في الـ build stage
   - Non-root user
   - EXPOSE 3000

3. أنشئ docker-compose.yml:
   - app service (Next.js)
   - redis service (Alpine)
   - NO mongo, NO postgres (نستخدم Supabase)
   - Health checks
   - Environment from .env

4. أنشئ .dockerignore:
   node_modules, .next, .git, *.md, .env.local

5. جرب:
   docker-compose build
   docker-compose up -d
```

---

## الخطوة 6: CI/CD Pipeline

```
نفذ الخطوة 6 من PHASE1_PLAN.md:

1. أنشئ .github/workflows/ci.yml:
   - Trigger: push + pull_request
   - Steps: checkout, setup-node, yarn install, prisma generate, typecheck, lint, build

2. أنشئ .github/workflows/deploy.yml (placeholder):
   - Trigger: push to main
   - Steps: build docker image, push to registry
   - اكتب TODO comments للـ deployment steps

3. تأكد:
   - yarn typecheck يمر
   - yarn lint يمر
   - yarn build يمر
```

---

# ✅ بعد كل الخطوات

```bash
# 1. Validation موجود
grep -rn "safeParse" app/api/ | wc -l
# لازم > 50

# 2. Error handling موجود
grep -rn "withErrorHandler" app/api/ | wc -l
# لازم > 50

# 3. .env.example شامل
test -f .env.example && echo "EXISTS" || echo "MISSING"

# 4. Docker يشتغل
test -f Dockerfile && echo "EXISTS" || echo "MISSING"
test -f docker-compose.yml && echo "EXISTS" || echo "MISSING"

# 5. CI pipeline موجود
test -f .github/workflows/ci.yml && echo "EXISTS" || echo "MISSING"

# 6. Zero TypeScript errors
npx tsc --noEmit
```
