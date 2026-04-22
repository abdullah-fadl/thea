# Database Migrations Guide / دليل ترحيل قواعد البيانات

## Overview / نظرة عامة

Thea EHR uses **Prisma ORM** with **PostgreSQL** (hosted on Supabase) for all
database operations. Migrations are managed through Prisma Migrate, which tracks
schema changes in SQL migration files stored under `prisma/migrations/`.

يستخدم نظام Thea EHR إطار عمل **Prisma ORM** مع قاعدة بيانات **PostgreSQL**
(المستضافة على Supabase). تُدار عمليات الترحيل عبر Prisma Migrate التي تتبع
تغييرات المخطط في ملفات SQL محفوظة تحت `prisma/migrations/`.

---

## Schema Structure / بنية المخطط

The Prisma schema is split into multiple files under `prisma/schema/`:

المخطط مقسم إلى عدة ملفات تحت `prisma/schema/`:

| File / الملف              | Domain / المجال                                  |
|---------------------------|--------------------------------------------------|
| `base.prisma`             | Generator, datasource, shared enums              |
| `core.prisma`             | Tenant, User, Session, AuditLog, SystemSetting   |
| `patient.prisma`          | PatientMaster, Allergies, Problems, Insurance     |
| `encounter.prisma`        | EncounterCore (shared across ER/OPD/IPD)          |
| `opd.prisma`              | OPD encounters, bookings, orders, census          |
| `er.prisma`               | ER encounters, beds, triage, notes                |
| `clinical.prisma`         | Visit notes, physical exams, death declarations   |
| `clinical_infra.prisma`   | Providers, clinics, specialties, departments      |
| `orders.prisma`           | OrdersHub, results, events, attachments           |
| `scheduling.prisma`       | Resources, slots, reservations, templates         |

---

## Environment Variables / متغيرات البيئة

Three connection strings serve different purposes:

ثلاث سلاسل اتصال تخدم أغراضاً مختلفة:

| Variable / المتغير | Purpose / الغرض                                        |
|---------------------|--------------------------------------------------------|
| `DATABASE_URL`      | Application runtime (pooler, transaction mode)         |
| `DIRECT_URL`        | Direct connection for Prisma Client (session mode)     |
| `MIGRATION_URL`     | Direct connection for migrations (no pooler)           |

The `prisma.config.ts` file resolves the URL in this priority order:
`MIGRATION_URL` > `DIRECT_URL` > `DATABASE_URL`.

ملف `prisma.config.ts` يحل عنوان URL بهذا الترتيب:
`MIGRATION_URL` > `DIRECT_URL` > `DATABASE_URL`.

> **Important / مهم**: Migrations must run against a **direct** connection (not
> a pooled/transaction-mode connection). Supabase pooler connections on port 6543
> will fail during migrations. Use port 5432 or the direct `db.<ref>.supabase.co`
> host.

---

## Creating a New Migration / إنشاء ترحيل جديد

### 1. Edit the Schema / تعديل المخطط

Edit the appropriate file in `prisma/schema/`. Each file covers a specific
domain. For example, to add a field to OPD encounters, edit `prisma/schema/opd.prisma`.

عدّل الملف المناسب في `prisma/schema/`. كل ملف يغطي مجالاً محدداً.
مثلاً لإضافة حقل لزيارات العيادات الخارجية، عدّل `prisma/schema/opd.prisma`.

### 2. Generate the Migration / توليد الترحيل

```bash
npx prisma migrate dev --name descriptive_name
```

This command:
1. Compares the schema files to the current database state
2. Generates a SQL migration file in `prisma/migrations/`
3. Applies the migration to your development database
4. Regenerates the Prisma Client

هذا الأمر:
1. يقارن ملفات المخطط بحالة قاعدة البيانات الحالية
2. يولّد ملف ترحيل SQL في `prisma/migrations/`
3. يطبّق الترحيل على قاعدة بيانات التطوير
4. يعيد توليد Prisma Client

### 3. Naming Conventions / اصطلاحات التسمية

Use **snake_case** and be descriptive. Prefix with the operation type:

استخدم **snake_case** وكن وصفياً. ابدأ بنوع العملية:

