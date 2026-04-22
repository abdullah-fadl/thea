# Thea Core Platform - Security Tests

This directory contains comprehensive security and quality tests for the Thea Core Platform.

## Test Structure

### 1. Automated Route Scanner (`lib/core/quality/routeScanner.ts`)

Scans ALL `/app/api/**` routes and verifies:
- ✅ Protected routes call `requireAuthGuard()`, `requireAuth()`, `requireAuthContext()`, or `requireOwner()`
- ✅ Tenant filtering is enforced (`withTenantFilter()` or equivalent)
- ✅ Platform/permission checks are present where required
- ❌ No route accepts `tenantId` from client input (query, body, or params)

**Usage:**
```bash
yarn test:quality
```

### 2. Playwright E2E Tests (`__tests__/e2e/security.spec.ts`)

End-to-end tests for:
- ✅ Login persistence across `"/"` and `"/platforms/*"`
- ✅ Session restore to `lastRoute` after browser restart
- ✅ Subscription expired/blocked behavior (login blocked + `/api/auth/me` blocked)
- ✅ Platform entitlements: platform not visible + direct URL blocked
- ✅ Cross-tenant access prevention

**Usage:**
```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run Library E2E only
npx playwright test library.spec.ts

# Run all E2E tests
yarn test:e2e

# Run with UI
yarn test:e2e:ui

# Run in debug mode
yarn test:e2e:debug
```

### 3. API Tests for Cross-Tenant Access (`lib/core/quality/apiTests.ts`)

Tests that verify:
- ✅ Tenant B resource IDs cannot be accessed using Tenant A token
- ✅ `tenantId` in query/body is ignored/rejected

**Usage:**
These tests are automatically run when calling `/api/quality/verify`.

### 4. Quality Gate API (`/api/quality/verify`)

Comprehensive security verification endpoint that runs:
- Route security scan
- Cross-tenant access tests
- Tenant isolation checks
- Subscription enforcement
- Owner separation
- Session restore

**Usage:**
```bash
# Via API
curl -X POST http://localhost:3000/api/quality/verify

# Quick health check
curl http://localhost:3000/api/quality/verify
```

## Test Configuration

### Environment Variables

Create a `.env.test` file for E2E tests:

```env
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
TEST_TENANT_ID=test-tenant
EXPIRED_USER_EMAIL=expired@example.com
EXPIRED_USER_PASSWORD=password123
EXPIRED_TENANT_ID=expired-tenant
```

## Running Tests

### Before Deployment

**MANDATORY:** Run all tests before deploying to production:

```bash
# 1. Run route scanner
yarn test:quality

# 2. Run E2E tests
yarn test:e2e

# 3. Check quality gate API
curl -X POST http://localhost:3000/api/quality/verify | jq
```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/quality-gate.yml
- name: Run Quality Gate
  run: |
    yarn test:quality
    yarn test:e2e
    curl -X POST http://localhost:3000/api/quality/verify
```

## Test Results

### Route Scanner Output

```
Route Security Scan Report
==========================
Total Routes Scanned: 150
Routes with Violations: 5
Critical Violations: 2
High Violations: 3
Medium Violations: 0

❌ SECURITY CHECKS FAILED - DO NOT DEPLOY
```

### Quality Gate API Response

```json
{
  "passed": false,
  "summary": "❌ Security checks failed - DO NOT DEPLOY",
  "routeScan": {
    "totalRoutes": 150,
    "routesWithViolations": 5,
    "criticalViolations": 2,
    "highViolations": 3,
    "violations": [...]
  },
  "crossTenantTests": {
    "totalTests": 10,
    "passedTests": 8,
    "failedTests": 2,
    "results": [...]
  },
  "results": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Fixing Violations

### Missing Authentication

**Error:** `Protected route does not call requireAuthGuard()`

**Fix:**
```typescript
// Before
export async function GET(request: NextRequest) {
  // ... code
}

// After
import { requireAuthGuard } from '@/lib/core/guards';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthGuard(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  // ... code
}
```

### Missing Tenant Filter

**Error:** `Route makes database queries but does not enforce tenant filtering`

**Fix:**
```typescript
// Before
const policies = await collection.find({}).toArray();

// After
import { withTenantFilter } from '@/lib/core/guards';

const query = await withTenantFilter(request, {});
const policies = await collection.find(query).toArray();
```

### TenantId from Client

**Error:** `Route accepts tenantId from client input`

**Fix:**
```typescript
// Before
const tenantId = request.nextUrl.searchParams.get('tenantId');

// After
const authResult = await requireAuthGuard(request);
if (authResult instanceof NextResponse) {
  return authResult;
}
const { tenantId } = authResult; // From JWT only
```

## Production Readiness Checklist

- [ ] All route scanner tests pass (`yarn test:quality`)
- [ ] All E2E tests pass (`yarn test:e2e`)
- [ ] Quality gate API returns `passed: true`
- [ ] No critical violations
- [ ] No high violations
- [ ] Cross-tenant access tests pass
- [ ] Session restore works correctly
- [ ] Subscription enforcement is active
- [ ] Owner separation is enforced

**Only deploy when ALL checks pass!**
