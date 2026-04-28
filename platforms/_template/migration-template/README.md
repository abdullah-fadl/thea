# How to Add a New Extension Table (Migration Checklist)

> Applies to: any platform adding a new table via `prisma/schema/my-platform.prisma`.
> Discipline: **additive-only**. Never drop, rename, or change a column type in a migration.

---

## Pre-flight (before writing SQL)

- [ ] The table name is lowercase snake_case and prefixed with the platform name
      (`my_platform_order_extensions`, not `order_extensions` or `my_platform_orderExtensions`).
- [ ] Every UUID column declares `@db.Uuid` in the Prisma schema.
- [ ] Every extension table has a `coreId` FK pointing to the exact core entity.
- [ ] The `@@unique([coreId])` constraint is declared (one extension per core entity).
- [ ] `tenantId String @db.Uuid` is present on the model.
- [ ] `npx prisma validate` passes on the new schema file before generating the migration.

---

## Generate the migration

```bash
npx prisma migrate dev --name add_my_platform_tables
```

Prisma creates `prisma/schema/migrations/<timestamp>_add_my_platform_tables/migration.sql`.

---

## Review the generated SQL

Open the generated `migration.sql` and confirm it is **additive-only**:

| Allowed | Forbidden |
|---|---|
| `CREATE TABLE` | `DROP TABLE` |
| `CREATE INDEX` | `DROP INDEX` |
| `ALTER TABLE … ADD COLUMN` | `ALTER TABLE … DROP COLUMN` |
| `ALTER TABLE … ADD CONSTRAINT` | `ALTER TABLE … ALTER COLUMN … TYPE` |
| `CREATE UNIQUE INDEX` | `DROP CONSTRAINT` |

If you see any forbidden operation, **stop**. Resolve the Prisma schema instead of
force-generating a destructive migration.

---

## FK constraint pattern

Every extension table FK must follow this pattern:

```sql
ALTER TABLE "my_platform_order_extensions"
  ADD CONSTRAINT "my_platform_order_extensions_coreId_fkey"
  FOREIGN KEY ("coreId") REFERENCES "core_orders"("id")
  ON DELETE CASCADE;
```

`ON DELETE CASCADE` ensures orphaned extension rows are cleaned up automatically
when the core entity is deleted. **Never use `RESTRICT` here** — core deletes must
not be blocked by platform extension rows.

---

## Unique constraint

```sql
ALTER TABLE "my_platform_order_extensions"
  ADD CONSTRAINT "my_platform_order_extensions_coreId_key" UNIQUE ("coreId");
```

---

## Backfill script (if applicable)

If the new table needs seed rows for existing core entities, write a backfill script:

```
scripts/backfill-my-platform-<table>.ts
```

Requirements:
- **Idempotent**: running it twice produces the same result.
- **Cursor-based**: process in batches of ≤ 1000 to avoid timeouts on large tenants.
- **Dry-run mode**: accept a `--dry-run` flag that logs but does not write.
- Log a summary at the end: `{ processed, created, skipped, errors }`.

Pattern (matches existing backfills in `scripts/`):

```typescript
const BATCH = 1000;
let cursor: string | undefined;
let created = 0;

do {
  const rows = await prisma.coreOrder.findMany({
    where: { id: cursor ? { gt: cursor } : undefined },
    take: BATCH,
    orderBy: { id: 'asc' },
  });
  if (!rows.length) break;

  for (const row of rows) {
    await prisma.myPlatform_OrderExtension.upsert({
      where: { coreId: row.id },
      create: { coreId: row.id, tenantId: row.tenantId },
      update: {},
    });
    created++;
  }

  cursor = rows[rows.length - 1].id;
} while (true);

console.log({ created });
```

---

## Post-deploy checklist

- [ ] `npx prisma migrate deploy` runs without errors on the target environment.
- [ ] Backfill script (if any) runs with `--dry-run` first, then live.
- [ ] Query the table to confirm row counts match expectations.
- [ ] `npx prisma validate` still passes after deploy.
- [ ] Contract test (see `../tests/contract.test.ts.example`) passes against the live DB.

---

## Rollback plan

Since all migrations are additive, rollback is a forward-only process:

1. Write a new migration that **drops** the table(s) added in the failed migration.
2. Never use `--force-reset` or edit the migration history in production.
3. Coordinate with the DBA team before any rollback on production.
