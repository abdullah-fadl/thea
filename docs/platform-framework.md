# Thea Platform Framework — Design Document

> **Phase 4.1 deliverable.** This document describes the target architecture for
> Thea's platform extension model. Existing platforms (CVision, Imdad, SAM) do
> not fully match this target yet — retrofitting them is deferred to a future phase.

---

## Executive Summary

Thea supports multiple independently-entitlement-gated platforms (SAM, CVision, Imdad, Thea Health) that share a common core (Patients, Encounters, Departments, Users, Audit). The platform framework defines how new platforms plug into that core **without coupling to each other** and without burdening core services with platform-specific logic.

The framework is built on seven conditions a platform must satisfy. Any module that satisfies all seven is a *first-class platform*; any module that violates one is considered *unregistered* and loses the safety guarantees the framework provides.

---

## The Seven Conditions

### 1. Core-Ignorant

A platform's business logic (`lib/<platform>/`) must never import from another platform's library or from core service internals. Platforms may read core *data* (via Prisma queries) but must not call core *service functions* directly.

**What this means in practice:**
- `lib/cvision/lifecycle.ts` must not import `lib/sam/coverageRules.ts`.
- `lib/my-platform/order.ts` must not call `lib/core/encounter/create.ts`.
- Shared utilities (`lib/utils/`, `lib/monitoring/`) are exempt — they are infrastructure, not domain logic.

**Why:** Coupling between platforms creates a distributed monolith. Platforms must be independently deployable in the future.

---

### 2. SDK-Based (withAuthTenant)

Every platform API route must go through `withAuthTenant` from `lib/core/guards/withAuthTenant.ts`. There is no approved alternative.

```typescript
export const GET = withAuthTenant(handler, {
  tenantScoped: true,
  platformKey: 'my_platform',
  permissionKey: 'my_platform.resource.read',
});
```

Declaring `platformKey` is what triggers the entitlement gate. The guard:
1. Validates the JWT.
2. Resolves `tenantId` from the token.
3. Checks that `entitlement<Platform>` is `true` on the Tenant row (unless the caller is a thea-owner or admin).
4. Checks the granular permission (`permissionKey`) against the user's role.

**What this means in practice:** No platform route handler should contain inline JWT parsing, inline `getTenantEntitlements()` calls, or inline subscription checks. That logic belongs exclusively in the guard.

---

### 3. Event-Versioned

Every state-mutating platform action that other modules might care about must emit a domain event with a `schemaVersion` integer.

> **Phase 4.2 note:** The event emitter and schema registry do not exist yet. Platform teams should declare their intended events in `lib/<platform>/events/subscribe.ts` (see template stub) so Phase 4.2 can validate the registry against declared subscribers.

Rules:
- Event types are namespaced: `<platform>.<entity>.<verb>` (e.g., `cvision.employee.terminated`).
- Payload shapes are TypeScript interfaces, versioned starting at 1.
- Breaking changes to a payload require a new `schemaVersion` (never modify v1 shape in place).
- Core must never subscribe to platform events (core is platform-ignorant).

---

### 4. Extension-Table Contract

A platform that needs to attach data to a core entity (Patient, Encounter, etc.) must use the extension-table pattern:

```
platform_<entity>_extensions
  ├── id         UUID PK
  ├── coreId     UUID FK → core_entity.id  (UNIQUE — one extension per core entity)
  ├── tenantId   UUID                       (row-level isolation)
  └── <platform-specific columns>
```

**Rules (enforced by contract test Contract 1):**
- `coreId` must be a typed UUID FK with `ON DELETE CASCADE`.
- `@@unique([coreId])` must be declared (one extension per core entity).
- No column in the extension table may duplicate a column on the core entity.
- Platform-specific columns must be prefixed or grouped so they don't collide with future core additions.

**Why:** Extension tables preserve the additive-only discipline. Adding platform data never requires altering a core table, which means platform migrations cannot break core functionality.

---

### 5. Declarative Policy

Access rules must be declared as Cedar policy stubs in `platforms/<name>/policies/`.
This is a placeholder until Phase 4.3 wires the Cedar policy engine, but the stubs serve as a reviewable contract today.

Policy files must declare:
- Which roles may read/write which platform resources.
- That the tenant entitlement must be true for any platform action.
- That platform principals are forbidden from writing to core entities.

---

### 6. Central Ontology (Entitlement Registration)

Every platform must register itself in three central locations:

| Location | What to add |
|---|---|
| `lib/db/platformKey.ts` | Union type member + `getPlatformKeyFromRequest()` branch |
| `prisma/schema/core.prisma` `Tenant` model | `entitlement<Platform> Boolean @default(false)` |
| `lib/entitlements.ts` `PlatformEntitlements` | Key + propagation in `computeEffectiveEntitlements()` |

These three registrations are the authoritative source of truth for what platforms exist in Thea. There is intentionally no auto-discovery — every platform is an explicit, reviewed addition.

---

### 7. Contract-Tested

Every platform must have a contract test at `__tests__/platforms/<name>/contract.test.ts` that passes three checks:

