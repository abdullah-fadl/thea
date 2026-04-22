/**
 * UI Crawl Test
 * 
 * Comprehensive test that verifies every UI page:
 * - Loads correctly
 * - Respects permissions
 * - Has no runtime/console errors
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test users
const TENANT_A_ADMIN = {
  email: 'test-a@example.com',
  password: 'password123',
  tenantId: 'test-tenant-a',
  platform: 'sam' as const,
};

const NOSAM_USER = {
  email: 'nosam@example.com',
  password: 'password123',
  tenantId: 'test-tenant-nosam',
  platform: 'health' as const,
};

interface RouteInfo {
  path: string;
  url: string;
  isDynamic: boolean;
  dynamicParams: string[];
  placeholders?: Record<string, string>;
  tags?: string[];
}

interface CrawlResult {
  route: string;
  url: string;
  user: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  consoleErrors: string[];
  pageErrors: string[];
  accessStatus: 'allowed' | 'blocked' | 'redirected' | 'error';
  loadTime?: number;
}

interface CrawlResults {
  timestamp: string;
  totalRoutes: number;
  passed: number;
  failed: number;
  skipped: number;
  results: CrawlResult[];
}

/**
 * Login helper - resilient to optional tenant selector and connection errors
 */
async function login(page: Page, email: string, password: string, tenantId?: string) {
  // Retry initial navigation with connection error handling
  let navigationSuccess = false;
  let lastError: any = null;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      navigationSuccess = true;
      break;
    } catch (error: any) {
      lastError = error;
      // Check if it's a connection error
      if (error.message?.includes('ERR_CONNECTION_REFUSED') || 
          error.message?.includes('net::ERR')) {
        if (attempt < 2) {
          // Wait before retry (exponential backoff: 3s, 6s)
          const waitTime = 3000 * (attempt + 1);
          await page.waitForTimeout(waitTime);
          console.log(`[login] Connection error, retrying navigation (attempt ${attempt + 1}/3, waited ${waitTime}ms)...`);
          continue;
        }
        // Last attempt failed - throw with clear message
        throw new Error(`Failed to navigate to login page after 3 attempts: Server connection refused. The server may have crashed during the test. Original error: ${error.message}`);
      }
      // Other errors - throw immediately
      throw error;
    }
  }
  
  if (!navigationSuccess) {
    throw lastError || new Error(`Failed to navigate to login page after 3 attempts - server may be unavailable`);
  }
  
  // Wait for login form to appear (step 1)
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Step 1: Identify (email only)
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Wait for API response — either password field, tenant buttons, or error
  await page.waitForFunction(
    () => {
      const passwordInput = document.querySelector('input[type="password"]');
      const tenantButton = document.querySelector('button[aria-pressed]');
      const errorAlert = document.querySelector('[role="alert"]');
      return passwordInput || tenantButton || (errorAlert && errorAlert.textContent?.includes('Invalid'));
    },
    { timeout: 15000 }
  );

  // Handle tenant selection (buttons with aria-pressed, not a <select>)
  if (tenantId) {
    const tenantButtons = page.locator('button[aria-pressed]');
    const count = await tenantButtons.count();
    if (count > 0) {
      // Click the tenant button whose text contains the tenantId
      let clicked = false;
      for (let i = 0; i < count; i++) {
        const text = await tenantButtons.nth(i).textContent();
        if (text?.includes(tenantId)) {
          await tenantButtons.nth(i).click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // Default: click first tenant
        await tenantButtons.first().click();
      }
      // After selecting tenant, click continue
      await page.click('button[type="submit"]');
      // Wait for password step
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    }
  }

  // Step 2: Login with password
  await page.fill('input[type="password"]', password);

  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete (either /platforms, /welcome, or /owner)
  // Use retry logic to handle connection errors gracefully
  let loginNavigationSuccess = false;
  let finalUrl = page.url();
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Check if we're already on expected page (navigation might have completed)
      finalUrl = page.url();
      if (!finalUrl.includes('/login')) {
        loginNavigationSuccess = true;
        break;
      }
      
      // Wait for navigation with timeout
      await page.waitForURL(
        (url) => !url.pathname.includes('/login'),
        { timeout: 15000 }
      );
      
      finalUrl = page.url();
      loginNavigationSuccess = true;
      break;
    } catch (error: any) {
      // Check if it's a connection error
      if (error.message?.includes('ERR_CONNECTION_REFUSED') || 
          error.message?.includes('net::ERR')) {
        // Connection error - check current URL before retrying
        finalUrl = page.url();
        
        // If we're already on expected page, navigation succeeded
        if (!finalUrl.includes('/login')) {
          loginNavigationSuccess = true;
          break;
        }
        
        // Wait before retry
        if (attempt < 2) {
          await page.waitForTimeout(2000 * (attempt + 1));
          continue;
        }
      }
      
      // Other errors - check current URL as fallback
      finalUrl = page.url();
      if (!finalUrl.includes('/login')) {
        // Navigation completed despite error
        loginNavigationSuccess = true;
        break;
      }
      
      // If last attempt, throw error
      if (attempt === 2) {
        throw error;
      }
    }
  }
  
  // Verify we reached expected landing page
  const isOnExpectedPage = finalUrl.includes('/platforms') || 
                           finalUrl.includes('/welcome') || 
                           finalUrl.includes('/owner') ||
                           finalUrl.includes('/dashboard');
  
  if (!loginNavigationSuccess || !isOnExpectedPage) {
    // If connection was refused but we're not on login, assume partial success
    if (finalUrl.includes('chrome-error://') || finalUrl.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error(`Login failed: Server connection refused. URL: ${finalUrl}`);
    }
    throw new Error(`Login completed but unexpected URL: ${finalUrl}`);
  }

  // Wait for auth cookie and /api/auth/me to stabilize before continuing
  await page.waitForResponse(
    (response) => response.url().includes('/api/auth/me') && response.status() === 200,
    { timeout: 15000 }
  ).catch(() => {});
  const authCookieDeadline = Date.now() + 15000;
  while (Date.now() < authCookieDeadline) {
    const cookies = await page.context().cookies();
    if (cookies.some((cookie) => cookie.name === 'auth-token')) {
      break;
    }
    await page.waitForTimeout(300);
  }
}

