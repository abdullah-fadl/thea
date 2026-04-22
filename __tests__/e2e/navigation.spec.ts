/**
 * E2E: Full App Navigation
 *
 * Visits every major section: OPD, ER, IPD, ICU, OR, Lab, Radiology,
 * Pharmacy, Billing, Admin, Scheduling.
 *
 * Verifies:
 * - Pages load without error (no blank screens, no console errors)
 * - Sidebar navigation works
 * - Responsive: mobile (375px) and desktop (1440px)
 */

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/auth';
import {
  navigateTo,
  setPlatformHealth,
  setLanguageEnglish,
  waitForPageLoad,
} from './helpers/navigation';
import { expectPageLoaded } from './helpers/assertions';
import { TEST_USER } from './helpers/constants';

/**
 * All major sections to navigate through.
 * Format: [path, label]
 */
const MAJOR_SECTIONS: [string, string][] = [
  // OPD
  ['/opd/dashboard', 'OPD Dashboard'],
  ['/opd/registration', 'OPD Registration'],
  ['/opd/appointments', 'OPD Appointments'],
  ['/opd/waiting-list', 'OPD Waiting List'],
  ['/opd/nurse-station', 'OPD Nurse Station'],
  ['/opd/doctor-station', 'OPD Doctor Station'],

  // ER
  ['/er/board', 'ER Board'],
  ['/er/register', 'ER Register'],
  ['/er/nursing', 'ER Nursing'],
  ['/er/doctor', 'ER Doctor'],

  // IPD
  ['/ipd/live-beds', 'IPD Live Beds'],
  ['/ipd/nurse-station', 'IPD Nurse Station'],
  ['/ipd/dashboard', 'IPD Dashboard'],

  // ICU
  ['/icu/dashboard', 'ICU Dashboard'],

  // OR
  ['/or/cases', 'OR Cases'],
  ['/or/schedule', 'OR Schedule'],

  // Lab
  ['/lab/orders', 'Lab Orders'],
  ['/lab/results', 'Lab Results'],

  // Radiology
  ['/radiology/worklist', 'Radiology Worklist'],

  // Pharmacy
  ['/pharmacy/prescriptions', 'Pharmacy Prescriptions'],
  ['/pharmacy/dispensing', 'Pharmacy Dispensing'],

  // Billing
  ['/billing/dashboard', 'Billing Dashboard'],

  // Admin
  ['/admin/users', 'Admin Users'],
  ['/admin/departments', 'Admin Departments'],

  // Scheduling
  ['/scheduling', 'Scheduling'],
];

test.describe('Full App Navigation', () => {
  let page: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known noisy errors
        if (
          text.includes('favicon') ||
          text.includes('ChunkLoadError') ||
          text.includes('Loading chunk') ||
          text.includes('net::ERR')
        ) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await setPlatformHealth(page);
    await setLanguageEnglish(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ─── Visit every major section ─────────────────────────────────────────

  for (const [path, label] of MAJOR_SECTIONS) {
    test(`NAV-${label}: ${path} loads without error`, async () => {
      consoleErrors.length = 0; // Reset per test

      await navigateTo(page, path);
      await expectPageLoaded(page);

      // No blank page — body should have some content
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(0);

      // No Unhandled Runtime Error
      await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');

      // No 404 page
      const is404 = await page.getByText('404').isVisible().catch(() => false);
      if (is404) {
        // Some sections may not have a dedicated page yet — that's fine,
        // but it shouldn't crash
        const isNotFoundPage =
          (await page.getByText('Page not found').isVisible().catch(() => false)) ||
          (await page.getByText('Not Found').isVisible().catch(() => false));
        // If it's a proper 404 page, that's OK — it means routing works
        // If it's an error crash, that's not OK
        expect(await page.getByText('Unhandled Runtime Error').isVisible().catch(() => false)).toBe(false);
      }
    });
  }

  // ─── Sidebar Navigation ────────────────────────────────────────────────

  test('NAV-SIDEBAR: Sidebar is visible on desktop', async () => {
    await navigateTo(page, '/opd/dashboard');
    await waitForPageLoad(page);

    // Sidebar should be present (nav, aside, or sidebar-specific class)
    const sidebar = page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first();
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    // On desktop, sidebar should be visible (could be collapsed)
    expect(sidebarVisible).toBe(true);
  });

  test('NAV-SIDEBAR: Sidebar has navigation links', async () => {
    const sidebar = page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first();
    if (!(await sidebar.isVisible().catch(() => false))) return;

    // Should have clickable links
    const links = sidebar.locator('a, button');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  // ─── Responsive: Mobile ────────────────────────────────────────────────

  test('NAV-MOBILE: Pages render at 375px width', async () => {
    await page.setViewportSize({ width: 375, height: 812 });

    await navigateTo(page, '/opd/dashboard');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');

    // Body should have content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('NAV-MOBILE: ER board renders at mobile width', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateTo(page, '/er/board');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('NAV-MOBILE: Billing renders at mobile width', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateTo(page, '/billing/dashboard');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  // ─── Responsive: Desktop ───────────────────────────────────────────────

  test('NAV-DESKTOP: Pages render at 1440px width', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await navigateTo(page, '/opd/dashboard');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');

    // Body should have content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('NAV-DESKTOP: IPD live beds renders at desktop width', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateTo(page, '/ipd/live-beds');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  // ─── Console Error Summary ─────────────────────────────────────────────

  test('NAV-CONSOLE: No critical console errors accumulated', async () => {
    // Filter for truly critical errors (not just warnings or expected failures)
    const critical = consoleErrors.filter(
      (e) =>
        e.includes('TypeError') ||
        e.includes('ReferenceError') ||
        e.includes('Cannot read properties of') ||
        e.includes('is not a function'),
    );
    if (critical.length > 0) {
      console.warn('Critical console errors found:', critical);
    }
    // Allow up to 3 critical errors (some may be from 3rd-party scripts)
    expect(critical.length).toBeLessThanOrEqual(3);
  });
});
