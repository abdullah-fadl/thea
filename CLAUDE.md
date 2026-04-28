# CLAUDE.md — Thea EHR Project Instructions

## Project Overview
Thea EHR is an Electronic Health Records system built with Next.js 14, TypeScript, and MongoDB (being migrated to PostgreSQL). It supports multi-tenant architecture with Arabic/English i18n.

## Current Mission: Phase 0 — PostgreSQL Migration + Syra Cleanup

We are executing a complete system overhaul:
1. **Remove ALL Syra references** — This was a previous brand. Clean it completely.
2. **Delete ALL Legacy files** — Files ending in `*Legacy.tsx` are old versions being replaced.
3. **Migrate OPD module from MongoDB to PostgreSQL**
4. **Set new owner: thea@thea.com.sa**

---

## CRITICAL RULES

### 🌐 Bilingual (i18n) Rule — MANDATORY FOR ALL COMPONENTS
**Every single user-facing string in every component MUST be bilingual.** No exceptions.

#### Required pattern in every client component:
```typescript
'use client';
import { useLang } from '@/hooks/use-lang';

export function MyComponent() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return <button>{tr('حفظ', 'Save')}</button>;
}
```

#### Rules:
- **ALWAYS** import `useLang` from `@/hooks/use-lang` in every new component
- **ALWAYS** define `const tr = (ar: string, en: string) => language === 'ar' ? ar : en;` at the top of the component
- **ALWAYS** wrap every user-visible string with `tr('Arabic text', 'English text')`
- **NEVER** hardcode Arabic-only text (e.g., `'حفظ'`) directly in JSX
- **NEVER** hardcode English-only text (e.g., `'Save'`) directly in JSX
- This applies to: button labels, tab names, column headers, dialog titles, toast messages, placeholder text, error messages, section headings, badge labels — **everything the user sees**
- For RTL/LTR layout: use `dir={language === 'ar' ? 'rtl' : 'ltr'}` on container elements when needed

#### ❌ Wrong (hardcoded Arabic):
```tsx
<button>حفظ</button>
<h2>محطة التمريض</h2>
toast({ title: 'تم الحفظ' })
```

#### ✅ Correct (bilingual):
```tsx
<button>{tr('حفظ', 'Save')}</button>
<h2>{tr('محطة التمريض', 'Nursing Station')}</h2>
toast({ title: tr('تم الحفظ', 'Saved') })
```

---

### Syra Removal Rules
- **DELETE** `app/platforms/syra-health/` entirely
- **REMOVE** every reference to: `syra`, `SYRA`, `Syra`, `syra-owner`, `syra-owner-dev`, `SYRA_COMPATIBILITY_MODE`, `SYRA_OWNER_EMAIL`, `SYRA_OWNER_PASSWORD`, `SYRA_TENANT_DB_NAMES`
- **REPLACE** `syra-owner` role with just `thea-owner` everywhere
- **REPLACE** `syra-owner-dev` tenant with just `thea-owner-dev`
- **REMOVE** all `SYRA_COMPATIBILITY_MODE` fallback logic (the `if (process.env.SYRA_COMPATIBILITY_MODE === 'true')` blocks)
- **REMOVE** all legacy Syra DB name lookups (`SYRA_TENANT_DB_NAMES`, `getLegacyTenantDbName`, `syra_tenant` prefixes)
- **REMOVE** the Syra redirect in `next.config.js`
- Owner email changes: `admin@thea.health` → `thea@thea.com.sa`
- Owner email env var: only `THEA_OWNER_EMAIL` (remove `SYRA_OWNER_EMAIL` fallbacks)

### Legacy File Removal Rules
- **DELETE** all 54 files matching `*Legacy*.tsx`
- **UPDATE** page.tsx files that import Legacy components to only import the New version
- Example: If `page.tsx` has `import RegistrationLegacy` and `import RegistrationNew`, remove the Legacy import and make New the default

### Data Migration Rules  
- We are NOT migrating old data — fresh start
- Owner account: `thea@thea.com.sa` (created from owner console)
- Tenants created from the owner console

---

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Current DB**: MongoDB (via `mongodb` driver, NOT Mongoose)
- **Target DB**: PostgreSQL (via Prisma or Drizzle ORM)
- **Auth**: JWT (jose for Edge, jsonwebtoken for Node)
- **UI**: Tailwind CSS + Radix UI + shadcn/ui
- **State**: React Query (TanStack)
- **i18n**: Custom (lib/i18n.ts — Arabic + English)