| Prefix / البادئة | When to use / متى تُستخدم                  | Example / مثال                            |
|-------------------|---------------------------------------------|-------------------------------------------|
| `add_`            | Adding a new table or column                | `add_patient_insurance_table`             |
| `alter_`          | Modifying an existing column                | `alter_encounter_status_enum`             |
| `drop_`           | Removing a table or column                  | `drop_legacy_opd_manpower`               |
| `create_`         | Creating indexes or constraints             | `create_index_on_encounter_date`          |
| `rename_`         | Renaming a table or column                  | `rename_clinic_to_clinical_infra`         |
| `backfill_`       | Data backfill migration                     | `backfill_provider_department_key`        |
| `seed_`           | Inserting reference/lookup data             | `seed_default_departments`               |

### 4. Verify the Migration / التحقق من الترحيل

```bash
# Check migration status
npx prisma migrate status

# Regenerate client (if needed)
npx prisma generate
```

---

## Applying Migrations in Production / تطبيق الترحيلات في بيئة الإنتاج

**Never** run `prisma migrate dev` in production. Use the production migration
script instead.

**لا** تشغّل `prisma migrate dev` في بيئة الإنتاج. استخدم سكريبت الترحيل
الإنتاجي بدلاً من ذلك.

### Pre-deployment Check / فحص ما قبل النشر

```bash
npx tsx scripts/migrate-production.ts --check
```

This shows pending migrations without applying them. Run this before every
deployment to verify the migration state.

يعرض هذا الترحيلات المعلقة دون تطبيقها. شغّله قبل كل نشر للتحقق من حالة
الترحيل.

### View Status / عرض الحالة

```bash
npx tsx scripts/migrate-production.ts --status
```

### Apply Migrations / تطبيق الترحيلات

```bash
npx tsx scripts/migrate-production.ts --apply
```

This runs `prisma migrate deploy` which:
1. Applies all pending migrations in order
2. Records each migration in the `_prisma_migrations` table
3. Regenerates the Prisma Client
4. Verifies database connectivity with a `SELECT 1` check

هذا يشغّل `prisma migrate deploy` الذي:
1. يطبّق جميع الترحيلات المعلقة بالترتيب
2. يسجّل كل ترحيل في جدول `_prisma_migrations`
3. يعيد توليد Prisma Client
4. يتحقق من اتصال قاعدة البيانات بفحص `SELECT 1`

### CI/CD Integration / التكامل مع CI/CD

The deploy workflow (`.github/workflows/deploy.yml`) runs migrations
automatically as part of the deployment pipeline:

يشغّل سير عمل النشر (`.github/workflows/deploy.yml`) الترحيلات تلقائياً
كجزء من خط النشر:

```yaml
- name: Run database migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    DIRECT_URL: ${{ secrets.DIRECT_URL }}
```

---

## Rollback Strategy / استراتيجية التراجع

Prisma does not have a built-in rollback command. Instead, follow this process:

لا يملك Prisma أمر تراجع مدمج. بدلاً من ذلك، اتبع هذه العملية:

### 1. Backup Before Migration / النسخ الاحتياطي قبل الترحيل

Always create a backup before running migrations in production:

أنشئ دائماً نسخة احتياطية قبل تشغيل الترحيلات في الإنتاج:

```bash
npx tsx scripts/backup.ts --tenant=<tenantId> --output=./backups/
```

### 2. Create a Reversal Migration / إنشاء ترحيل عكسي

If a migration needs to be undone, create a new migration that reverses the
changes:

إذا احتاج ترحيل للتراجع، أنشئ ترحيلاً جديداً يعكس التغييرات:

```bash
# Example: if you added a column, create a migration to drop it
npx prisma migrate dev --name revert_add_insurance_field
```

### 3. Manual SQL Rollback (Emergency) / تراجع SQL يدوي (طوارئ)

For critical production issues, you can run raw SQL directly:

للمشاكل الحرجة في الإنتاج، يمكنك تشغيل SQL مباشرة:

```sql
-- Remove a column added by mistake
ALTER TABLE patient_master DROP COLUMN IF EXISTS new_field;

-- Then mark the migration as rolled back in Prisma's tracking table
DELETE FROM _prisma_migrations WHERE migration_name = '20260101000000_add_new_field';
```

> **Warning / تحذير**: Manual SQL rollbacks bypass Prisma's migration tracking.
> After a manual rollback, run `npx prisma migrate resolve --applied <name>`
> or `--rolled-back <name>` to synchronize the migration state.

---

## Seeding the Database / تهيئة قاعدة البيانات بالبيانات الأولية

### Running the Seed Script / تشغيل سكريبت البذر

```bash
npx prisma db seed
```

Or directly:

أو مباشرة:

```bash
npx tsx prisma/seed.ts
```

The seed script inserts:
- Default departments (15 departments with Arabic/English names)
- Default system settings (locale, timezone, currency, date format, etc.)

