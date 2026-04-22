# Clinical Infra Public ID QA

## Scope
- Clinical Infra entities: Facilities, Units, Floors, Rooms, Beds, Clinics, Specialties, Providers
- Staff/HR: employeeNo on Users
- UI: UUID hidden, shortCode displayed, copy internal ID action

## Setup
- Ensure tenant has admin access.
- Use tenant key in API calls and QA sessions.

## Test 1: Create N entities (shortCode generation)
1. Create 3 Facilities, Units, Floors, Rooms, Beds, Clinics, Specialties, Providers.
2. Verify each record has `shortCode` in API response.
3. Confirm format is `{PREFIX}-{zeroPad(seq)}` (e.g., `FAC-0001`, `PRV-0001`).
4. Ensure no duplicates across the same tenant/entity type.

Expected: unique shortCode per tenant/entityType, immutable on edit.

## Test 2: UI hides UUID, shows public ID
1. Open each Clinical Infra page.
2. Verify list item shows:
   - Name + `publicId` (shortCode)
   - Optional `code` if present
   - No raw UUID visible
3. Use “Copy internal ID” action and confirm clipboard receives UUID.

Expected: UUID not displayed, copy action works.

## Test 3: Search by shortCode/code/name
1. Call list endpoints with `?search=FAC-0001` (or any shortCode).
2. Call list endpoints with `?search=<code>` and `?search=<name>`.

Endpoints:
- `/api/clinical-infra/facilities`
- `/api/clinical-infra/units`
- `/api/clinical-infra/floors`
- `/api/clinical-infra/rooms`
- `/api/clinical-infra/beds`
- `/api/clinical-infra/clinics`
- `/api/clinical-infra/specialties`
- `/api/clinical-infra/providers`

Expected: matching results returned for shortCode/code/name.

## Test 4: Bulk Beds shortCode sequencing
1. Use `/api/clinical-infra/rooms/bulk` to create a batch of 10 rooms.
2. Create 10 beds assigned to those rooms (one per room).
3. Verify `shortCode` is sequential with no gaps/duplicates for the 10 beds.

Expected: bed shortCodes are sequential (e.g., `BED-0001` to `BED-0010`) within tenant.

## Test 5: shortCode immutability
1. Pick any Clinical Infra entity with a `shortCode`.
2. Call `PUT` on its API with `shortCode` changed.

Expected: request is rejected with 409/400 and `shortCode` remains unchanged.

## Test 6: Employee No (Users)
1. Create user with `employeeNo`.
2. Attempt to create another user with same `employeeNo` in same tenant.

Expected: second create rejected; employeeNo appears in Users list.