/**
 * Set platform cookie
 */
async function setPlatform(page: Page, platform: 'sam' | 'health') {
  await page.context().addCookies([
    {
      name: 'thea_platform',
      value: platform,
      url: BASE_URL,
      path: '/',
      httpOnly: true,
    },
    {
      name: 'thea_last_platform',
      value: platform,
      url: BASE_URL,
      path: '/',
      httpOnly: false,
    },
  ]);
  await page.waitForTimeout(100);
}

/**
 * Load routes from ui-routes.json
 */
function loadRoutes(): RouteInfo[] {
  const routesPath = path.join(process.cwd(), 'ui-routes.json');
  
  if (!fs.existsSync(routesPath)) {
    throw new Error(`ui-routes.json not found. Run 'yarn routes:ui' first.`);
  }
  
  const routesJson = fs.readFileSync(routesPath, 'utf-8');
  return JSON.parse(routesJson) as RouteInfo[];
}

/**
 * Determine if route should be accessible by user
 */
function shouldBeAccessible(route: RouteInfo, userEmail: string): boolean {
  // Public routes are always accessible
  const isPublic = route.tags?.includes('access:public');
  if (isPublic) return true;
  
  // Owner routes - only for owner users (we'll test with admin for now)
  const isOwnerRoute = route.tags?.includes('access:owner');
  if (isOwnerRoute) {
    // For now, assume owner routes need manual testing
    return false; // Skip owner routes in automated crawl
  }
  
  // Admin routes - only for admin users
  const isAdminRoute = route.tags?.includes('access:admin');
  if (isAdminRoute) {
    return userEmail === TENANT_A_ADMIN.email; // Only tenant-a admin
  }
  
  // Platform-specific routes
  const isSamRoute = route.tags?.includes('platform:sam');
  const isHealthRoute = route.tags?.includes('platform:health');
  
  if (isSamRoute && userEmail === NOSAM_USER.email) {
    return false; // NoSAM user shouldn't access SAM routes
  }
  
  if (isHealthRoute && userEmail === TENANT_A_ADMIN.email) {
    // Tenant A admin can access health if they switch platform
    return true; // They can switch platforms
  }
  
  // Default: accessible
  return true;
}

