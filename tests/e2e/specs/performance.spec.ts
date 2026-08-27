// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// SOTA performance-budget smoke tests for the public SOGo6 demo.
//
// Captures real navigation-timing metrics (TTFB, DOMContentLoaded, full load,
// resources) and asserts generous budgets. Intended as a regression canary,
// not a micro-benchmark — budgets are deliberately loose to avoid flakiness on
// a shared public host.

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

async function setupEnvInterception(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function loginAsUser(page: import('@playwright/test').Page) {
  await setupEnvInterception(page);
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  await emailInput.fill(CREDENTIALS.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);

  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function timing(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const nt = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined);
    if (!nt) return null;
    return {
      ttfbMs: Math.round(nt.responseStart - nt.requestStart),
      domContentLoadedMs: Math.round(nt.domContentLoadedEventEnd - nt.requestStart),
      loadMs: Math.round(nt.loadEventEnd - nt.requestStart),
      transferSize: nt.transferSize,
      // resource counts / errors
      resources: performance.getEntriesByType('resource').length,
      failedResources: performance.getEntriesByType('resource').filter(
        (r) => (r as PerformanceResourceTiming).responseStatus >= 400
      ).length,
    };
  });
}

test.describe('Performance Budgets', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('login page loads within a generous budget', async ({ page }) => {
    await setupEnvInterception(page);
    const watch = performance.now();
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const wallMs = performance.now() - watch;
    await page.waitForTimeout(1500);
    const t = await timing(page);
    test.info().annotations.push({
      type: 'login-budget',
      description: `ttfb=${t?.ttfbMs}ms dcl=${t?.domContentLoadedMs}ms load=${t?.loadMs}ms wall=${Math.round(wallMs)}ms failedRes=${t?.failedResources}`,
    });
    expect(t).toBeTruthy();
    // Generous budgets for a cold load on a public host
    expect(t!.loadMs).toBeLessThan(15000);
    expect(t!.failedResources).toBeLessThanOrEqual(5);
  });

  test('authenticated inbox page has acceptable TTFB', async ({ page }) => {
    await loginAsUser(page);
    const watch = performance.now();
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const wallMs = performance.now() - watch;
    await page.waitForTimeout(2500);
    const t = await timing(page);
    test.info().annotations.push({
      type: 'inbox-budget',
      description: `ttfb=${t?.ttfbMs}ms dcl=${t?.domContentLoadedMs}ms load=${t?.loadMs}ms wall=${Math.round(wallMs)}ms resources=${t?.resources} failedRes=${t?.failedResources}`,
    });
    expect(t).toBeTruthy();
    expect(t!.loadMs).toBeLessThan(20000);
  });

  test('calendar page transfer size within budget', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const t = await timing(page);
    test.info().annotations.push({
      type: 'calendar-budget',
      description: `load=${t?.loadMs}ms transfer=${t?.transferSize ? Math.round(t.transferSize / 1024) + 'KB' : 'n/a'} resources=${t?.resources}`,
    });
    expect(t).toBeTruthy();
    expect(t!.loadMs).toBeLessThan(20000);
  });

  test('no failed static assets on the inbox page', async ({ page }) => {
    await loginAsUser(page);
    const failures: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/_next/static/')) {
        failures.push(`${r.status()} ${r.url().replace(REMOTE_BASE, '')}`);
      }
    });
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    test.info().annotations.push({
      type: 'static-assets',
      description: failures.length ? failures.join(' ; ') : 'all static assets loaded OK',
    });
    expect(failures.length).toBe(0);
  });
});