سكريبت البذر يُدخل:
- الأقسام الافتراضية (15 قسماً بأسماء عربية/إنجليزية)
- إعدادات النظام الافتراضية (اللغة، المنطقة الزمنية، العملة، صيغة التاريخ، إلخ)

The seed script uses `upsert` operations, making it safe to run multiple times
(idempotent).

يستخدم سكريبت البذر عمليات `upsert`، مما يجعله آمناً للتشغيل عدة مرات
(متساوي الأثر).

---

## Testing Migrations / اختبار الترحيلات

### 1. Local Development / التطوير المحلي

```bash
# Run against local PostgreSQL (Docker)
docker compose up -d db
npx prisma migrate dev --name my_change
```

### 2. Staging Environment / بيئة التجربة

Always apply migrations to a staging database before production:

طبّق الترحيلات دائماً على قاعدة بيانات تجريبية قبل الإنتاج:

```bash
# Point to staging DATABASE_URL
DATABASE_URL=postgresql://staging... npx prisma migrate deploy
```

### 3. Verify Migration State / التحقق من حالة الترحيل

```bash
npx prisma migrate status
```

### 4. Health Check / فحص صحة النظام

After applying migrations, verify the application health endpoint:

بعد تطبيق الترحيلات، تحقق من نقطة فحص صحة التطبيق:

```bash
curl http://localhost:3000/api/health
```

---

## Multi-tenant Considerations / اعتبارات تعدد المستأجرين

Thea EHR uses a **single database** with tenant isolation via `tenantId` columns.
All migrations apply to the shared database and affect all tenants simultaneously.

يستخدم Thea EHR **قاعدة بيانات واحدة** مع عزل المستأجرين عبر عمود `tenantId`.
تُطبّق جميع الترحيلات على قاعدة البيانات المشتركة وتؤثر على جميع المستأجرين
في آن واحد.

### Key rules / قواعد أساسية:

1. **Every tenant-scoped table** must have a `tenantId` column with an index
2. **Unique constraints** should be compound: `@@unique([tenantId, code])` not `@unique`
3. **Data migrations** must iterate over all tenants, not assume a single tenant
4. **New columns** should have defaults to avoid breaking existing tenant data

1. **كل جدول مرتبط بمستأجر** يجب أن يحتوي على عمود `tenantId` مع فهرس
2. **قيود التفرد** يجب أن تكون مركبة: `@@unique([tenantId, code])` وليس `@unique`
3. **ترحيل البيانات** يجب أن يمر على جميع المستأجرين، لا يفترض مستأجراً واحداً
4. **الأعمدة الجديدة** يجب أن تحتوي على قيم افتراضية لتجنب كسر بيانات المستأجرين الحاليين

---

## Troubleshooting / استكشاف الأخطاء

### Migration drift / انحراف الترحيل

If the database schema has drifted from the migration history:

إذا انحرف مخطط قاعدة البيانات عن سجل الترحيل:

```bash
# Check for drift
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema --shadow-database-url $SHADOW_DB_URL

# Baseline (mark current state as applied)
npx prisma migrate resolve --applied <migration_name>
```

### Failed migration / ترحيل فاشل

If a migration fails partway through:

إذا فشل ترحيل في منتصف الطريق:

```bash
# Mark as rolled back so you can fix and re-apply
npx prisma migrate resolve --rolled-back <migration_name>

# Fix the issue, then re-run
npx prisma migrate deploy
```

### Connection issues / مشاكل الاتصال

Common connection problems and solutions:

مشاكل الاتصال الشائعة وحلولها:

| Problem / المشكلة                        | Solution / الحل                                      |
|------------------------------------------|------------------------------------------------------|
| "prepared statement already exists"      | Use `DIRECT_URL` (session mode, port 5432)           |
| Timeout during migration                 | Use `MIGRATION_URL` (direct, no pooler)              |
| SSL connection error                     | Add `?sslmode=require` to connection string          |
| Permission denied                        | Verify database user has DDL privileges              |

---

## Quick Reference / مرجع سريع

```bash
# Generate migration (dev only)
npx prisma migrate dev --name <name>

# Check status
npx prisma migrate status

# Apply production migrations
npx prisma migrate deploy

# Safe production migration with logging
npx tsx scripts/migrate-production.ts --apply

# Regenerate Prisma Client
npx prisma generate

# Seed database
npx prisma db seed

# Create backup before migration
npx tsx scripts/backup.ts --tenant=<id>

# Reset development database (DESTRUCTIVE)
npx prisma migrate reset
```
