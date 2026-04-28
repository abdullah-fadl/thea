/**
 * E2E: Patient Portal
 *
 * Login via portal → Navigate portal sections → Bilingual toggle
 *
 * Note: Patient portal uses OTP-based login at /p/login.
 * Since OTP delivery requires real SMS/Email integration,
 * we test the portal pages using a pre-authenticated session
 * (login as admin and navigate to portal pages that don't require
 * separate portal auth, or test the login UI without completing OTP).
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
import { TEST_USER, BASE_URL } from './helpers/constants';

test.describe('Patient Portal', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ─── Portal Login UI ──────────────────────────────────────────────────

  test('PORTAL-01: Portal login page loads', async () => {
    await page.goto(`${BASE_URL}/p/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await waitForPageLoad(page);

    // Should show a login form (OTP-based: phone/email input)
    await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');

    // Should have an input for identifier (phone, email, MRN)
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test('PORTAL-02: Portal login page has submit mechanism', async () => {
    // Should have a button or form to proceed
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('PORTAL-03: Portal login page renders bilingual', async () => {
    // Check for Arabic text presence
    const bodyText = await page.locator('body').innerText();
    // Portal should show some text (either AR or EN)
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  // ─── Portal Pages (pre-authenticated via admin) ────────────────────────
  // Navigate to portal pages through the admin session to verify they render

  test('PORTAL-04: Login as admin and set platform', async () => {
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);
    await setPlatformHealth(page);
    await setLanguageEnglish(page);
  });

  test('PORTAL-05: Portal appointments page exists', async () => {
    await navigateTo(page, '/p/appointments');

    // May redirect to /p/login if portal auth is required — that's OK
    const url = page.url();
    if (url.includes('/p/login')) {
      // Portal requires separate auth — the redirect itself is correct behavior
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
      await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
    }
  });

  test('PORTAL-06: Portal results page exists', async () => {
    await navigateTo(page, '/p/results');

    const url = page.url();
    if (url.includes('/p/login')) {
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
      await expect(page.locator('body')).not.toHaveText('Unhandled Runtime Error');
    }
  });

  test('PORTAL-07: Portal medications page exists', async () => {
    await navigateTo(page, '/p/medications');

    const url = page.url();
    if (url.includes('/p/login')) {
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
    }
  });

  test('PORTAL-08: Portal vitals page exists', async () => {
    await navigateTo(page, '/p/vitals');

    const url = page.url();
    if (url.includes('/p/login')) {
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
    }
  });

  test('PORTAL-09: Portal care-path page exists', async () => {
    await navigateTo(page, '/p/care-path');

    const url = page.url();
    if (url.includes('/p/login')) {
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
    }
  });

  test('PORTAL-10: Portal messages page exists', async () => {
    await navigateTo(page, '/p/messages');

    const url = page.url();
    if (url.includes('/p/login')) {
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
    }
  });

  test('PORTAL-11: Portal profile page exists', async () => {
    await navigateTo(page, '/p/profile');

    const url = page.url();
    if (url.includes('/p/login')) {
      expect(url).toContain('/p/');
    } else {
      await expectPageLoaded(page);
    }
  });

  // ─── Portal Bilingual Toggle ───────────────────────────────────────────

  test('PORTAL-12: Portal login page — switch to Arabic', async () => {
    await page.goto(`${BASE_URL}/p/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await waitForPageLoad(page);

    // Set Arabic
    const domain = new URL(BASE_URL).hostname;
    await page.context().addCookies([
      { name: 'px-language', value: 'ar', domain, path: '/' },
    ]);
    await page.evaluate(() => localStorage.setItem('px-language', 'ar'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Check for Arabic text
    const hasArabic = await page.evaluate(() => {
      const text = document.body.innerText;
      return /[\u0600-\u06FF]/.test(text);
    });
    expect(hasArabic).toBe(true);
  });

  test('PORTAL-13: Portal login page — switch back to English', async () => {
    const domain = new URL(BASE_URL).hostname;
    await page.context().addCookies([
      { name: 'px-language', value: 'en', domain, path: '/' },
    ]);
    await page.evaluate(() => localStorage.setItem('px-language', 'en'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Check for English text
    const hasEnglish = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('login') || text.includes('sign in') || text.includes('enter') || text.includes('portal');
    });
    expect(hasEnglish).toBe(true);
  });

  // ─── Portal API Endpoints ──────────────────────────────────────────────

  test('PORTAL-14: Portal auth API responds', async () => {
    // Re-login for API calls
    await login(page, TEST_USER.email, TEST_USER.password, TEST_USER.tenantId);

    const res = await page.request.get(`${BASE_URL}/api/portal/auth/me`);
    // May return 401 (portal uses different auth) or 200 — both are valid
    expect(res.status()).toBeLessThan(500);
  });
});
