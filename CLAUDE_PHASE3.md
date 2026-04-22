# CLAUDE_PHASE3.md — Phase 3: Integrations & Performance

## Context
Phase 0 ✅ — PostgreSQL migration, legacy cleanup
Phase 1 ✅ — Validation (657), Error handling (1064), Docker, CI/CD
Phase 2 ✅ — Loading/Error states (62), Logger (206 files), Backup system

## Phase 3 Mission: NPHIES integration, API documentation, caching, and database migrations.

---

## Step 1: NPHIES Integration Completion (Fixes Gap #9)

### Current State:
Files exist at `lib/integrations/nphies/` with scaffolding for:
- eligibility.ts — Check patient insurance eligibility
- claims.ts — Submit insurance claims
- priorAuth.ts — Prior authorization requests

But they are incomplete — no real response handling, no rejection handling, no reconciliation.

### What to do:

1. Read all existing NPHIES files and understand the current structure

2. Complete `lib/integrations/nphies/eligibility.ts`:
   - Build proper FHIR-compliant eligibility request
   - Handle all response types: eligible, not-eligible, pending
   - Parse coverage details (co-pay, deductible, limits)
   - Error handling with proper Arabic messages
   - Retry logic for timeouts

3. Complete `lib/integrations/nphies/claims.ts`:
   - Build claim submission request (FHIR Bundle)
   - Handle responses: approved, rejected, partial, pending
   - Parse rejection reasons
   - Support claim resubmission
   - Track claim lifecycle (submitted → processing → approved/rejected)

4. Complete `lib/integrations/nphies/priorAuth.ts`:
   - Prior authorization request builder
   - Handle approval/rejection/pending
   - Link to encounter and orders

5. Create `lib/integrations/nphies/types.ts`:
   - TypeScript interfaces for all NPHIES data structures
   - FHIR resource types used

6. Create `lib/integrations/nphies/config.ts`:
   - NPHIES configuration from env vars
   - Validation that required env vars exist before making calls
   - Sandbox vs production URL handling

7. Update API routes:
   - `app/api/billing/nphies/eligibility/route.ts`
   - `app/api/billing/nphies/claims/route.ts`
   - `app/api/billing/nphies/prior-auth/route.ts`

8. Add NPHIES env vars to `.env.example` with documentation

### IMPORTANT:
- NPHIES uses FHIR R4 standard
- All requests must include: NPHIES_PROVIDER_ID, NPHIES_LICENSE_ID, NPHIES_SENDER_ID
- Use proper NPHIES code systems for diagnoses, procedures, etc.
- The actual testing with real NPHIES requires registration — just make the code ready

---

## Step 2: API Documentation (Fixes Gap #14)

### What to do:

1. Install swagger tools:
   ```
   yarn add swagger-jsdoc swagger-ui-express
   yarn add -D @types/swagger-jsdoc @types/swagger-ui-express
   ```
   Or better: generate OpenAPI spec manually since we have Zod schemas.

2. Create `lib/docs/openapi.ts`:
   - Generate OpenAPI 3.0 spec from our Zod schemas
   - Auto-document all routes with their request/response types
   - Group by domain (OPD, Auth, Billing, etc.)

3. Create `app/api/docs/route.ts`:
   - Serve the OpenAPI JSON spec
   
4. Create `app/api/docs/ui/route.ts` or `app/(dashboard)/docs/page.tsx`:
   - Swagger UI or Scalar for interactive API docs
   - Only accessible to admin/owner roles

5. Add JSDoc comments to key API routes (at minimum OPD routes):
   - Description of what the route does
   - Request body schema
   - Response format
   - Error codes
   - Example request/response

---

## Step 3: Caching Layer (Fixes Gap #15)

### What to do:

1. Create `lib/cache/index.ts`:
   - In-memory cache with TTL (Time To Live)
   - Interface: get(key), set(key, value, ttlSeconds), delete(key), clear()
   - Redis-backed if REDIS_URL is set, otherwise in-memory
   - Automatic cache invalidation on write operations

2. Create `lib/cache/keys.ts`:
   - Cache key builders for each domain
   - Example: `opd:dashboard:${tenantId}` , `patient:${tenantId}:${patientId}`

3. Apply caching to heavy/frequent queries:
   - Dashboard analytics (cache 5 min)
   - Department list (cache 30 min)
   - Scheduling resources (cache 10 min)
   - Provider lists (cache 15 min)
   - Patient search results (cache 2 min)

4. Add cache invalidation:
   - When a booking is created → invalidate dashboard cache
   - When a patient is updated → invalidate patient cache
   - When department changes → invalidate department cache

5. Add cache headers to GET responses:
   - `Cache-Control: private, max-age=60` for semi-static data
   - `Cache-Control: no-cache` for real-time data (queue, vitals)

---

## Step 4: Database Migration Strategy (Fixes Gap #16)

### What to do:

We already have Prisma migrations working. But we need a proper strategy:

1. Create `docs/DATABASE_MIGRATIONS.md`:
   - How to create a new migration
   - How to apply migrations in production
   - How to rollback a migration
   - Naming conventions (use descriptive names)
   - Testing migrations before production

2. Create `scripts/migrate-production.ts`:
   - Safely apply pending migrations
   - Check current migration status
   - Backup before migration (call our backup system)
   - Verify after migration

3. Add migration step to CI/CD:
   - In deploy.yml: run `prisma migrate deploy` before starting new version
   - Add migration status check to health endpoint

4. Create seed data script `prisma/seed.ts`:
   - Create default departments (عيادة عامة, طوارئ, etc.)
   - Create default roles
   - Create default system settings
   - Run with: `npx prisma db seed`

---

## Verification Checklist

```bash
# 1. NPHIES files are complete
test -f lib/integrations/nphies/types.ts && echo "OK"
test -f lib/integrations/nphies/config.ts && echo "OK"

# 2. API docs endpoint exists
test -f app/api/docs/route.ts && echo "OK"

# 3. Cache layer exists
test -f lib/cache/index.ts && echo "OK"

# 4. Migration docs exist
test -f docs/DATABASE_MIGRATIONS.md && echo "OK"

# 5. Seed script exists
test -f prisma/seed.ts && echo "OK"

# 6. TypeScript passes
npx tsc --noEmit
```
