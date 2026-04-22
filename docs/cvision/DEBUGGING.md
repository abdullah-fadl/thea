# CVision Debugging Guide

## Root Cause Analysis

### Issue: CV Flow Shows "Nothing" in UI

**Symptoms:**
- Debug banner shows `TenantId: thea-owner-dev`
- Requisitions page shows `Candidates: 0` for `JR-000001`
- Empty `Roles/Permissions: []` array in debug banner

**Root Cause:**
The seed script (`scripts/seed-cvision.ts`) defaults to tenant `'default'` (or `process.env.TENANT_ID`), but the user is logged in with tenant `thea-owner-dev`. This creates a tenant mismatch where:
- Seed data is created in database: `thea_tenant__default`
- API queries database: `thea_tenant__thea-owner-dev`
- Result: No data found → `Candidates: 0`

## Solution

### Step 1: Seed Data for Owner Tenant

Run the seed script with the correct tenant ID:

```bash
npm run seed:cvision:owner
```

This runs:
```bash
dotenv -e .env.local -- tsx scripts/seed-cvision.ts thea-owner-dev
```

### Step 2: Verify Seed Data

Navigate to `/cvision/diagnostics` to see:
- Requisitions count (should be > 0)
- Candidates count (should be > 0 for `JR-000001`)
- Documents count
- Parse jobs count

### Step 3: Check Server Logs

When loading `/cvision/recruitment/requisitions`, check server console for:

```
[CVision Requisitions GET] { tenantId: 'thea-owner-dev', userId: '...', role: 'thea-owner', url: '...' }
[CVision Requisitions GET] Result: { tenantId: 'thea-owner-dev', count: 1, total: 1, page: 1 }
```

If `count: 0`, the seed didn't run or ran for wrong tenant.

## Debugging Tools

### 1. Debug Banner
- **Location:** All recruitment pages (`/cvision/recruitment/*`)
- **Shows:** Pathname, TenantId, UserId, Role, Permissions
- **Visible:** Development only (`NODE_ENV !== "production"`)

### 2. Diagnostics Page
- **Route:** `/cvision/diagnostics`
- **Shows:** Database counts and last 3 IDs for:
  - Requisitions
  - Candidates
  - Documents
  - Parse Jobs
- **Includes:** Debug banner for context

### 3. Server Console Logs

All CVision API endpoints log:
- **Request:** `tenantId`, `userId`, `role`, `url`, `params`
- **Result:** `count`, `total`, `page`

**Key Endpoints:**
- `GET /api/cvision/recruitment/requisitions`
- `GET /api/cvision/recruitment/requisitions/:id/candidates`
- `GET /api/cvision/recruitment/candidates/:id`
- `GET /api/cvision/diagnostics`

## Common Issues

### Issue 1: Empty Permissions Array
**Symptom:** `Roles/Permissions: []` in debug banner

**Cause:** `thea-owner` role may not have explicit permissions array in `/api/auth/me` response.

**Impact:** Should NOT block data access. `thea-owner` role bypasses permission checks in `withAuthTenant`.

**Fix:** Not critical for data access, but can be fixed by ensuring `/api/auth/me` returns permissions for owner role.

### Issue 2: Tenant Mismatch
**Symptom:** Data exists but not visible

**Diagnosis:**
1. Check debug banner `TenantId`
2. Check diagnostics page counts
3. Check server logs for `tenantId` in API calls
4. Verify seed script used correct tenant ID

**Fix:** Run seed with matching tenant ID:
```bash
npm run seed:cvision:owner  # For thea-owner-dev
npm run seed:cvision 1       # For tenant "1"
npm run seed:cvision <tenantId>  # For any tenant
```

### Issue 3: 401/403 Errors
**Symptom:** API returns authentication/authorization errors

**Diagnosis:**
1. Check debug banner for `Role` and `TenantId`
2. Check server logs for permission errors
3. Verify `platformKey: 'cvision'` in API route options
4. Verify `permissionKey` matches user's permissions

**Fix:** Ensure user has CVision platform access and required permissions.

## Verification Checklist

- [ ] Debug banner shows correct `TenantId`
- [ ] Diagnostics page shows non-zero counts
- [ ] Server logs show correct `tenantId` in API calls
- [ ] Seed script was run with matching tenant ID
- [ ] No 401/403 errors in server logs
- [ ] Requisitions page shows candidates count > 0

## Next Steps After Fix

1. **Verify Seed Data:**
   ```bash
   npm run seed:cvision:owner
   ```

2. **Check Diagnostics:**
   - Navigate to `/cvision/diagnostics`
   - Verify counts are non-zero

3. **Test CV Flow:**
   - Navigate to `/cvision/recruitment/requisitions`
   - Click "View Candidates" for `JR-000001`
   - Verify candidate list shows "Ahmed Ali"
   - Click candidate to view detail page
   - Test CV upload functionality

4. **Monitor Server Logs:**
   - Watch for `[CVision *]` log entries
   - Verify `tenantId` matches debug banner
   - Check for any errors or warnings
