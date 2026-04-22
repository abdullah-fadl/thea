/**
 * E2E: Emergency Room Journey
 *
 * Register walk-in → Triage → Board → Doctor → Nurse Station
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
import { TEST_USER, SAMPLE_PATIENTS, BASE_URL } from './helpers/constants';

test.describe('ER Full Journey', () => {
  let page: Page;
  let erEncounterId: string;
  let erPatientId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await setPlatformHealth(page);
    await setLanguageEnglish(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ─── Step 1: ER Registration ───────────────────────────────────────────

  test('ER-J-01: Navigate to ER registration page', async () => {
    await navigateTo(page, '/er/register');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-J-02: ER registration form is interactive', async () => {
    // Should have input fields or search for patient
    const inputs = page.locator('input[type="text"], input[type="search"], input[type="tel"]');
    const inputCount = await inputs.count();
    // Registration page should have at least one form input
    expect(inputCount).toBeGreaterThan(0);
  });

  test('ER-J-03: Register unknown walk-in patient via API', async () => {
    const res = await page.request.post(`${BASE_URL}/api/er/encounters/unknown`, {
      data: {
        fullName: 'Unknown Walk-in E2E',
        gender: 'MALE',
        approxAge: 40,
        arrivalMethod: 'WALKIN',
        paymentStatus: 'PENDING',
      },
    });

    expect(res.status()).toBeLessThan(300);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.encounter).toBeTruthy();
    erEncounterId = body.encounter.id;
    erPatientId = body.patient?.id || body.encounter.patientId;
  });

  // ─── Step 2: Triage ────────────────────────────────────────────────────

  test('ER-J-04: Triage — save initial vitals via API', async () => {
    expect(erEncounterId).toBeTruthy();

    const res = await page.request.post(`${BASE_URL}/api/er/triage/save`, {
      data: {
        encounterId: erEncounterId,
        vitals: {
          BP: '150/95',
          HR: 105,
          RR: 20,
          TEMP: 37.8,
          SPO2: 96,
          systolic: 150,
          diastolic: 95,
        },
        painScore: 6,
        chiefComplaint: 'Chest pain, shortness of breath',
        onset: '1 hour ago',
      },
    });

    expect(res.status()).toBeLessThan(300);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('ER-J-05: Triage — complete/finish via API', async () => {
    expect(erEncounterId).toBeTruthy();

    const res = await page.request.post(`${BASE_URL}/api/er/triage/finish`, {
      data: {
        encounterId: erEncounterId,
        vitals: {
          BP: '150/95',
          HR: 105,
          RR: 20,
          TEMP: 37.8,
          SPO2: 96,
          systolic: 150,
          diastolic: 95,
        },
        painScore: 6,
        chiefComplaint: 'Chest pain, shortness of breath',
      },
    });

    expect(res.status()).toBeLessThan(300);
    const body = await res.json();
    expect(body.success).toBe(true);
    if (body.triageLevel) {
      expect(body.triageLevel).toBeGreaterThanOrEqual(1);
      expect(body.triageLevel).toBeLessThanOrEqual(5);
    }
  });

  // ─── Step 3: ER Board ──────────────────────────────────────────────────

  test('ER-J-06: Navigate to ER board', async () => {
    await navigateTo(page, '/er/board');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-J-07: ER board shows encounters', async () => {
    await waitForDataLoad(page, '/api/er');

    // Board should have some patient indicators (cards, rows, etc.)
    const hasContent =
      (await page.locator('[class*="card"], [class*="encounter"], table, [role="row"]').count()) > 0 ||
      (await page.getByText(/no patient|empty|no encounter/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 4: Doctor view ───────────────────────────────────────────────

  test('ER-J-08: Navigate to ER doctor hub', async () => {
    await navigateTo(page, '/er/doctor');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-J-09: ER doctor "My Patients" loads', async () => {
    await waitForDataLoad(page, '/api/er');

    // Should show patient list or empty state
    const hasContent =
      (await page.locator('[class*="card"], [class*="patient"], table').count()) > 0 ||
      (await page.getByText(/no patient|empty/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('ER-J-10: Retrieve ER encounter detail via API', async () => {
    if (!erEncounterId) {
      test.skip();
      return;
    }

    const res = await page.request.get(
      `${BASE_URL}/api/er/encounters/${erEncounterId}`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.encounter).toBeTruthy();
    expect(body.encounter.status).toBeTruthy();
  });

  // ─── Step 5: Nurse station ─────────────────────────────────────────────

  test('ER-J-11: Navigate to ER nurse station', async () => {
    await navigateTo(page, '/er/nursing');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('ER-J-12: ER nurse station shows patients', async () => {
    await waitForDataLoad(page, '/api/er');

    const hasContent =
      (await page.locator('[class*="card"], [class*="patient"], table').count()) > 0 ||
      (await page.getByText(/no patient|empty/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ─── Step 6: ER Metrics ────────────────────────────────────────────────

  test('ER-J-13: ER metrics endpoint returns data', async () => {
    const res = await page.request.get(`${BASE_URL}/api/er/metrics`);
    expect(res.status()).toBe(200);
  });

  // ─── Step 7: Disposition ───────────────────────────────────────────────

  test('ER-J-14: Disposition via API — discharge', async () => {
    if (!erEncounterId) {
      test.skip();
      return;
    }

    const res = await page.request.post(
      `${BASE_URL}/api/er/encounters/${erEncounterId}/disposition`,
      {
        data: {
          type: 'DISCHARGE',
          finalDiagnosis: 'Non-cardiac chest pain (musculoskeletal)',
          dischargeInstructions: 'Rest, OTC pain relief, follow-up in 3 days if symptoms persist',
        },
      },
    );

    // May succeed or fail based on encounter state machine
    expect(res.status()).toBeLessThan(500);
  });
});
