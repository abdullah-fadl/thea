# PHASE0_PLAN.md — خطة التنفيذ خطوة بخطوة
# استخدم هالملف مع Claude Code — كل خطوة تنسخها وتعطيها Claude Code

---

## الخطوة 1: حذف ملفات Legacy Brand والـ Legacy

انسخ هالأمر وأعطه Claude Code:

```
اقرأ CLAUDE.md أولاً، ثم نفذ الخطوة 1:

1. احذف المجلد app/platforms/thea-health/ القديم بالكامل (كان باسم legacy brand سابقاً)
2. احذف كل الملفات اللي اسمها ينتهي بـ Legacy.tsx (54 ملف)
3. عدّل كل page.tsx اللي كان يستورد Legacy component — خليه يستورد الـ New version بس
   مثال: لو page.tsx فيه:
   const RegistrationLegacy = dynamic(() => import('./RegistrationLegacy'))
   const RegistrationNew = dynamic(() => import('./RegistrationNew'))
   احذف سطر Legacy وخلي New هو الـ default
4. احذف next.config.js redirect للـ legacy brand platform
5. تأكد إن yarn typecheck يمر بدون أخطاء
```

---

## الخطوة 2: تنظيف Legacy Brand من ملفات الـ Auth والـ Security

```
نفذ الخطوة 2 من PHASE0_PLAN.md:

1. في lib/db/tenantDb.ts:
   - احذف function getLegacyTenantDbName بالكامل
   - احذف كل legacy compatibility mode blocks
   - احذف أي reference لـ thea_tenant legacy أو legacy tenant DB names

2. في lib/security/auth.ts:
   - احذف legacy compatibility mode fallback logic
   - احذف legacy tenant DB names lookup

3. في lib/security/sessions.ts:
   - احذف legacy compatibility mode checks

4. في lib/auth/sessions.ts:
   - احذف legacy compatibility mode checks

5. في lib/auth/requireAuth.ts:
   - احذف legacy compatibility mode fallback

6. في lib/auth/edge.ts:
   - تأكد إن thea-owner هو الـ role الوحيد

7. تأكد إن yarn typecheck يمر
```

---

## الخطوة 3: تنظيف Legacy Brand من الـ Middleware والـ API Routes

```
نفذ الخطوة 3 من PHASE0_PLAN.md:

1. في middleware.ts:
   - تأكد إن thea-owner هو الـ role الوحيد
   - احذف أي legacy owner-dev tenant references
   - isOwnerRole لازم يشيك على thea-owner فقط

2. في app/api/auth/login/route.ts:
   - احذف أي legacy owner email fallback
   - احذف أي legacy tenant DB names lookup
   - احذف أي legacy compatibility mode logic

3. في app/api/auth/me/route.ts:
   - خلي thea-owner-dev فقط

4. في app/api/auth/identify/route.ts:
   - احذف أي legacy tenant DB names lookup

5. في كل ملفات app/api/owner/*:
   - تأكد إن thea-owner هو الـ role الوحيد

6. في app/api/platform/switch/route.ts:
   - تأكد إن thea-owner هو الـ role الوحيد

7. تأكد إن yarn typecheck يمر
```

---

## الخطوة 4: تنظيف Legacy Brand من الـ UI Components والصفحات

```
نفذ الخطوة 4 من PHASE0_PLAN.md:

1. في app/platforms/PlatformsClient.tsx:
   - احذف أي reference لـ legacy brand platform

2. في app/platforms/page.tsx:
   - احذف أي legacy owner-dev references

3. في app/platforms/thea-health/page.tsx:
   - خلي thea-owner-dev بس

4. في app/platforms/sam/page.tsx:
   - احذف أي legacy owner-dev references

5. في components/Header.tsx, components/Sidebar.tsx:
   - احذف أي legacy brand references

6. في components/thea-ui/* و components/nav/*:
   - احذف أي legacy brand references

7. في app/owner/* pages:
   - تأكد إن كل display text يذكر Thea فقط

8. في lib/entitlements.ts, lib/rbac.ts:
   - احذف أي legacy brand references

9. تأكد إن yarn typecheck يمر
```

---

## الخطوة 5: تنظيف الـ Scripts وتحديث Owner Email

```
نفذ الخطوة 5 من PHASE0_PLAN.md:

1. في scripts/bootstrapOwner.ts:
   - احذف أي legacy owner email fallback
   - الـ email يكون THEA_OWNER_EMAIL فقط

2. في scripts/seed-owner.ts:
   - احذف أي legacy owner email و password fallbacks

3. في كل الكود: غير admin@thea.health لـ thea@thea.com.sa
   ابحث عن: admin@thea.health
   غيره لـ: thea@thea.com.sa

4. احذف scripts/migrate-legacy-to-thea.ts (ما نحتاجه)

5. في lib/env.ts:
   - احذف أي legacy brand env vars

6. احذف app/admin/entitlements/page.tsx references لأي legacy brand

7. تأكد إن yarn typecheck يمر
8. سو: grep -rn "legacy brand references" --include="*.ts" --include="*.tsx" | grep -v node_modules
   لازم يرجع 0 نتائج
```

---

## الخطوة 6: تثبيت PostgreSQL وتصميم الـ Schema

