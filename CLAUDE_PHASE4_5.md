# CLAUDE_PHASE4_5.md — Phase 4: UX + Phase 5: Production Readiness

## Context
Phase 0 ✅ — PostgreSQL migration, legacy cleanup
Phase 1 ✅ — Validation, Error handling, Docker, CI/CD
Phase 2 ✅ — Loading/Error states, Monitoring, Logger, Backup
Phase 3 ✅ — NPHIES, API Docs, Caching, DB Migrations

## Phase 4 Mission: Make it look professional and work on all devices
## Phase 5 Mission: Make it reliable enough to sell with confidence

---

# PHASE 4: User Experience

## Step 1: Dark Mode (Fixes Gap #7)

### What to do:

1. Create a theme provider:
   - `lib/theme/ThemeProvider.tsx` — React context for theme (light/dark/system)
   - `lib/theme/useTheme.ts` — Hook to get/set theme
   - Store preference in localStorage
   - Respect system preference by default (prefers-color-scheme)

2. Update `app/layout.tsx`:
   - Wrap app in ThemeProvider
   - Add `class="dark"` to html element when dark mode active
   - Prevent flash of wrong theme on load (use script in head)

3. Update Tailwind config:
   - Enable `darkMode: 'class'` in tailwind.config.js/ts

4. Add dark: variants to ALL components:
   - Scan components/ and app/ for hardcoded colors
   - Replace with Tailwind dark: variants
   - Key areas: backgrounds, text colors, borders, shadows, cards, tables, inputs, buttons
   - Focus on main layout components first:
     - Header, Sidebar, MobileBottomNav
     - Cards, Tables, Forms
     - Login page
     - Dashboard pages

5. Add theme toggle button:
   - In Header component (top right, next to language toggle)
   - Sun/Moon icon
   - Dropdown: Light / Dark / System

### Design Rules:
- Dark background: slate-900 or zinc-900
- Dark card: slate-800 or zinc-800
- Dark text: slate-100
- Dark border: slate-700
- Keep the same accent colors (Thea blue/teal)
- Test both modes look good

---

## Step 2: Responsive Design (Fixes Gap #17)

### What to do:

1. Audit all main pages for mobile issues:
   - Dashboard
   - OPD Registration
   - Doctor Station
   - Nurse Station
   - Queue/Waiting list
   - Patient search
   - Booking/Appointments

2. Fix layout issues:
   - Tables: Add horizontal scroll wrapper on mobile
   - Sidebar: Collapsible on mobile (hamburger menu)
   - Forms: Stack fields vertically on mobile
   - Cards: Full width on mobile, grid on desktop
   - Modals: Full screen on mobile
   - Data tables: Hide non-essential columns on mobile

3. Add responsive breakpoints consistently:
   - Mobile: < 640px (sm)
   - Tablet: 640-1024px (md)
   - Desktop: > 1024px (lg)

4. Test key workflows on mobile:
   - Can a receptionist register a patient on a tablet?
   - Can a nurse enter vitals on a tablet?
   - Can a doctor write SOAP notes on a tablet?

---

## Step 3: Code Cleanup (Fixes Gap #18)

### What to do:

1. Find and remove dead code:
   ```bash
   # Find unused exports
   # Find unused imports
   # Find files not imported anywhere
   ```

2. Remove any remaining *New.tsx naming:
   - If a page only has the "New" version (Legacy was deleted), rename:
     - `DashboardNew.tsx` → `Dashboard.tsx`
     - `OPDRegistrationNew.tsx` → `OPDRegistration.tsx`
   - Update all imports

3. Fix inconsistent patterns:
   - Some files use `interface`, others use `type` — standardize
   - Some files have default exports, others named — standardize on named exports
   - Remove any `// TODO` or `// FIXME` that are already done

---

## Step 4: Split Large Files (Fixes Gaps #19, #20)

### What to do:

1. Split `lib/i18n.ts` (1,848 lines):
   ```
   lib/i18n/
     index.ts          — Main exports, language detection
     ar.ts             — Arabic translations
     en.ts             — English translations
     opd.ar.ts         — OPD Arabic strings
     opd.en.ts         — OPD English strings
     billing.ar.ts     — Billing Arabic strings
     billing.en.ts     — Billing English strings
     common.ar.ts      — Common Arabic strings
     common.en.ts      — Common English strings
   ```

