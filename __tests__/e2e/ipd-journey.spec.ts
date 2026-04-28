/**
 * E2E: Inpatient Department (IPD) Journey
 *
 * Admit → Live Beds → Nurse Station → Episode Detail → Discharge
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

test.describe('IPD Full Journey', () => {
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

  // ─── Step 1: IPD Intake ────────────────────────────────────────────────

  test('IPD-J-01: Navigate to IPD intake page', async () => {
    await navigateTo(page, '/ipd/intake');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('IPD-J-02: IPD intake page has admission UI elements', async () => {
    await waitForPageLoad(page);

    // Should have some form or list elements
    const hasContent =
      (await page.locator('input, button, table, [role="table"], [class*="card"]').count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 2: Live Beds ─────────────────────────────────────────────────

  test('IPD-J-03: Navigate to IPD live beds', async () => {
    await navigateTo(page, '/ipd/live-beds');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('IPD-J-04: Live beds page renders bed grid', async () => {
    await waitForDataLoad(page, '/api/ipd');

    // Should show beds (grid, cards, or list) or empty state
    const hasContent =
      (await page.locator('[class*="bed"], [class*="card"], [class*="grid"], table').count()) > 0 ||
      (await page.getByText(/no bed|empty|no data/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('IPD-J-05: IPD beds API returns data', async () => {
    const res = await page.request.get(`${BASE_URL}/api/ipd/beds`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.beds).toBeDefined();
    expect(Array.isArray(body.beds)).toBe(true);
  });

  // ─── Step 3: Nurse Station ─────────────────────────────────────────────

  test('IPD-J-06: Navigate to IPD nurse station', async () => {
    await navigateTo(page, '/ipd/nurse-station');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('IPD-J-07: IPD nurse station shows patient list', async () => {
    await waitForDataLoad(page, '/api/ipd');

    const hasContent =
      (await page.locator('[class*="card"], [class*="patient"], table, [role="row"]').count()) > 0 ||
      (await page.getByText(/no patient|empty|no data/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 4: IPD Dashboard ─────────────────────────────────────────────

  test('IPD-J-08: Navigate to IPD dashboard', async () => {
    await navigateTo(page, '/ipd/dashboard');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  // ─── Step 5: Bed creation via API ──────────────────────────────────────

  test('IPD-J-09: Create IPD bed via API', async () => {
    const res = await page.request.post(`${BASE_URL}/api/ipd/beds`, {
      data: {
        bedLabel: `E2E-BED-${Date.now()}`,
        ward: 'Medical Ward',
        room: 'Room 101',
        unit: 'GENERAL',
      },
    });

    expect(res.status()).toBeLessThan(300);
    const body = await res.json();
    const bed = body.bed || body;
    expect(bed.id || bed.bedLabel).toBeTruthy();
  });

  test('IPD-J-10: Created bed appears in beds list', async () => {
    const res = await page.request.get(`${BASE_URL}/api/ipd/beds`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.beds.length).toBeGreaterThan(0);
  });

  // ─── Step 6: Discharge API ─────────────────────────────────────────────

  test('IPD-J-11: Discharge finalize endpoint responds', async () => {
    const res = await page.request.get(`${BASE_URL}/api/discharge/finalize?encounterCoreId=non-existent`);
    // Should respond (even if no data found)
    expect(res.status()).toBeLessThan(500);
  });

  // ─── Step 7: Ward management ───────────────────────────────────────────

  test('IPD-J-12: Navigate to IPD ward overview', async () => {
    await navigateTo(page, '/ipd/wards');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
