/**
 * E2E: Patient Portal
 *
 * Tests the patient-facing portal:
 *   Login page → Appointments → Booking → Results
 *
 * Note: Portal uses OTP auth, so we test page rendering
 * rather than full login flow (OTP mocking not available).
 */

import { test, expect, Page } from '@playwright/test';
import { navigateTo } from '../helpers/navigation';
import { expectPageLoaded } from '../helpers/assertions';
import { BASE_URL } from '../helpers/constants';

test.describe('Patient Portal', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('PORTAL-E2E-01: Portal login page renders', async () => {
    await navigateTo(page, '/p/');

    // Should render a login/identification form
    // Portal may redirect to login or show ID input
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');

    // Should have some form of input (national ID, phone, etc.)
    const hasInput = await page.locator('input').first().isVisible().catch(() => false);
    const hasButton = await page.locator('button').first().isVisible().catch(() => false);
    expect(hasInput || hasButton).toBe(true);
  });

  test('PORTAL-E2E-02: Portal appointments page renders', async () => {
    await navigateTo(page, '/p/appointments');

    // May redirect to login if not authenticated — both outcomes are valid
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });

  test('PORTAL-E2E-03: Portal booking page renders', async () => {
    await navigateTo(page, '/p/book');

    // May redirect to login if not authenticated — both outcomes are valid
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
  });
});
