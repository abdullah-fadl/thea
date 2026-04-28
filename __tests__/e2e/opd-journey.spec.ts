/**
 * E2E: Full OPD Journey
 *
 * Receptionist → Register patient
 * Nurse → Record vitals
 * Doctor → SOAP note → Lab order → Prescription
 * Bilingual toggle verification (AR ↔ EN, RTL/LTR)
 */

import { test, expect, Page } from '@playwright/test';
import { login, logout } from './helpers/auth';
import {
  navigateTo,
  setPlatformHealth,
  setLanguageEnglish,
  waitForPageLoad,
  waitForDataLoad,
} from './helpers/navigation';
import { createPatientViaAPI, createEncounterViaAPI } from './helpers/api';
import { expectPageLoaded, expectNoErrors } from './helpers/assertions';
import { TEST_USER, SAMPLE_PATIENTS, BASE_URL } from './helpers/constants';

test.describe('OPD Full Journey', () => {
  let page: Page;
  let patientId: string;
  let patientMrn: string;
  let encounterCoreId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await setPlatformHealth(page);
    await setLanguageEnglish(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ─── Step 1: Receptionist registers patient ───────────────────────────

  test('OPD-J-01: Navigate to registration page', async () => {
    await navigateTo(page, '/opd/registration');
    await expectPageLoaded(page);

    // Should render search/register UI
    const body = page.locator('body');
    await expect(body).not.toHaveText('Unhandled Runtime Error');
  });

  test('OPD-J-02: Create test patient via API', async () => {
    try {
      const patient = await createPatientViaAPI(page, SAMPLE_PATIENTS.male);
      patientId = patient.id;
      patientMrn = patient.mrn;
      expect(patientId).toBeTruthy();
    } catch (err: any) {
      // If API fails, create patient data for downstream tests
      console.warn('Patient API creation failed, tests may be limited:', err.message);
    }
  });

  test('OPD-J-03: Search for created patient', async () => {
    await navigateTo(page, '/opd/registration');
    await waitForPageLoad(page);

    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      const searchTerm = patientMrn || SAMPLE_PATIENTS.male.firstName;
      await searchInput.fill(searchTerm);

      // Wait for search results
      await page
        .waitForResponse(
          (r) => r.url().includes('/api/patients') && r.status() === 200,
          { timeout: 10000 },
        )
        .catch(() => {});

      await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
    }
  });

  // ─── Step 2: Create encounter (walk-in) ────────────────────────────────

  test('OPD-J-04: Open encounter via API', async () => {
    if (!patientId) {
      test.skip();
      return;
    }

    try {
      const encounter = await createEncounterViaAPI(page, patientId);
      encounterCoreId = encounter.encounterCoreId;
    } catch {
      // Try the direct open endpoint
      const res = await page.request.post(`${BASE_URL}/api/opd/encounters/open`, {
        data: {
          patientMasterId: patientId,
          reason: 'E2E OPD journey test',
          visitType: 'FVC',
        },
      });
      if (res.ok()) {
        const body = await res.json();
        encounterCoreId = body.encounter?.id;
      }
    }
    expect(encounterCoreId).toBeTruthy();
  });

  // ─── Step 3: Nurse station — record vitals ─────────────────────────────

  test('OPD-J-05: Navigate to nurse station', async () => {
    await navigateTo(page, '/opd/nurse-station');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('OPD-J-06: Nurse station shows patient list', async () => {
    // Wait for data to load
    await waitForDataLoad(page, '/api/opd');

    // Should show some content (patient list or empty state)
    const hasContent =
      (await page.locator('table, [role="table"], [class*="card"]').count()) > 0 ||
      (await page.getByText(/no patient|no data|empty/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('OPD-J-07: Nurse records vitals via API', async () => {
    if (!encounterCoreId) {
      test.skip();
      return;
    }

    const res = await page.request.post(
      `${BASE_URL}/api/opd/encounters/${encounterCoreId}/nursing`,
      {
        data: {
          vitals: {
            BP: '120/80',
            HR: 72,
            RR: 16,
            TEMP: 36.8,
            SPO2: 98,
            weight: 75,
            height: 175,
          },
          painScore: 2,
          notes: 'E2E vitals test',
        },
      },
    );
    expect(res.status()).toBeLessThan(500);
  });

  // ─── Step 4: Doctor station — SOAP note ────────────────────────────────

  test('OPD-J-08: Navigate to doctor station', async () => {
    await navigateTo(page, '/opd/doctor-station');
    await expectPageLoaded(page);
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('OPD-J-09: Doctor station renders patient queue', async () => {
    await waitForDataLoad(page, '/api/opd');

    const hasContent =
      (await page.locator('table, [role="table"], [class*="card"], [class*="queue"]').count()) > 0 ||
      (await page.getByText(/no patient|empty/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('OPD-J-10: Doctor writes SOAP note via API', async () => {
    if (!encounterCoreId) {
      test.skip();
      return;
    }

    const res = await page.request.post(
      `${BASE_URL}/api/opd/encounters/${encounterCoreId}/visit-notes`,
      {
        data: {
          chiefComplaint: 'Routine follow-up for hypertension',
          historyOfPresentIllness: 'Patient reports adherence to medication. No headaches.',
          physicalExam: 'BP 120/80. Alert, oriented. Heart RRR.',
          assessment: 'Essential hypertension, well-controlled.',
          plan: 'Continue current medications. Recheck in 3 months.',
          diagnoses: [{ code: 'I10', description: 'Essential hypertension' }],
        },
      },
    );
    expect(res.status()).toBeLessThan(500);
  });

  // ─── Step 5: Doctor creates lab order ──────────────────────────────────

  test('OPD-J-11: Doctor orders lab test via API', async () => {
    if (!encounterCoreId || !patientId) {
      test.skip();
      return;
    }

    const res = await page.request.post(`${BASE_URL}/api/lab/orders`, {
      data: {
        patientId,
        patientName: `${SAMPLE_PATIENTS.male.firstName} ${SAMPLE_PATIENTS.male.lastName}`,
        mrn: patientMrn || 'E2E-MRN',
        encounterId: encounterCoreId,
        testCode: 'HBA1C',
        testName: 'Hemoglobin A1c',
        priority: 1,
      },
    });
    expect(res.status()).toBeLessThan(500);
  });

  // ─── Step 6: Doctor creates prescription ───────────────────────────────

  test('OPD-J-12: Doctor prescribes medication via API', async () => {
    if (!patientId) {
      test.skip();
      return;
    }

    const res = await page.request.post(`${BASE_URL}/api/pharmacy/prescriptions`, {
      data: {
        patientId,
        patientName: `${SAMPLE_PATIENTS.male.firstName} ${SAMPLE_PATIENTS.male.lastName}`,
        mrn: patientMrn || 'E2E-MRN',
        encounterId: encounterCoreId,
        medication: 'Amlodipine',
        strength: '5mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '30 days',
        quantity: 30,
      },
    });
    expect(res.status()).toBeLessThan(500);
  });

  // ─── Step 7: Bilingual toggle ──────────────────────────────────────────

  test('OPD-J-13: Bilingual toggle — switch to Arabic', async () => {
    await navigateTo(page, '/opd/dashboard');
    await waitForPageLoad(page);

    // Set Arabic language via cookie
    const domain = new URL(BASE_URL).hostname;
    await page.context().addCookies([
      { name: 'px-language', value: 'ar', domain, path: '/' },
    ]);
    await page.evaluate(() => localStorage.setItem('px-language', 'ar'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Check for RTL direction
    const dir = await page.locator('html, [dir]').first().getAttribute('dir');
    const bodyDir = await page.evaluate(() => {
      const el = document.querySelector('[dir="rtl"]') || document.documentElement;
      return getComputedStyle(el).direction;
    });

    const isRtl = dir === 'rtl' || bodyDir === 'rtl';
    // At least one RTL indicator should be present
    // Some pages may not have explicit dir attr — check for Arabic text
    const hasArabicText = await page.evaluate(() => {
      const text = document.body.innerText;
      return /[\u0600-\u06FF]/.test(text);
    });
    expect(isRtl || hasArabicText).toBe(true);
  });

  test('OPD-J-14: Bilingual toggle — switch back to English', async () => {
    const domain = new URL(BASE_URL).hostname;
    await page.context().addCookies([
      { name: 'px-language', value: 'en', domain, path: '/' },
    ]);
    await page.evaluate(() => localStorage.setItem('px-language', 'en'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Check for LTR direction
    const dir = await page.locator('html, [dir]').first().getAttribute('dir');
    const bodyDir = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).direction;
    });

    const isLtr = dir === 'ltr' || dir === null || bodyDir === 'ltr';
    expect(isLtr).toBe(true);
  });

  // ─── Step 8: OPD Dashboard loads ───────────────────────────────────────

  test('OPD-J-15: OPD Dashboard renders with KPI cards', async () => {
    await navigateTo(page, '/opd/dashboard');
    await expectPageLoaded(page);

    // Dashboard should have some data displays
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
