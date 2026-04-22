# PHASE3_PLAN.md — خطة تنفيذ المرحلة الثالثة

---

## الخطوة 1: تكميل NPHIES

```
نفذ الخطوة 1 من PHASE3_PLAN.md:

1. اقرأ كل ملفات lib/integrations/nphies/ الموجودة
2. أنشئ lib/integrations/nphies/types.ts — كل الـ TypeScript interfaces
3. أنشئ lib/integrations/nphies/config.ts — إعدادات من env vars
4. كمّل eligibility.ts — طلب + response handling كامل (FHIR R4)
5. كمّل claims.ts — submission + rejection + resubmission
6. كمّل priorAuth.ts — request + approval/rejection
7. عدّل API routes المتعلقة بـ NPHIES
8. أضف NPHIES env vars لـ .env.example
9. تأكد yarn typecheck يمر
```

---

## الخطوة 2: API Documentation

```
نفذ الخطوة 2 من PHASE3_PLAN.md:

1. أنشئ lib/docs/openapi.ts — يولّد OpenAPI spec من Zod schemas
2. أنشئ app/api/docs/route.ts — يقدم الـ spec كـ JSON
3. أنشئ صفحة docs مع Scalar أو Swagger UI (admin فقط)
4. أضف JSDoc comments لأهم الـ OPD routes
5. تأكد yarn typecheck يمر
```

---

## الخطوة 3: Caching

```
نفذ الخطوة 3 من PHASE3_PLAN.md:

1. أنشئ lib/cache/index.ts — in-memory cache مع TTL (يدعم Redis لو REDIS_URL موجود)
2. أنشئ lib/cache/keys.ts — cache key builders
3. طبّق caching على:
   - Dashboard analytics (5 دقائق)
   - Department list (30 دقيقة)
   - Scheduling resources (10 دقائق)
   - Provider lists (15 دقيقة)
4. أضف cache invalidation عند الكتابة
5. تأكد yarn typecheck يمر
```

---

## الخطوة 4: Database Migrations + Seed

```
نفذ الخطوة 4 من PHASE3_PLAN.md:

1. أنشئ docs/DATABASE_MIGRATIONS.md — دليل شامل
2. أنشئ scripts/migrate-production.ts — migration آمن للإنتاج
3. أنشئ prisma/seed.ts:
   - أقسام افتراضية (عيادة عامة، طوارئ، صيدلية، مختبر، أشعة)
   - أدوار افتراضية
   - إعدادات النظام
4. أضف migration step في deploy.yml
5. تأكد yarn typecheck يمر
```

---

# ✅ بعد كل الخطوات

```bash
test -f lib/integrations/nphies/types.ts && echo "NPHIES OK"
test -f lib/cache/index.ts && echo "Cache OK"
test -f app/api/docs/route.ts && echo "Docs OK"
test -f prisma/seed.ts && echo "Seed OK"
npx tsc --noEmit  # 0 errors
```
