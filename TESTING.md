# Thea EHR — Testing Guide

## Summary

| Phase | Type | Files | Tests | Command |
|-------|------|-------|-------|---------|
| 1 | Unit (Vitest) | 71 | 1,349 | `yarn test:run` |
| 2 | Integration | 5 | 98 | `yarn test:integration` |
| 3 | E2E (Playwright) | 19 | 159 | `yarn test:e2e` |
| 4 | Performance | 4 | 55 | `yarn test:performance` |
| 5 | Security | 6 | 93 | `yarn test:security` |
| **Total** | | **105** | **~1,754** | |

---

## Quick Start

### No server needed (fast feedback loop):

```bash
yarn typecheck && yarn lint && yarn test:run && yarn test:coverage
```

### Server + DB needed:

```bash
# Terminal 1 — start the dev server
yarn dev

# Terminal 2 — run tests that need a running server
yarn test:integration
yarn test:e2e
yarn test:security
yarn test:performance
yarn test:perf:report
```

---

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `yarn test` | Interactive vitest (watch mode) |
| `yarn test:run` | Run unit tests once |
| `yarn test:coverage` | Unit tests with coverage report |
| `yarn test:unit` | Unit tests (excludes integration) |
| `yarn test:integration` | Integration tests (needs server + DB) |
| `yarn test:e2e` | All Playwright E2E tests |
| `yarn test:e2e:opd` | E2E: OPD patient journey |
| `yarn test:e2e:er` | E2E: ER patient journey |
| `yarn test:e2e:ipd` | E2E: IPD patient journey |
| `yarn test:e2e:or` | E2E: OR patient journey |
| `yarn test:e2e:nav` | E2E: Navigation tests |
| `yarn test:e2e:portal` | E2E: Patient portal |
| `yarn test:e2e:all` | All E2E tests |
| `yarn test:performance` | Performance benchmarks |
| `yarn test:perf:report` | Generate performance report (Markdown) |
| `yarn test:security` | All security penetration tests |
| `yarn test:security:injection` | SQL/XSS/command injection tests |
| `yarn test:security:auth` | Authentication bypass tests |
| `yarn test:quality` | Quality gate check |

---

## Test Architecture

```
__tests__/
  *.test.ts                    # Phase 1: Unit tests (71 files)
  opd/*.test.ts                # OPD-specific unit tests
  lib/*.test.ts                # Library unit tests
  integration/                 # Phase 2: Integration tests (5 files)
    tenant-isolation.test.ts
    auth-flow.test.ts
    opd-workflow.test.ts
    er-workflow.test.ts
    api-contracts.test.ts
  e2e/                         # Phase 3: E2E Playwright tests (19 files)
    opd-journey.spec.ts
    er-journey.spec.ts
    ipd-journey.spec.ts
    or-journey.spec.ts
    navigation.spec.ts
    portal.spec.ts
    ...
  performance/                 # Phase 4: Performance tests (4 files)
    helpers.ts
    api-response-times.test.ts
    concurrent-users.test.ts
    database-queries.test.ts
    realtime-sse.test.ts
    report-generator.ts
  security/                    # Phase 5: Security tests (6 files)
    helpers.ts
    injection.test.ts
    authentication.test.ts
    authorization.test.ts
    data-exposure.test.ts
    input-validation.test.ts
    csrf-clickjacking.test.ts
```

---

## CI/CD Pipeline

### Every PR (`.github/workflows/ci.yml`):
```
typecheck ─┐
lint ───────┤ (parallel)
unit-tests ─┘
      │
      ▼
integration-tests
      │
      ├──► e2e-tests      (parallel)
      └──► security-tests  (parallel)
```

### Weekly Monday 3 AM UTC (`.github/workflows/performance.yml`):
- Performance benchmarks with report artifact
- Also available via manual dispatch

### Push to main (`.github/workflows/quality-gate.yml`):
- Full quality gate — blocks deploy if anything fails
- Runs ALL checks sequentially: typecheck → lint → unit → build → quality API → security → integration → E2E

---

## Quality Gate (ALL must pass for deploy):

- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 warnings
- [ ] Unit Tests: 100% pass (1,349 tests)
- [ ] Integration Tests: 100% pass (98 tests)
- [ ] E2E Tests: 100% pass (159 tests)
- [ ] Security Tests: 0 critical findings (93 tests)
- [ ] Quality Gate API: `passed = true`
- [ ] Build: successful

---

## Writing New Tests

### Unit Test (no server needed):
```typescript
// __tests__/my-feature.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('My Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

### Integration Test (needs server + DB):
```typescript
// __tests__/integration/my-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('My Integration Flow', () => {
  beforeAll(async () => {
    // Seed test data, authenticate
  });

  it('should complete the workflow', async () => {
    const res = await fetch('http://localhost:3000/api/...');
    expect(res.status).toBe(200);
  });
});
```

### Security Test (needs server + DB):
```typescript
// __tests__/security/my-security.test.ts
if (process.env.NODE_ENV === 'production') throw new Error('Never in production');

import { describe, it, expect } from 'vitest';
import { assertNotProduction, ensureServerRunning } from './helpers';
```

---

## Environment Setup

Required environment variables for integration/security/performance tests:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-here
NODE_ENV=test
```

Copy `.env.local.example` to `.env.local` and fill in values.
