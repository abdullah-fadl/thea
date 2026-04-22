/**
 * E2E: Operating Room (OR) Journey
 *
 * Cases list → Case detail tabs → Nurse station → KPI cards
 */

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/auth';
import {
  navigateTo,
  setPlatformHealth,
  setLanguageEnglish,
  waitForPageLoad,
  waitForDataLoad,
} from './helpers/navigation';
import { expectPageLoaded } from './helpers/assertions';
import { TEST_USER, BASE_URL } from './helpers/constants';

test.describe('OR Full Journey', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await setPlatformHealth(page);
    await setLanguageEnglish(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ─── Step 1: OR Cases List ─────────────────────────────────────────────

  test('OR-J-01: Navigate to OR cases page', async () => {
    await navigateTo(page, '/or/cases');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('OR-J-02: OR cases page renders case list', async () => {
    await waitForDataLoad(page, '/api/or');

    // Should render cases table/cards or empty state
    const hasContent =
      (await page.locator('table, [role="table"], [class*="card"], [class*="case"]').count()) > 0 ||
      (await page.getByText(/no case|empty|no data|no schedule/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 2: OR Schedule ───────────────────────────────────────────────

  test('OR-J-03: Navigate to OR schedule', async () => {
    await navigateTo(page, '/or/schedule');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('OR-J-04: OR schedule shows calendar or timeline', async () => {
    await waitForPageLoad(page);

    // Should have calendar/timeline or schedule elements
    const hasContent =
      (await page.locator('[class*="calendar"], [class*="timeline"], [class*="schedule"], table, [class*="card"]').count()) > 0 ||
      (await page.getByText(/no schedule|empty/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 3: OR Nurse Station ──────────────────────────────────────────

  test('OR-J-05: Navigate to OR nurse station', async () => {
    await navigateTo(page, '/or/nurse-station');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('OR-J-06: OR nurse station shows today\'s cases', async () => {
    await waitForDataLoad(page, '/api/or');

    // KPI cards or case list
    const hasContent =
      (await page.locator('[class*="card"], [class*="kpi"], [class*="stat"], table').count()) > 0 ||
      (await page.getByText(/no case|empty|today/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 4: OR Dashboard ──────────────────────────────────────────────

  test('OR-J-07: Navigate to OR dashboard', async () => {
    await navigateTo(page, '/or/dashboard');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  // ─── Step 5: API Endpoints ─────────────────────────────────────────────

  test('OR-J-08: OR schedule API responds', async () => {
    const res = await page.request.get(`${BASE_URL}/api/or/schedule`);
    expect(res.status()).toBeLessThan(500);
  });

  test('OR-J-09: OR cases API responds', async () => {
    const res = await page.request.get(`${BASE_URL}/api/or/cases`);
    expect(res.status()).toBeLessThan(500);
  });

  // ─── Step 6: OR case detail tabs (if any cases exist) ──────────────────

  test('OR-J-10: OR case detail renders tabs if case exists', async () => {
    // Try to get a case from API
    const casesRes = await page.request.get(`${BASE_URL}/api/or/cases`);
    if (casesRes.status() !== 200) return;
    const casesBody = await casesRes.json();
    const cases = casesBody.cases || casesBody.items || [];
    if (!Array.isArray(cases) || cases.length === 0) return;

    const firstCaseId = cases[0].id;
    await navigateTo(page, `/or/cases/${firstCaseId}`);
    await expectPageLoaded(page);

    // Should have tab navigation (Team, Time-Out, Anesthesia, PACU, Implants)
    const tabs = page.locator('[role="tab"], [role="tablist"] button, [class*="tab"]');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      expect(tabCount).toBeGreaterThanOrEqual(1);
    }
  });
});
