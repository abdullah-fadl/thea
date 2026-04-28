# Welcome Page & Dashboard Redirect - Test Plan

## Overview
This document describes the test scenarios for the welcome page and dashboard redirect functionality.

## Test Scenarios

### 1. User Without Dashboard Access

**Setup:**
- User with permissions: `['opd.dashboard.view', 'policies.view']` (no `dashboard.view`)
- User navigates to `/dashboard`

**Expected Behavior:**
- User is redirected to `/welcome`
- Welcome page displays modules user has access to (OPD Dashboard, Policies)
- Dashboard module is NOT shown
- No "Access Denied" message on dashboard page

**Manual Test Steps:**
1. Create a user without `dashboard.view` permission
2. Login as that user
3. Navigate to `/dashboard`
4. Verify redirect to `/welcome`
5. Verify welcome page shows correct modules

---

### 2. User With Dashboard Access

**Setup:**
- User with permissions: `['dashboard.view', 'policies.view']`
- User navigates to `/dashboard`

**Expected Behavior:**
- User can access `/dashboard` normally
- Dashboard page loads and displays content
- User can also access `/welcome` if they navigate there directly (no forced redirect)

**Manual Test Steps:**
1. Login as admin user (has `dashboard.view`)
2. Navigate to `/dashboard`
3. Verify dashboard loads normally
4. Navigate to `/welcome`
5. Verify welcome page loads (no redirect back to dashboard)

---

### 3. Welcome Page Module Filtering

**Setup:**
- User with limited permissions: `['policies.view', 'account.view']`
- User navigates to `/welcome`

**Expected Behavior:**
- Welcome page shows only modules user has access to:
  - Policies
  - Account
- Welcome page does NOT show:
  - Dashboard
  - OPD Dashboard
  - ER modules
  - Other restricted modules

**Manual Test Steps:**
1. Create user with limited permissions
2. Login and navigate to `/welcome`
3. Verify only permitted modules are shown
4. Click on a module card
5. Verify navigation to that module works

---

### 4. Single Module Access

**Setup:**
- User with only one permission: `['policies.view']`
- User navigates to `/welcome`

**Expected Behavior:**
- Welcome page shows only one module (Policies)
- Module card has visual focus (ring-2 ring-primary)
- User can still click to navigate (no auto-redirect)

**Manual Test Steps:**
1. Create user with single permission
2. Navigate to `/welcome`
3. Verify single module is shown with focus styling
4. Click module to navigate

---

### 5. No Permissions User

**Setup:**
- User with no permissions: `[]`
- User navigates to `/welcome`

**Expected Behavior:**
- Welcome page shows "Access Denied" message
- No module cards displayed
- Message: "You do not have access to any modules"
- Contact admin message shown

**Manual Test Steps:**
1. Create user with empty permissions array
2. Login and navigate to `/welcome`
3. Verify access denied message is shown

---

### 6. Unauthenticated User

**Setup:**
- No user logged in
- User navigates to `/dashboard` or `/welcome`

**Expected Behavior:**
- Middleware redirects to `/login`
- User cannot access protected routes

**Manual Test Steps:**
1. Logout (clear cookies)
2. Navigate to `/dashboard`
3. Verify redirect to `/login`
4. Navigate to `/welcome`
5. Verify redirect to `/login`

---

### 7. Login Redirect Logic

**Setup:**
- User logs in successfully
- User has different permission sets

**Expected Behavior:**
- If user has `dashboard.view` → redirect to `/dashboard`
- If user does NOT have `dashboard.view` → redirect to `/welcome`

**Manual Test Steps:**
1. Login as admin (has dashboard access)
2. Verify redirect to `/dashboard` after login
3. Logout
4. Login as user without dashboard access
5. Verify redirect to `/welcome` after login

---

## Integration Test Notes

These tests require:
- Test database setup
- User creation with specific permissions
- Authentication cookies
- Browser automation (Playwright/Cypress) for full E2E tests

## Unit Tests

Unit tests for helper functions are in `__tests__/welcome.test.ts`:
- `canAccessMainDashboard` function tests
- `getAccessibleModules` function tests

Run with: `npm test` or `jest __tests__/welcome.test.ts` (when Jest is configured)

