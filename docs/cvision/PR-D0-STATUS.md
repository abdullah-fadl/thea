# PR-D0: Bind Employee Department/Position to Org - Implementation Status

## ✅ Status: COMPLETE

All requirements for PR-D0 have been implemented and are working.

---

## A) Data ✅

### Employee Model Fields
- ✅ `departmentId: string` (nullable) - References `CVisionDepartment.id`
- ✅ `positionId: string | null` (nullable) - References `CVisionPositionType.id`

**Location:** `./lib/cvision/types.ts` (CVisionEmployee interface)

### Department Model
- ✅ `CvisionDepartment` is tenant-scoped (`tenantId` field)
- ✅ Single source of truth for departments
- ✅ Collection: `cvision_departments`

**Location:** `./prisma/schema.prisma`

---

## B) APIs ✅

### 1. GET /api/cvision/org/departments
- ✅ Returns `{ items: [{id, name, code?}] }` ordered by name
- ✅ Supports `?active=1` query parameter
- ✅ Tenant-scoped with authorization (`canReadOrg` policy)
- ✅ Projection returns only `id`, `name`, `code`

**Location:** `./app/api/cvision/org/departments/route.ts`

### 2. GET /api/cvision/org/departments/:id/positions
- ✅ Returns positions assigned to a department
- ✅ Response format: `{ items: [{positionId, positionTitle, positionCode}] }`
- ✅ Also includes full `positions` array for backward compatibility
- ✅ Validates department exists before returning positions

**Location:** `./app/api/cvision/org/departments/[id]/positions/route.ts`

### 3. PATCH /api/cvision/employees/:id/profile/EMPLOYMENT
- ✅ Accepts `departmentId` and `positionId` in `dataJson`
- ✅ Server validations:
  - ✅ Verifies `departmentId` exists in same tenant and is active
  - ✅ Verifies `positionId` exists and is assigned to `departmentId` (if provided)
  - ✅ Uses Zod schema (`employeeEmploymentSchema`) for strict validation
- ✅ Write-through logic: Updates root employee fields (`employee.departmentId`, `employee.positionId`)
- ✅ Detailed error messages with error codes (`DEPARTMENT_NOT_FOUND`, `POSITION_NOT_ASSIGNED_TO_DEPARTMENT`)

**Location:** `./app/api/cvision/employees/[id]/profile/[sectionKey]/route.ts`

**Validation Schema:** `./lib/cvision/profileSectionValidation.ts`

---

## C) UI ✅

### Employee Profile Page → Employment Tab

#### 1. Department Dropdown
- ✅ Replaced text input with `Select` component
- ✅ Options loaded from `GET /api/cvision/org/departments?active=1`
- ✅ Displays: `{name} ({code})` if code exists, otherwise just `{name}`
- ✅ Stores `departmentId` (UUID) in `editData.EMPLOYMENT.departmentId`
- ✅ Shows current selected department by matching `id`
- ✅ Clears `positionId` when department changes (positions are department-specific)

**Location:** `./app/(dashboard)/cvision/employees/[id]/page.tsx` (lines 730-768)

#### 2. Position Dropdown
- ✅ `Select` component for positions
- ✅ Options loaded from `GET /api/cvision/org/departments/:id/positions`
- ✅ Disabled until department is selected
- ✅ Displays position `title`
- ✅ Stores `positionId` (UUID) in `editData.EMPLOYMENT.positionId`
- ✅ Automatically reloads when department changes

**Location:** `./app/(dashboard)/cvision/employees/[id]/page.tsx` (lines 770-809)

#### 3. Legacy Data Handling
- ✅ Detects non-UUID `departmentId` values (legacy text strings)
- ✅ Shows warning banner: "Legacy Data Detected: Department is stored as '{value}' (not a valid ID)"
- ✅ Clears invalid values from `editData` to force user reselection
- ✅ Prevents saving until valid UUID is selected
- ✅ Console warnings in development mode

**Location:** `./app/(dashboard)/cvision/employees/[id]/page.tsx` (lines 300-323, 1285-1298)

#### 4. Save Button Logic
- ✅ Disabled if `departmentId` is not a valid UUID
- ✅ Disabled if `departmentId` doesn't exist in loaded departments list
- ✅ Disabled if no changes detected (dirty check)
- ✅ Enabled only when valid department is selected and changes exist

**Location:** `./app/(dashboard)/cvision/employees/[id]/page.tsx` (Save button disabled logic)

---

## D) Migration ✅

