# Codemod Manual Transformation Guide

The automated codemod has limitations with complex function bodies. Use this guide for manual transformation.

## Pattern to Transform:

**FROM:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const user = authResult.user;
    // ... rest of code
  } catch (error) {
    // ... error handling
  }
}
```

**TO:**
```typescript
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    // Remove requireAuth check - already handled by wrapper
    // Replace 'request' with 'req' throughout
    // Use 'user' and 'tenantId' from context
    // Use createTenantQuery() for all DB queries
    // ... rest of code
  } catch (error) {
    // ... error handling
  }
}, { 
  tenantScoped: true, 
  permissionKey: 'admin.ehr.tasks.access' // Adjust based on route
});
```

## Steps:
1. Add import: `import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';`
2. Remove `requireAuth` check (wrapper handles it)
3. Replace `export async function METHOD(request: NextRequest)` with `export const METHOD = withAuthTenant(async (req, { user, tenantId })`
4. Replace all `request` → `req` in body
5. Remove `const user = authResult.user;` and `const tenantId = authResult.tenantId;` (use from context)
6. Use `createTenantQuery()` for all DB queries
7. Add `tenantId` to all inserted documents
8. Update `createAuditLog()` calls to include `tenantId`