```
نفذ الخطوة 6 من PHASE0_PLAN.md:

1. ثبت Prisma:
   yarn add prisma @prisma/client
   npx prisma init

2. صمم schema.prisma لكل الـ 150 collections — راجع CLAUDE.md لقائمة كل الجداول.
   اقرأ كل الـ models في lib/models/ وكل الـ collections المستخدمة في الكود.
   
   قسمها في ملفات schema منفصلة لو كبرت:
   - الجداول الأساسية (auth, tenants, users)
   - المرضى (patient_master, allergies, problems)
   - الزيارات (encounters, opd, ipd, er)
   - الطلبات والنتائج (orders, results, lab, radiology)
   - الفوترة (billing, claims, nphies)
   - الجدولة (scheduling)
   - المنصات (SAM, CDO, taxonomy)

3. كل جدول لازم يكون فيه:
   - tenant_id (TEXT, NOT NULL) — للـ multi-tenancy
   - created_at, updated_at (TIMESTAMP)
   - Foreign keys بين الجداول
   - Indexes على الحقول اللي يُبحث فيها كثير

4. DATABASE_URL يجيب من Supabase: Settings → Database → Connection string

5. سو: npx prisma migrate dev --name init
```

---

## الخطوة 7: بناء الطبقة الوسيطة (Repository Layer)

```
نفذ الخطوة 7 من PHASE0_PLAN.md:

1. أنشئ مجلد lib/repositories/

2. أنشئ repository لكل entity:
   - lib/repositories/PatientRepository.ts
   - lib/repositories/EncounterRepository.ts
   - lib/repositories/OPDEncounterRepository.ts
   - lib/repositories/BookingRepository.ts
   - lib/repositories/OrderRepository.ts
   - lib/repositories/SchedulingRepository.ts

3. كل repository يكون فيه:
   - findById(tenantId, id)
   - findMany(tenantId, filters)
   - create(tenantId, data)
   - update(tenantId, id, data)
   - delete(tenantId, id)
   
4. استخدم Prisma Client داخل الـ repositories

5. مثال:
   class OPDEncounterRepository {
     async findByEncounterCoreId(tenantId: string, encounterCoreId: string) {
       return prisma.opd_encounters.findFirst({
         where: { tenantId, encounterCoreId }
       });
     }
   }
```

---

## الخطوة 8: تحويل كل API Routes

```
نفذ الخطوة 8 من PHASE0_PLAN.md:

حوّل كل الـ 595 API route يستخدم Repository بدل db.collection().
رتبها بالأولوية:

المجموعة 1 — OPD (45 route) — الأهم:
- app/api/opd/**

المجموعة 2 — Auth (اساسي):
- app/api/auth/**

المجموعة 3 — المرضى:
- app/api/patients/**
- app/api/patient-profile/**

المجموعة 4 — الطلبات والنتائج:
- app/api/orders/**
- app/api/results/**
- app/api/lab/**
- app/api/radiology/**

المجموعة 5 — الفوترة:
- app/api/billing/**

المجموعة 6 — الجدولة:
- app/api/scheduling/**

المجموعة 7 — الباقي:
- app/api/admin/**
- app/api/er/**
- app/api/ipd/**
- app/api/nursing/**
- app/api/pharmacy/**
- app/api/portal/**
- app/api/notifications/**
- وكل شي ثاني

قبل:
  const db = ctx.db;
  const patients = db.collection('patient_master');
  const patient = await patients.findOne({ tenantId, id: patientMasterId });

بعد:
  import { patientRepo } from '@/lib/repositories/patient';
  const patient = await patientRepo.findById(tenantId, patientMasterId);

تأكد إن yarn typecheck و yarn build يمرون بعد كل مجموعة.
```

---

## الخطوة 9: إزالة MongoDB نهائياً + Docker + ENV

```
نفذ الخطوة 9 من PHASE0_PLAN.md:

1. احذف MongoDB بالكامل:
   - yarn remove mongodb
   - احذف lib/db/ (مجلد الاتصال القديم)
   - احذف lib/db-tenant.ts
   - احذف lib/db.ts
   - احذف أي import يرجع لهالملفات

2. عدّل docker-compose.yml:
   - احذف mongo service (ما نحتاجه)
   - خلي redis فقط (للـ caching)
   - أضف DATABASE_URL يأشر على Supabase

3. عدّل .env.example — أضف:
   postgresql://postgres:[TH-theakyaa26]@db.bgmcqhmfcwkywqfebndr.supabase.co:5432/postgres

4. عدّل Dockerfile — أضف:
   RUN npx prisma generate

5. عدّل next.config.js — أضف: output: 'standalone'

6. تأكد:
   - yarn typecheck يمر
   - yarn build يمر  
   - grep -rn "mongodb\|MongoClient\|Mongo" --include="*.ts" --include="*.tsx" | grep -v node_modules
     يرجع 0 نتائج
```

---

# ✅ بعد كل الخطوات

سو هالفحوصات:
```bash
# 1. ما في أي أثر لـ legacy brand
grep -rn "thea" --include="*.ts" --include="*.tsx" | grep -v node_modules
# يرجع نتائج (الاسم الجديد فقط)

# 2. ما في ملفات Legacy
find . -name "*Legacy*" | grep -v node_modules
# يرجع 0 نتائج

# 3. ما في أي أثر لـ MongoDB
grep -rn "mongodb\|MongoClient\|\.collection(" --include="*.ts" --include="*.tsx" | grep -v node_modules
# يرجع 0 نتائج

# 4. TypeScript يمر
yarn typecheck

# 5. Build يمر
yarn build

# 6. PostgreSQL يشتغل
npx prisma migrate status

# 7. Owner email صحيح
grep -rn "admin@thea.health" --include="*.ts" --include="*.tsx" | grep -v node_modules
# يرجع 0 نتائج

grep -rn "thea@thea.com.sa" --include="*.ts" --include="*.tsx" | grep -v node_modules
# يرجع نتائج (الإيميل الجديد)
```
