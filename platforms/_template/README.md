# How to Add a New Platform to Thea

> **This is a scaffold template, not runtime code.**
> Copy and adapt; do not import from `platforms/_template/` in application code.

A *platform* in Thea is a bounded, independently-entitlement-gated module (SAM, CVision, Imdad, Thea Health, …).
Adding a fifth platform requires exactly **seven steps**, in order.

---

## The Seven Steps

### 1. Register the platform key

Add the new identifier to `lib/db/platformKey.ts`:

```typescript
// Before
export type PlatformKey = 'sam' | 'thea_health' | 'cvision' | 'edrac' | 'imdad';

// After — add 'my_platform'
export type PlatformKey = 'sam' | 'thea_health' | 'cvision' | 'edrac' | 'imdad' | 'my_platform';
```

Also add the pathname branch in `getPlatformKeyFromRequest()`:

```typescript
} else if (pathPlatform === 'my_platform') {
  return 'my_platform';
}
```

---

### 2. Add the entitlement column to the Tenant model

In `prisma/schema/core.prisma`, add a nullable boolean on `Tenant`:

```prisma
model Tenant {
  // …existing fields…
  entitlementMyPlatform Boolean @default(false)
}
```

Write an additive-only migration SQL (see `migration-template/README.md`).

Update `lib/entitlements.ts` to include the new key in `PlatformEntitlements`:

```typescript
export interface PlatformEntitlements {
  // …existing…
  myPlatform: boolean;
}
```

Update `computeEffectiveEntitlements()` and `getTenantEntitlements()` to propagate the new field.

---

### 3. Wire the entitlement check (copy `entitlement.ts`)

See `entitlement.ts` in this folder.  Create `lib/my-platform/entitlement.ts` following that pattern.
It must export `isMyPlatformEnabled(ctx)` so route handlers can call it without knowing the flag internals.

---

### 4. Declare the Prisma schema fragment (copy `schema.prisma.example`)

Create `prisma/schema/my-platform.prisma` following the extension-table contract:

- Every model name **must** be prefixed with the platform name (e.g., `MyPlatform_Order`, `MyPlatformOrder`).
- Every extension table **must** carry a `coreId` FK pointing to the core entity it extends.
- No column in an extension table may duplicate a column that already exists in the core entity.
- Every model **must** include `tenantId String @db.Uuid` for row-level tenant isolation.

See `schema.prisma.example` for the canonical pattern.

---

### 5. Create API routes (copy `routes/EXAMPLE.ts`)

Routes live at `app/api/my-platform/<resource>/route.ts`.

Every handler **must** use `withAuthTenant` with `platformKey: 'my_platform'`:

```typescript
export const GET = withAuthTenant(handler, {
  tenantScoped: true,
  platformKey: 'my_platform',
  permissionKey: 'my_platform.resource.read',
});
```

The guard enforces the entitlement check automatically — do **not** call `isMyPlatformEnabled` inside the handler; `withAuthTenant` does it.

---

### 6. Stub the Cedar policy (copy `policy.cedar.example`)

Create `platforms/my-platform/policies/my-platform.cedar.example`.
Full Cedar integration arrives in Phase 4.3; for now the stub documents intended access rules
so they are reviewable before the engine is wired.

---

### 7. Write the contract test (copy `tests/contract.test.ts.example`)

Create `__tests__/platforms/my-platform/contract.test.ts` covering:

- Extension FK holds (insert without a matching core row must fail).
- No direct writes to core tables from platform code.
- Emitted events (once 4.2 lands) match the registered schema.

See `tests/contract.test.ts.example` for the test skeleton.

---

## What a platform must NOT do

| Forbidden | Why |
|---|---|
| Import directly from another platform's `lib/<other>/` | Violates core-ignorance / coupling boundary |
| Write to a core table (`Patient`, `Encounter`, `CoreDepartment`, …) | Only core services may mutate core tables |
| Add a column to a core model without an explicit architectural review | Additive to extension tables; never additive to core via platform PR |
| Use string IDs where UUID FKs belong | Extension tables reference core via typed FKs |
| Hardcode business logic in middleware | Platforms declare rules in Cedar stubs; enforcement belongs in the policy engine |

---

## Existing platforms (reference implementations)

| Platform | PlatformKey | Prisma schemas | API prefix | Lib |
|---|---|---|---|---|
| Thea Health | `thea_health` | `opd.prisma`, `encounter.prisma`, `patient.prisma`, … | `app/api/` (scattered) | `lib/` (core) |
| CVision (HR) | `cvision` | `cvision-core.prisma`, `cvision-admin.prisma`, … (7 files) | `app/api/cvision/` | `lib/cvision/` |
| Imdad (SCM) | `imdad` | `imdad.prisma` | `app/api/imdad/` | (inline) |
| SAM (Policy) | `sam` | `sam.prisma` | `app/api/sam/` | `lib/sam/` |

> **Note:** Existing platforms do not fully match this template yet.
> Retrofitting them to the target shape is a separate future effort, not in scope for Phase 4.

---

## Checklist (print this when adding a platform)

- [ ] `PlatformKey` union extended in `lib/db/platformKey.ts`
- [ ] `getPlatformKeyFromRequest()` pathname branch added
- [ ] `entitlementMyPlatform` column on `Tenant` (additive migration written)
- [ ] `PlatformEntitlements` interface updated in `lib/entitlements.ts`
- [ ] `lib/my-platform/entitlement.ts` created and exported
- [ ] `prisma/schema/my-platform.prisma` created (extension-table contract respected)
- [ ] `app/api/my-platform/` routes created (all use `withAuthTenant` + `platformKey`)
- [ ] `app/platforms/my-platform/page.tsx` frontend entry created
- [ ] `platforms/my-platform/policies/*.cedar.example` stub committed
- [ ] `__tests__/platforms/my-platform/contract.test.ts` written and green
- [ ] `npx prisma validate` passes
- [ ] Backfill script written for the new entitlement column