2. Split `lib/permissions.ts` (37KB):
   ```
   lib/permissions/
     index.ts          — Main exports, permission checker
     roles.ts          — Role definitions
     opd.ts            — OPD permissions
     er.ts             — ER permissions
     ipd.ts            — IPD permissions
     billing.ts        — Billing permissions
     admin.ts          — Admin permissions
     owner.ts          — Owner permissions
   ```

3. Update all imports across the codebase to use new paths

---

# PHASE 5: Production Readiness

## Step 5: Automated Tests (Fixes Gap #1)

### What to do:

1. Install test framework:
   ```
   yarn add -D vitest @testing-library/react @testing-library/jest-dom
   ```

2. Create `vitest.config.ts`

3. Write tests for critical OPD API routes:
   ```
   __tests__/api/opd/
     encounters.test.ts    — Open, close, status change
     booking.test.ts       — Create, cancel, check-in, walk-in
     nursing.test.ts       — Create entry, correction
     doctor.test.ts        — Create note, addendum
     queue.test.ts         — Queue listing, ordering
   ```

4. Write tests for validation schemas:
   ```
   __tests__/validation/
     opd.test.ts           — Test all OPD schemas with valid/invalid data
     auth.test.ts          — Test auth schemas
     patient.test.ts       — Test patient schemas
   ```

5. Write tests for critical business logic:
   ```
   __tests__/lib/
     visitType.test.ts     — Visit type detection
     deathGuard.test.ts    — Death guard logic
     cache.test.ts         — Cache get/set/invalidate
   ```

6. Add test script to package.json:
   ```json
   "test": "vitest",
   "test:run": "vitest run"
   ```

7. Add test step to CI:
   ```yaml
   - run: yarn test:run
   ```

### Target: At least 50 tests covering critical paths

---

## Step 6: Accessibility (Fixes Gap #6)

### What to do:

1. Add aria-labels to all interactive elements:
   - Buttons, links, inputs, selects
   - Icons that convey meaning
   - Modal dialogs

2. Add keyboard navigation:
   - Tab order makes sense
   - Enter/Space activates buttons
   - Escape closes modals
   - Arrow keys in dropdowns

3. Add semantic HTML:
   - Use `<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`, `<article>`
   - Use `<h1>` through `<h6>` in correct hierarchy
   - Use `<table>` with `<thead>`, `<tbody>`, `<th scope>`
   - Use `<label>` linked to inputs

4. Add skip navigation link:
   - "Skip to main content" link at top of page
   - Visible only on focus

5. Verify color contrast:
   - Text on backgrounds meets WCAG AA (4.5:1 ratio)
   - Focus indicators are visible

---

## Step 7: Complete Pharmacy/Lab/Radiology (Fixes Gap #10)

### What to do:

Read existing code in these modules and complete what's missing:

1. **Pharmacy** (`app/(dashboard)/pharmacy/`, `app/api/pharmacy/`):
   - Complete dispensing workflow (prescribe → verify → dispense → pickup)
   - Inventory management (stock in, stock out, alerts for low stock)
   - Drug interaction checking (basic)

2. **Lab** (`app/(dashboard)/lab/`, `app/api/lab/`):
   - Complete specimen collection workflow
   - Result entry with reference ranges
   - Critical value alerts
   - Auto-notify ordering physician

3. **Radiology** (`app/(dashboard)/radiology/`, `app/api/radiology/`):
   - Study worklist
   - Report entry with templates
   - Study status tracking

For each: read what exists, identify what's missing, complete the gaps.

---

## Verification Checklist

```bash
# Dark mode
grep -rn "dark:" components/ app/ | wc -l  # > 100

# Responsive
grep -rn "sm:\|md:\|lg:" components/ app/ | wc -l  # > 200

# i18n split
test -d lib/i18n && echo "SPLIT"

# permissions split
test -d lib/permissions && echo "SPLIT"

# Tests
yarn test:run  # > 50 tests pass

# Accessibility
grep -rn "aria-label\|aria-" components/ | wc -l  # > 50

# TypeScript
npx tsc --noEmit  # 0 errors
```