### Script: migrate-employee-department-ids.ts
- ✅ Processes all tenants
- ✅ Finds employees with non-UUID `departmentId` values
- ✅ Maps legacy strings (name/slug/code) to actual department UUIDs
- ✅ Uses lookup map built from department `code`, `slug`, and `name`
- ✅ Supports normalized matching (lowercase, trimmed, special chars removed)
- ✅ Dry-run mode by default (`DRY_RUN=false` to apply changes)
- ✅ Adds `migrationNotes` array to track changes
- ✅ Detailed logging and summary

**Location:** `./scripts/migrate-employee-department-ids.ts`

**Usage:**
```bash
# Preview changes (dry-run)
MONGO_URL="..." npx ts-node scripts/migrate-employee-department-ids.ts

# Apply changes
DRY_RUN=false MONGO_URL="..." npx ts-node scripts/migrate-employee-department-ids.ts
```

---

## E) Acceptance Criteria ✅

### 1. Create departments in Org page
- ✅ Departments can be created via Org management
- ✅ Departments are tenant-scoped and stored in `cvision_departments` collection

### 2. Department dropdown shows departments
- ✅ Employment tab loads departments on mount
- ✅ Dropdown displays all active departments
- ✅ Current selection is highlighted

### 3. Selecting department saves and persists
- ✅ Changes are saved via PATCH endpoint
- ✅ Root employee fields are updated (write-through)
- ✅ Profile section data is synced
- ✅ Refresh shows persisted selection

### 4. Manpower summary groups by departmentId
- ✅ Manpower summary uses `employee.departmentId` (root field, canonical)
- ✅ Groups employees by `(departmentId, positionId)` combination
- ✅ Warns in dev mode if profile section differs from root (data consistency check)
- ✅ Excel export includes department/position from root fields

**Location:** `./app/api/cvision/manpower/summary/route.ts`

---

## Additional Features Implemented

### Data Consistency
- ✅ Single source of truth: Root employee fields (`employee.departmentId`, `employee.positionId`)
- ✅ Write-through logic: Profile section updates sync to root fields
- ✅ Validation ensures department-position relationships are valid

### Error Handling
- ✅ Clear error messages for validation failures
- ✅ Error codes for programmatic handling (`DEPARTMENT_NOT_FOUND`, etc.)
- ✅ UI shows warnings for legacy data
- ✅ Prevents saving invalid data

### Authorization
- ✅ `canReadOrg` policy for department listing
- ✅ `canEditProfileSection` policy for profile updates
- ✅ Tenant-scoped queries throughout

### Developer Experience
- ✅ Console warnings for data inconsistencies (dev mode)
- ✅ Detailed logging in API routes (dev mode)
- ✅ Migration script with dry-run support

---

## Testing Checklist

- [x] Create departments via Org page
- [x] Open employee Employment tab
- [x] Verify department dropdown shows departments
- [x] Select a department
- [x] Verify position dropdown loads (if positions exist)
- [x] Select a position (optional)
- [x] Click Save
- [x] Refresh page
- [x] Verify selections persist
- [x] Check Manpower summary groups correctly
- [x] Verify Excel export includes correct department/position

---

## Files Modified/Created

### Core Implementation
- `./app/api/cvision/org/departments/route.ts` - Department listing API
- `./app/api/cvision/org/departments/[id]/positions/route.ts` - Position listing API
- `./app/api/cvision/employees/[id]/profile/[sectionKey]/route.ts` - Profile update with validation
- `./app/(dashboard)/cvision/employees/[id]/page.tsx` - UI with dropdowns
- `./lib/cvision/profileSectionValidation.ts` - Zod validation schemas

### Migration
- `./scripts/migrate-employee-department-ids.ts` - Legacy data migration script

### Types
- `./lib/cvision/types.ts` - CVisionEmployee interface with departmentId/positionId

---

## Notes

1. **Position Assignment**: Positions must be assigned to departments via `POST /api/cvision/org/departments/:id/positions` before they appear in the dropdown.

2. **Legacy Data**: The migration script handles legacy text-based departmentId values. UI also detects and warns about legacy data.

3. **Required Fields**: `departmentId` is required for EMPLOYMENT section (enforced by Zod schema). `positionId` is optional.

4. **Data Flow**: 
   - User selects department/position in UI
   - Data stored in `editData.EMPLOYMENT`
   - On save, validated and written to profile section
   - Write-through logic updates root employee fields
   - Manpower calculations use root fields (canonical)

---

**Status:** ✅ **COMPLETE** - All requirements implemented and tested.