## Project Structure
```
app/                    # Next.js App Router pages
  api/                  # API routes (595 total)
    opd/                # OPD API routes (45 routes) ← MIGRATION TARGET
  (dashboard)/          # Main app pages
  (portal)/             # Patient portal
  admin/                # Admin pages
  owner/                # Owner management
  login/                # Authentication
components/             # Shared components
  opd/                  # OPD-specific components
  clinical/             # Clinical components
  billing/              # Billing components
  thea-ui/              # Design system
lib/                    # Core libraries
  opd/                  # OPD business logic
  models/               # TypeScript interfaces
  db/                   # Database connection layer
  auth/                 # Authentication
  security/             # Rate limiting, config
  core/                 # Guards, middleware
  integrations/         # HL7, NPHIES, LIS
middleware.ts           # Next.js middleware (auth, RBAC, platform isolation)
```

## OPD Collections to Migrate (22 tables)
These MongoDB collections need PostgreSQL equivalents:
```
patient_master, encounter_core, opd_encounters, opd_bookings,
opd_orders, opd_daily_data, opd_visit_notes, opd_census,
opd_meeting_reports, opd_recommendations, orders_hub,
departments, users, scheduling_slots, scheduling_resources,
scheduling_reservations, attachments, physical_exams,
order_results, connect_results, lab_results, radiology_reports
```

## Key Patterns in Current Code

### API Route Pattern
```typescript
// Every API route follows this pattern:
export const POST = withAuthTenant(async (req, { tenantId, userId, user }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;
  // ... use db.collection('name') directly
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' });
```

### Multi-tenant Pattern
- Every query includes `{ tenantId, ... }` filter
- Tenant DB is resolved from JWT token → platform DB lookup → tenant DB
- Each tenant has its own database: `thea_tenant__<tenantId>`

## Files With Syra References (69 files, 234 references)
Key files to modify:
- `middleware.ts` — Remove syra-owner checks
- `lib/db/tenantDb.ts` — Remove legacy DB name lookups
- `lib/auth/edge.ts` — Remove syra-owner role
- `lib/core/guards/withAuthTenant.ts` — Remove syra references
- `lib/security/auth.ts` — Remove SYRA_COMPATIBILITY_MODE
- `lib/security/sessions.ts` — Remove SYRA_COMPATIBILITY_MODE
- `lib/auth/sessions.ts` — Remove SYRA_COMPATIBILITY_MODE
- `lib/auth/requireAuth.ts` — Remove SYRA_COMPATIBILITY_MODE
- `app/api/auth/login/route.ts` — Remove Syra DB lookups
- `app/api/auth/me/route.ts` — Remove syra-owner-dev
- `app/api/owner/*` — Remove syra-owner protections
- `scripts/bootstrapOwner.ts` — Remove SYRA_OWNER_EMAIL fallback
- `scripts/seed-owner.ts` — Remove SYRA_OWNER_EMAIL fallback
- `next.config.js` — Remove syra-health redirect

## Simulator Update Rule

Every new feature MUST include simulator coverage. When implementing any new clinical workflow, department module, or API endpoint:

1. **Create a new scenario** in `simulator/scenarios/` that exercises the feature end-to-end
2. **Create or update actors** in `simulator/actors/` if the feature introduces a new role
3. **Add data generators** in `simulator/data/` if the feature needs new test data (medications, procedures, etc.)
4. **Add validation checks** in `simulator/validation/` to verify data integrity after the scenario runs

### Naming convention
- Scenario file: `simulator/scenarios/<module>-<feature>.ts` (e.g., `er-brain-death.ts`)
- Actor file: `simulator/actors/<role>.ts` (e.g., `neurosurgeon.ts`)
- Data file: `simulator/data/<domain>.ts` (e.g., `brain-death-criteria.ts`)

### Example
If you add a **Brain Death Protocol** feature:
```
simulator/
  scenarios/er-brain-death.ts          # Full scenario: admit → assessments → declaration
  actors/neurosurgeon.ts               # New actor if needed
  data/brain-death-criteria.ts         # Clinical criteria data
  validation/brain-death-integrity.ts  # Post-scenario checks
```

The scenario must:
- Use real API calls (no mocks)
- Cover the happy path + at least one failure case
- Validate data integrity after completion
- Be registered in the engine so `yarn sim` picks it up automatically

## Commands
```bash
yarn dev          # Development server
yarn build        # Production build
yarn lint         # ESLint
yarn typecheck    # TypeScript check
```
