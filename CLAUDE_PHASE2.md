# CLAUDE_PHASE2.md — Phase 2: Stability & Monitoring

## Context
Phase 0 ✅ — PostgreSQL migration complete, legacy brand removed
Phase 1 ✅ — Validation (657), Error handling (1064), Docker, CI/CD

## Phase 2 Mission: Make the system stable, monitored, and recoverable.

---

## Step 1: Loading & Error States for ALL Pages (Fixes Gap #8)

### Problem:
Most pages show a blank white screen when loading or when an error occurs.
Only 2 error.tsx and 1 loading.tsx exist in the entire app.

### What to do:

1. Create a reusable loading component:
   ```
   components/ui/PageLoading.tsx — Full page skeleton/spinner
   components/ui/SectionLoading.tsx — Inline section skeleton
   components/ui/PageError.tsx — Full page error with retry button
   ```

2. Add `loading.tsx` to EVERY route group in `app/`:
   ```
   app/(dashboard)/loading.tsx — Main dashboard loading
   app/(dashboard)/opd/loading.tsx
   app/(dashboard)/er/loading.tsx
   app/(dashboard)/ipd/loading.tsx
   app/(dashboard)/billing/loading.tsx
   app/(dashboard)/admin/loading.tsx
   app/(portal)/loading.tsx
   app/owner/loading.tsx
   app/login/loading.tsx
   ```
   Each loading.tsx should use PageLoading or SectionLoading.

3. Add `error.tsx` to EVERY route group in `app/`:
   ```
   app/(dashboard)/error.tsx
   app/(dashboard)/opd/error.tsx
   app/(dashboard)/er/error.tsx
   app/(dashboard)/ipd/error.tsx
   app/(dashboard)/billing/error.tsx
   app/(dashboard)/admin/error.tsx
   app/(portal)/error.tsx
   app/owner/error.tsx
   ```
   Each error.tsx must be a Client Component ('use client') with:
   - Error message display (Arabic)
   - Retry button
   - "Go back" button
   - Log the error to console

4. Add `not-found.tsx` to app/ root:
   - Arabic "Page not found" message
   - Link back to dashboard

### Design Rules:
- Match existing Thea UI design (Tailwind + thea-ui components)
- Arabic-first text with English fallback
- Dark mode compatible (use CSS variables or Tailwind dark: classes)
- Show skeleton loaders, not spinners (more professional)

---

## Step 2: Monitoring & Alerts (Fixes Gap #12)

### What to do:

1. Create `lib/monitoring/health.ts`:
   - Database health check (Prisma $queryRaw SELECT 1)
   - Redis health check (if connected)
   - Memory usage check
   - Uptime tracking

2. Enhance `app/api/opd/health/route.ts` → `app/api/health/route.ts`:
   - Move from OPD-specific to global
   - Return: { status, database, redis, uptime, memory, version }
   - Support ?detailed=true for full diagnostics

3. Create `lib/monitoring/logger.ts` — Structured logger:
   - Replace console.log/error throughout the codebase
   - Log levels: debug, info, warn, error
   - JSON format in production
   - Include: timestamp, level, message, context (tenantId, userId, route)
   - In development: pretty print
   - In production: JSON (ready for log aggregation)

4. Create `lib/monitoring/metrics.ts` — Basic metrics:
   - Request count per route
   - Error count per route
   - Response time per route
   - Store in memory (Map), expose via /api/health?metrics=true

5. Add request logging middleware — `lib/monitoring/requestLogger.ts`:
   - Log every API request: method, path, status, duration, tenantId
   - Don't log health check requests
   - Don't log sensitive data (passwords, tokens)

---

## Step 3: Automatic Backups (Fixes Gap #11)

### What to do:

Since we're on Supabase, backups are partially handled. But we need:

1. Create `app/api/admin/backup/route.ts`:
   - GET: Returns backup status and last backup time
   - POST: Triggers a data export (critical tables only)
   
2. Create `lib/backup/export.ts`:
   - Export critical data as JSON: patients, encounters, bookings
   - Compress with gzip
   - Return as downloadable file
   - Include metadata: export date, tenant, record counts

3. Create `scripts/backup.ts`:
   - CLI script for scheduled backups
   - Usage: `npx tsx scripts/backup.ts --tenant=<id> --output=./backups/`
   - Can be run via cron job

4. Document Supabase backup settings in `.env.example`:
   - Add comment about enabling Point-in-Time Recovery in Supabase dashboard
   - Add comment about daily automatic backups (Supabase Pro plan)

---

## Step 4: Improved Logging (Fixes Gap #13)

### What to do:

1. Replace ALL `console.log` / `console.error` in lib/ and app/api/ with structured logger:
   ```typescript
   // Before:
   console.log('[TENANT_DB] Connected to', dbName);
   console.error('Failed to create encounter:', error);
   
   // After:
   import { logger } from '@/lib/monitoring/logger';
   logger.info('Tenant DB connected', { dbName });
   logger.error('Failed to create encounter', { error, tenantId });
   ```

2. Keep console.log in development scripts (scripts/) — don't change those

3. Add context to all log calls:
   - tenantId (when available)
   - userId (when available)
   - route/action name
   - duration (for slow operations)

4. Create log categories:
   - `auth` — login, logout, session events
   - `opd` — encounter, booking, nursing events
   - `db` — database connections, queries
   - `api` — request/response logging
   - `error` — all errors

---

## Verification Checklist

```bash
# 1. Loading states exist
find app/ -name "loading.tsx" | wc -l
# Should be > 8

# 2. Error states exist
find app/ -name "error.tsx" | wc -l
# Should be > 8

# 3. Health endpoint works
# (run yarn dev first)
curl http://localhost:3000/api/health | jq .

# 4. Structured logger is used
grep -rn "from '@/lib/monitoring/logger'" app/api/ lib/ | wc -l
# Should be > 50

# 5. console.log removed from production code
grep -rn "console\.log\|console\.error" app/api/ lib/ --include="*.ts" | grep -v node_modules | grep -v "logger.ts" | wc -l
# Should be < 10 (ideally 0)

# 6. Backup endpoint exists
test -f app/api/admin/backup/route.ts && echo "EXISTS"

# 7. TypeScript passes
npx tsc --noEmit
```
