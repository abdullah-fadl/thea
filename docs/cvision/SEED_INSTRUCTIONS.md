# CVision Seed Instructions

## Problem
The seed script (`scripts/seed-cvision.ts`) uses `tsx` which may have permission issues. Here are alternative ways to seed data for `thea-owner-dev` tenant.

## Option 1: Use Existing Script (Recommended)

Try running the seed script directly:

```bash
# Method 1: Using npm script
npm run seed:cvision:owner

# Method 2: Direct tsx (if npm script fails)
dotenv -e .env.local -- tsx scripts/seed-cvision.ts thea-owner-dev

# Method 3: With explicit tenant ID env var
TENANT_ID=thea-owner-dev dotenv -e .env.local -- tsx scripts/seed-cvision.ts
```

## Option 2: Manual MongoDB Commands

If the seed script fails, you can manually insert data using MongoDB shell or Compass:

### 1. Connect to MongoDB
```bash
mongosh "your-mongodb-connection-string"
```

### 2. Switch to tenant database
```javascript
use thea_tenant__thea-owner-dev
```

### 3. Insert a candidate for JR-000001

First, find the requisition ID:
```javascript
db.cvision_job_requisitions.findOne({ requisitionNumber: "JR-000001" })
```

Then insert candidate (replace `REQUISITION_ID` with actual ID from above):
```javascript
db.cvision_candidates.insertOne({
  id: "candidate-" + new ObjectId().toString(),
  tenantId: "thea-owner-dev",
  requisitionId: "REQUISITION_ID", // Replace with actual ID
  fullName: "Ahmed Ali",
  email: "ahmed.ali@example.com",
  phone: "+966501234567",
  source: "PORTAL",
  status: "applied",
  statusChangedAt: new Date(),
  statusReason: null,
  screeningScore: null,
  notes: null,
  screenedBy: null,
  screenedAt: null,
  interviews: null,
  offerExtendedAt: null,
  offerAmount: null,
  offerCurrency: null,
  offerStatus: null,
  offerResponseAt: null,
  hiredAt: null,
  employeeId: null,
  isArchived: false,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  createdBy: "system-seed",
  updatedBy: "system-seed"
})
```

### 4. Update requisition applicant count
```javascript
db.cvision_job_requisitions.updateOne(
  { requisitionNumber: "JR-000001" },
  { $inc: { applicantCount: 1 } }
)
```

## Option 3: Verify Tenant Exists

Before seeding, ensure the tenant exists in the platform database:

```javascript
// Connect to platform database
use thea_platform

// Check if thea-owner-dev tenant exists
db.tenants.findOne({ tenantId: "thea-owner-dev" })
```

If it doesn't exist, create it via the API:
- Navigate to `/owner/setup` in the browser
- Or call `POST /api/owner/setup-owner-tenant`

## Verification

After seeding, verify data exists:

1. **Check Diagnostics Page:**
   - Navigate to `/cvision/diagnostics`
   - Should show `Candidates: 1` (or more)

2. **Check Server Logs:**
   - When loading `/cvision/recruitment/requisitions`
   - Look for: `[CVision Requisitions GET] Result: { count: 1, ... }`

3. **Check Database Directly:**
   ```javascript
   use thea_tenant__thea-owner-dev
   db.cvision_candidates.countDocuments({ tenantId: "thea-owner-dev" })
   db.cvision_job_requisitions.countDocuments({ tenantId: "thea-owner-dev" })
   ```

## Troubleshooting

### Issue: "Tenant not found"
**Solution:** Ensure `thea-owner-dev` tenant exists in platform DB. Create it via `/owner/setup`.

### Issue: "Database does not exist"
**Solution:** MongoDB will create the database automatically on first insert. This is normal.

### Issue: "Permission denied" (tsx error)
**Solution:** Use Option 2 (Manual MongoDB Commands) or try running with different permissions.

### Issue: Seed runs but data not visible
**Solution:** 
1. Verify tenantId matches: Check debug banner shows `thea-owner-dev`
2. Check server logs for actual tenantId used in queries
3. Verify database name: Should be `thea_tenant__thea-owner-dev`