| Check | What it verifies |
|---|---|
| Contract 1 — FK integrity | Extension table rejects orphaned rows (DB constraint is in place) |
| Contract 2 — No core writes | Platform lib does not call `prisma.<coreEntity>.create/update/delete` (static grep) |
| Contract 3 — Event schema | Emitted events satisfy the registered payload interface (Phase 4.2+, currently `.todo`) |

The contract tests run as part of the standard `yarn jest` suite and must remain green on every PR.

---

## "Do Not Cross" Boundaries

These are bright lines. Crossing any of them is an architectural violation, not a style preference.

```
┌─────────────────────────────────────────────────────────────────┐
│  CORE                                                           │
│  (Patient, Encounter, CoreDepartment, CoreUnit, User, Audit)    │
│                                                                 │
│  ← Platforms may READ core data via Prisma queries             │
│  ✗ Platforms must NOT write to core tables                      │
│  ✗ Core services must NOT import from platform libs             │
│  ✗ Platform migrations must NOT ALTER or DROP core columns      │
└─────────────────────────────────────────────────────────────────┘
        ↓ FK (coreId)        ↓ FK (coreId)       ↓ FK (coreId)
┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐
│  SAM         │   │  CVision     │   │  Imdad               │
│  extensions  │   │  extensions  │   │  extensions          │
└──────────────┘   └──────────────┘   └──────────────────────┘
        ✗ Cross-platform imports are forbidden
        ✗ String joins where UUID FKs belong
        ✗ Platform-specific logic in middleware (use Cedar stubs)
```

---

## Worked Example: Adding "Thea-Pharmacy"

Suppose we want to add a fifth platform, **Thea-Pharmacy**, for medication dispensing workflows. Here is exactly what we would do with this template:

**Step 1 — Copy the template**
```bash
cp -r platforms/_template platforms/thea-pharmacy
```

**Step 2 — Register the platform key** (`lib/db/platformKey.ts`)
```typescript
export type PlatformKey = 'sam' | 'thea_health' | 'cvision' | 'edrac' | 'imdad' | 'thea_pharmacy';
```

**Step 3 — Add the entitlement column** (`prisma/schema/core.prisma`)
```prisma
model Tenant {
  // …existing…
  entitlementPharmacy Boolean @default(false)
}
```
Generate migration: `npx prisma migrate dev --name add_pharmacy_entitlement`.

**Step 4 — Add to `lib/entitlements.ts`**
```typescript
export interface PlatformEntitlements {
  // …existing…
  pharmacy: boolean;
}
```

**Step 5 — Create `lib/thea-pharmacy/entitlement.ts`** (from template `entitlement.ts`)
```typescript
export async function isPharmacyEnabled(ctx): Promise<boolean> { … }
```

**Step 6 — Create schema** (`prisma/schema/thea-pharmacy.prisma`)
Following the extension-table contract. Example: `TheaPharmacy_DispensationExtension`.

**Step 7 — Create API routes** (`app/api/thea-pharmacy/`)
All handlers use `withAuthTenant({ platformKey: 'thea_pharmacy', … })`.

**Step 8 — Create frontend entry** (`app/platforms/thea-pharmacy/page.tsx`)

**Step 9 — Stub Cedar policy** (`platforms/thea-pharmacy/policies/thea-pharmacy.cedar.example`)

**Step 10 — Write contract test** (`__tests__/platforms/thea-pharmacy/contract.test.ts`)

**Step 11 — Run verification**
```bash
npx prisma validate
yarn jest __tests__/platforms/thea-pharmacy/contract.test.ts
```

Total: ~2–4 hours for the skeleton; domain logic is added iteratively on top.

---

## Current Platform Inventory (as of Phase 4.1)

| Platform | Key | Schema files | Entitlement column | Notes |
|---|---|---|---|---|
| Thea Health | `thea_health` | 20+ scattered files | `entitlementHealth` | Core/base platform; routes not under a single prefix |
| CVision (HR) | `cvision` | 7 files (`cvision-*.prisma`) | `entitlementCvision` | Largest platform; models use `Cvision` prefix |
| Imdad (SCM) | `imdad` | `imdad.prisma` | `entitlementScm`* | *Key name diverges from platform name — future cleanup |
| SAM (Policy) | `sam` | `sam.prisma` | `entitlementSam` | Models inconsistently prefixed — e.g., `PolicyDocument` not `SamPolicyDocument` |
| EDRac | `edrac` | (none yet) | `entitlementEdrac` | Registered but no schema or routes yet |

**Gaps to address in future phases:**
- SAM model names are not consistently prefixed — a future cleanup pass should rename to `Sam_*`.
- Imdad's entitlement column is `entitlementScm` (not `entitlementImdad`) — document as tech debt.
- Thea Health routes are scattered; a future phase should consolidate under `app/api/thea-health/`.
- No platform has a Cedar policy stub yet — Phase 4.3 will bootstrap these.
- No platform has a formal contract test yet — Phase 4.1 provides the template; writing them per platform is a follow-up task.

---

## Relationship to Other Phases

| Phase | What it adds to the platform framework |
|---|---|
| Phase 4.1 (this) | Template scaffold + this design doc |
| Phase 4.2 | Event schema registry + `lib/events/` emitter/bus |
| Phase 4.3 | Cedar policy engine wiring; policy stubs become live rules |
| Future | Retrofit existing platforms to fully match the template |
