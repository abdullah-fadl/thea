# CLAUDE.md — Phase 1: Safety & Foundations

## Context
Phase 0 is COMPLETE:
- ✅ All legacy brand references removed
- ✅ All Legacy files deleted
- ✅ Full MongoDB → PostgreSQL migration done
- ✅ 466+ API routes working on PostgreSQL via Prisma shim
- ✅ Owner account created (thea@thea.com.sa)

## Phase 1 Mission: Safety & Foundations
Make the system safe for real clinic use and easy to deploy.

---

## Step 1: Zod Validation for ALL API Routes (Fixes Gap #4)

### What to do:
Add input validation to every POST/PUT/PATCH API route using Zod schemas.

### Rules:
1. Create validation schemas in domain-specific files:
   ```
   lib/validation/
     opd.schema.ts        # OPD schemas
     auth.schema.ts       # Auth schemas
     patient.schema.ts    # Patient schemas
     billing.schema.ts    # Billing schemas
     scheduling.schema.ts # Scheduling schemas
     orders.schema.ts     # Orders schemas
     admin.schema.ts      # Admin schemas
     shared.schema.ts     # Shared types (pagination, etc.)
   ```

2. Every POST/PUT/PATCH route must validate input BEFORE any database call
3. Use `safeParse()` — never `parse()` (don't throw, return error response)
4. Return Arabic-friendly error messages where possible
5. Don't validate GET routes with query params (low priority)

### Pattern to follow:
```typescript
// lib/validation/opd.schema.ts
import { z } from 'zod';

export const openEncounterSchema = z.object({
  patientMasterId: z.string().min(1, 'patientMasterId is required'),
  reason: z.string().optional(),
  visitType: z.enum(['FVC', 'FVH', 'FU', 'RV', 'REF']).optional(),
  resourceId: z.string().optional(),
  billingMeta: z.record(z.unknown()).optional(),
});

// In the route:
import { openEncounterSchema } from '@/lib/validation/opd.schema';

const parsed = openEncounterSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: parsed.error.flatten() },
    { status: 400 }
  );
}
const { patientMasterId, reason, visitType } = parsed.data;
```

### Priority order:
1. OPD routes (patient-facing, most critical)
2. Auth routes (security critical)
3. Billing routes (money involved)
4. Everything else

---

## Step 2: Standardized Error Handling (Fixes Gap #5)

### What to do:
Create a unified error handler that wraps all API routes.

### Create `lib/core/errors.ts`:
```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) { super(400, message, 'BAD_REQUEST'); }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) { super(404, `${resource} not found`, 'NOT_FOUND'); }
}

export class ConflictError extends ApiError {
  constructor(message: string) { super(409, message, 'CONFLICT'); }
}

export function withErrorHandler(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      // Log unexpected errors
      console.error('Unhandled API error:', error);
      return NextResponse.json(
        { error: 'حدث خطأ غير متوقع', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}
```

### Rules:
1. Wrap every route handler with `withErrorHandler()`
2. Never let unhandled exceptions crash the response
3. In development: include error details in response
4. In production: hide error details, show generic Arabic message
5. Log all 500 errors with full stack trace

---

## Step 3: Environment Configuration (Fixes Gap #3)

### Create `.env.example` in project root with ALL required variables:
- Document every env var used in the codebase
- Group by category (Database, Auth, App, Integrations, etc.)
- Mark which are required vs optional
- Include Arabic comments explaining each one
- Include example values

### Scan for env vars:
```bash
grep -rn "process.env\." --include="*.ts" --include="*.tsx" | grep -oP 'process\.env\.\K[A-Z_]+' | sort -u
```

---

## Step 4: Docker Setup (Fixes Gap #2)

### Create `Dockerfile`:
- Multi-stage build (deps → build → production)
- Node 20 Alpine base
- `npx prisma generate` in build stage
- Non-root user for security
- output: 'standalone' in next.config.js

### Create `docker-compose.yml`:
- App service (the Next.js app)
- Redis service (for rate limiting/caching)
- NO MongoDB, NO PostgreSQL (using Supabase)
- Health checks
- Environment variables from .env

### Create `.dockerignore`:
- node_modules, .next, .git, etc.

---

## Step 5: Basic CI/CD Pipeline

### Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: yarn install --frozen-lockfile
      - run: npx prisma generate
      - run: yarn typecheck
      - run: yarn lint
      - run: yarn build
```

---

## Verification Checklist
After all steps:
```bash
# 1. All POST/PUT/PATCH routes have validation
grep -rn "safeParse\|validateBody" app/api/ | wc -l
# Should be > 50

# 2. All routes have error handling
grep -rn "withErrorHandler" app/api/ | wc -l
# Should be > 50

# 3. .env.example exists and is comprehensive
cat .env.example | wc -l
# Should be > 30

# 4. Docker works
docker-compose build
docker-compose up -d
curl http://localhost:3000/api/opd/health

# 5. CI passes
yarn typecheck && yarn lint && yarn build

# 6. Zero TypeScript errors
npx tsc --noEmit
```

---

## Commands
```bash
yarn dev              # Development server
yarn build            # Production build
yarn lint             # ESLint
yarn typecheck        # TypeScript check
npx prisma studio     # Visual database editor
docker-compose up     # Run with Docker
```