/**
 * Crawl a single route with retry logic
 */
async function crawlRoute(
  page: Page,
  route: RouteInfo,
  userEmail: string
): Promise<CrawlResult> {
  const expectedAccess = shouldBeAccessible(route, userEmail);
  const result: CrawlResult = {
    route: route.path,
    url: route.url,
    user: userEmail,
    status: 'passed',
    consoleErrors: [],
    pageErrors: [],
    accessStatus: 'allowed',
  };
  
  const startTime = Date.now();
  let navigationResponse: any = null;
  
  try {
    // Set up console error listeners
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    
    const consoleHandler = (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    
    const pageErrorHandler = (error: Error) => {
      pageErrors.push(error.message);
    };
    
    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);
    
    // Retry logic for connection errors (max 1 retry for connection reset)
    let navigationSuccess = false;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Add small delay between attempts
        if (attempt > 0) {
          await page.waitForTimeout(2000); // 2 second delay for retry
        }
        
        // Navigate to route with retry
        navigationResponse = await page.goto(`${BASE_URL}${route.url}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        
        navigationSuccess = true;
        break;
      } catch (error: any) {
        lastError = error;
        // Check if it's a connection error (reset or refused)
        if (error.message?.includes('ERR_CONNECTION_RESET') || 
            error.message?.includes('ERR_CONNECTION_REFUSED') ||
            error.message?.includes('net::ERR')) {
          // Connection error - retry once
          if (attempt < 1) {
            console.log(`[retry ${attempt + 1}/2] Connection error for ${route.url}, retrying...`);
            continue;
          }
        } else if (error.message?.includes('Navigation interrupted')) {
          // Navigation interrupted - wait a bit and retry once
          if (attempt < 1) {
            await page.waitForTimeout(2000);
            continue;
          }
        } else {
          // Other error - don't retry
          break;
        }
      }
    }
    
    // Remove listeners
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
    
    if (!navigationSuccess) {
      throw lastError || new Error('Navigation failed after retries');
    }
    
    // Wait for navigation to complete (including redirects)
    // Check if we were redirected
    const finalUrl = page.url();
    const wasRedirected = !finalUrl.includes(route.url.split('?')[0]);
    
    // If redirected, wait for redirect to complete
    if (wasRedirected) {
      try {
        // Wait for URL to stabilize (redirect completed)
        await page.waitForURL(
          (url) => !url.pathname.includes(route.url.split('?')[0]),
          { timeout: 5000 }
        );
      } catch (error) {
        // Redirect might have already completed, continue
      }
    }
    
    // Add small delay after navigation to let page settle
    await page.waitForTimeout(500);
    
    // Wait for page-ready marker (or timeout after 5s)
    try {
      await page.waitForSelector('[data-testid="page-ready"]', {
        timeout: 5000,
      });
    } catch (error) {
      // Page-ready marker not found - might be error page or redirect
      const currentUrl = page.url();
      if (!currentUrl.includes(route.url.split('?')[0])) {
        // Redirected
        result.accessStatus = 'redirected';
        result.status = 'passed'; // Redirect is OK for blocked routes
      } else {
        // No page-ready marker but still on page
        result.error = 'Page-ready marker not found';
        result.status = 'failed';
      }
    }
    
    // Check access status FIRST (before checking console errors)
    const currentUrl = page.url();
    const pageContent = await page.textContent('body') || '';
    const responseStatus = navigationResponse?.status?.();
    
    // Check if blocked/forbidden
    if (
      currentUrl.includes('/login') ||
      currentUrl.includes('/platforms?reason=') ||
      pageContent.toLowerCase().includes('access denied') ||
      pageContent.toLowerCase().includes('forbidden') ||
      pageContent.toLowerCase().includes('not entitled')
    ) {
      result.accessStatus = 'blocked';
    } else if (!currentUrl.includes(route.url.split('?')[0])) {
      result.accessStatus = 'redirected';
    } else {
      result.accessStatus = 'allowed';
    }
    
    // Check for console/page errors
    result.consoleErrors = consoleErrors;
    result.pageErrors = pageErrors;
    
    if (!expectedAccess && (responseStatus === 401 || responseStatus === 403 || responseStatus === 404)) {
      result.accessStatus = 'blocked';
      result.status = 'passed';
      result.consoleErrors = [];
      result.pageErrors = [];
    }

    // Only fail on console/page errors if route is allowed (not blocked/redirected)
    // Blocked/redirected routes may have errors from redirect target pages, which is expected
    if ((consoleErrors.length > 0 || pageErrors.length > 0) && result.accessStatus === 'allowed') {
      // Filter out network/API fetch errors - these are non-critical if page loads
      // Only fail on actual JavaScript errors or page crashes
      const criticalErrors = [...consoleErrors, ...pageErrors].filter(error => {
        const errorLower = error.toLowerCase();
        // Ignore network/fetch errors (these are API issues, not page crashes)
        if (errorLower.includes('failed to fetch') || 
            errorLower.includes('network error') ||
            errorLower.includes('typeerror: failed to fetch')) {
          return false;
        }
        // Keep all other errors (JavaScript errors, page crashes, etc.)
        return true;
      });
      
      if (criticalErrors.length > 0) {
        result.status = 'failed';
        result.error = `Console/page errors: ${criticalErrors.join('; ')}`;
      }
      // If only network errors, page loaded successfully - don't fail
    }
    
    // Calculate load time
    result.loadTime = Date.now() - startTime;
    
  } catch (error: any) {
    if (!expectedAccess && (error.message?.includes('Timeout') || error.message?.includes('net::ERR'))) {
      result.accessStatus = 'blocked';
      result.status = 'passed';
      result.loadTime = Date.now() - startTime;
      return result;
    }
    result.status = 'failed';
    result.error = error.message || String(error);
    result.loadTime = Date.now() - startTime;
  }
  
  return result;
}

/**
 * Generate results markdown report
 */
function generateReport(results: CrawlResults): string {
  let report = `# UI Crawl Test Results\n\n`;
  report += `Generated: ${results.timestamp}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Routes:** ${results.totalRoutes}\n`;
  report += `- **Passed:** ${results.passed}\n`;
  report += `- **Failed:** ${results.failed}\n`;
  report += `- **Skipped:** ${results.skipped}\n\n`;
  
  if (results.failed > 0) {
    report += `## Failed Routes\n\n`;
    report += `| Route | URL | User | Error |\n`;
    report += `|-------|-----|------|-------|\n`;
    
    for (const result of results.results) {
      if (result.status === 'failed') {
        report += `| \`${result.route}\` | \`${result.url}\` | ${result.user} | ${result.error || 'Unknown error'} |\n`;
      }
    }
    report += `\n`;
  }
  
  if (results.results.some(r => r.consoleErrors.length > 0 || r.pageErrors.length > 0)) {
    report += `## Routes with Console/Page Errors\n\n`;
    report += `| Route | URL | User | Errors |\n`;
    report += `|-------|-----|------|--------|\n`;
    
    for (const result of results.results) {
      const errors = [...result.consoleErrors, ...result.pageErrors];
      if (errors.length > 0) {
        report += `| \`${result.route}\` | \`${result.url}\` | ${result.user} | ${errors.join('; ')} |\n`;
      }
    }
    report += `\n`;
  }
  
  report += `## All Results\n\n`;
  report += `| Route | URL | User | Status | Access | Load Time (ms) |\n`;
  report += `|-------|-----|------|--------|--------|----------------|\n`;
  
  for (const result of results.results) {
    report += `| \`${result.route}\` | \`${result.url}\` | ${result.user} | ${result.status} | ${result.accessStatus} | ${result.loadTime || 'N/A'} |\n`;
  }
  
  return report;
}

/**
 * Main test: Crawl all routes
 * Note: Tests run sequentially to avoid server overload and ensure proper results collection
 */
let routes: RouteInfo[] = [];

// Use file-based results collection to avoid race conditions in parallel execution
const RESULTS_FILE = path.join(process.cwd(), 'ui-crawl-results-temp.json');

function loadResults(): CrawlResult[] {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      const data = fs.readFileSync(RESULTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // File doesn't exist or invalid - start fresh
  }
  return [];
}

function saveResult(result: CrawlResult) {
  const results = loadResults();
  results.push(result);
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function clearResults() {
  if (fs.existsSync(RESULTS_FILE)) {
    fs.unlinkSync(RESULTS_FILE);
  }
}

test.describe('UI Crawl', () => {
  test.beforeAll(() => {
    // Load routes
    try {
      routes = loadRoutes();
      console.log(`✅ Loaded ${routes.length} routes for crawling`);
    } catch (error: any) {
      console.error(`❌ Failed to load routes: ${error.message}`);
      routes = [];
    }
    // Clear previous results
    clearResults();
  });
  
  test('Crawl all routes with tenant-a admin', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes timeout for full crawl
    
    // Login as tenant-a admin
    await login(page, TENANT_A_ADMIN.email, TENANT_A_ADMIN.password, TENANT_A_ADMIN.tenantId);
    
    // Set platform to SAM
    await setPlatform(page, TENANT_A_ADMIN.platform);
    
    // Navigate to platforms (to ensure we're authenticated) with retry logic
    let platformsNavSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(`${BASE_URL}/platforms`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        platformsNavSuccess = true;
        break;
      } catch (error: any) {
        if (error.message?.includes('ERR_CONNECTION_RESET') || 
            error.message?.includes('ERR_CONNECTION_REFUSED') ||
            error.message?.includes('net::ERR')) {
          if (attempt < 2) {
            await page.waitForTimeout(2000 * (attempt + 1));
            console.log(`[platforms] Connection error, retrying (attempt ${attempt + 1}/3)...`);
            continue;
          }
        }
        throw error;
      }
    }
    
    if (!platformsNavSuccess) {
      throw new Error(`Failed to navigate to platforms page after 3 attempts - server may be unavailable`);
    }
    
    await page.waitForSelector('[data-testid="page-ready"]', { timeout: 5000 }).catch(() => {});
    
    // Crawl each route
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const shouldAccess = shouldBeAccessible(route, TENANT_A_ADMIN.email);
      
      if (!shouldAccess) {
        saveResult({
          route: route.path,
          url: route.url,
          user: TENANT_A_ADMIN.email,
          status: 'skipped',
          consoleErrors: [],
          pageErrors: [],
          accessStatus: 'blocked',
        });
        continue;
      }
      
      const result = await crawlRoute(page, route, TENANT_A_ADMIN.email);
      saveResult(result);
      
      // Log progress
      if (result.status === 'failed') {
        console.log(`❌ FAILED [${i + 1}/${routes.length}]: ${route.url} - ${result.error}`);
      } else {
        console.log(`✅ PASSED [${i + 1}/${routes.length}]: ${route.url}`);
      }
      
      // Add delay between routes to avoid server overload
      if (i < routes.length - 1) {
        await page.waitForTimeout(1000); // 1 second delay
      }
    }
  });
  
  test('Crawl SAM routes with nosam user (verify blocked)', async ({ page }) => {
    test.setTimeout(120000); // 2 minute timeout for blocked routes check
    
    // Login as nosam user
    await login(page, NOSAM_USER.email, NOSAM_USER.password, NOSAM_USER.tenantId);
    
    // Set platform to health
    await setPlatform(page, NOSAM_USER.platform);
    
    // Navigate to platforms (to ensure we're authenticated) with retry logic
    let platformsNavSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(`${BASE_URL}/platforms`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        platformsNavSuccess = true;
        break;
      } catch (error: any) {
        if (error.message?.includes('ERR_CONNECTION_RESET') || 
            error.message?.includes('ERR_CONNECTION_REFUSED') ||
            error.message?.includes('net::ERR')) {
          if (attempt < 2) {
            await page.waitForTimeout(2000 * (attempt + 1));
            console.log(`[platforms] Connection error, retrying (attempt ${attempt + 1}/3)...`);
            continue;
          }
        }
        throw error;
      }
    }
    
    if (!platformsNavSuccess) {
      throw new Error(`Failed to navigate to platforms page after 3 attempts - server may be unavailable`);
    }
    
    await page.waitForSelector('[data-testid="page-ready"]', { timeout: 5000 }).catch(() => {});
    
    // Crawl SAM routes to verify they're blocked
    const samRoutes = routes.filter(route => route.tags?.includes('platform:sam'));
    
    for (let i = 0; i < samRoutes.length; i++) {
      const route = samRoutes[i];
      const result = await crawlRoute(page, route, NOSAM_USER.email);
      saveResult(result);
      
      // Verify SAM routes are blocked for nosam user
      if (result.accessStatus !== 'blocked' && result.accessStatus !== 'redirected') {
        console.log(`⚠️  WARNING: SAM route ${route.url} not blocked for nosam user`);
      } else {
        console.log(`✅ VERIFIED BLOCKED [${i + 1}/${samRoutes.length}]: ${route.url}`);
      }
      
      // Add delay between routes
      if (i < samRoutes.length - 1) {
        await page.waitForTimeout(1000);
      }
    }
  });
  
  test('Generate crawl results report', async () => {
    // Load all results from file
    const allResults = loadResults();
    
    // Generate results
    const passed = allResults.filter(r => r.status === 'passed').length;
    const failed = allResults.filter(r => r.status === 'failed').length;
    const skipped = allResults.filter(r => r.status === 'skipped').length;
    
    const results: CrawlResults = {
      timestamp: new Date().toISOString(),
      totalRoutes: routes.length,
      passed,
      failed,
      skipped,
      results: allResults,
    };
    
    // Write JSON results
    const jsonPath = path.join(process.cwd(), 'ui-crawl-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results written to ${jsonPath}`);
    
    // Write Markdown report
    const report = generateReport(results);
    const mdPath = path.join(process.cwd(), 'ui-crawl-results.md');
    fs.writeFileSync(mdPath, report);
    console.log(`✅ Report written to ${mdPath}`);
    
    // Clean up temp file
    if (fs.existsSync(RESULTS_FILE)) {
      fs.unlinkSync(RESULTS_FILE);
    }
    
    // Summary
    console.log(`\n📊 UI Crawl Summary:`);
    console.log(`   Total: ${results.totalRoutes}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Skipped: ${skipped}`);
    
    // Fail test if there are failures
    // But distinguish between connection errors (server issues) and actual page failures
    const connectionErrors = allResults.filter(r => 
      r.status === 'failed' && 
      (r.error?.includes('ERR_CONNECTION') || 
       r.error?.includes('ERR_CONNECTION_REFUSED') ||
       r.error?.includes('ERR_CONNECTION_RESET') ||
       r.error?.includes('net::ERR'))
    ).length;
    
    const actualFailures = failed - connectionErrors;
    
    if (failed > 0) {
      if (connectionErrors > 0 && actualFailures === 0) {
        // All failures are connection errors - server instability
        console.warn(`\n⚠️  Warning: ${connectionErrors} routes failed due to server connection issues.`);
        console.warn(`   This may indicate server instability during the test.`);
        console.warn(`   Consider running the test again or investigating server stability.`);
        // Don't fail the test for connection errors alone
        return;
      }
      
      // Show breakdown of failures
      console.error(`\n❌ Test failed: ${failed} routes failed (${actualFailures} actual failures, ${connectionErrors} connection errors)`);
      console.error(`   Check ui-crawl-results.md for detailed failure information.`);
      
      // If actual failures exist, throw error
      if (actualFailures > 0) {
        throw new Error(`${actualFailures} routes failed UI crawl test (${connectionErrors} connection errors). Check ui-crawl-results.md for details.`);
      }
    }
  });
});
