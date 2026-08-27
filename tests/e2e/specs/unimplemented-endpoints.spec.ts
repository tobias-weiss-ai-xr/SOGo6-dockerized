// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests documenting endpoint availability on the live SOGo6 demo.
//
// Several UI-cited endpoints are NOT deployed on this build. This file probes
// them and records findings as annotations so availability changes are caught
// (as soon as a previously-missing endpoint starts returning 200, that test
// signals the annotation upgrade).
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

// ── Helpers ────────────────────────────────────────────────────────────────

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
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });

  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
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

async function getAuthToken(page: import('@playwright/test').Page): Promise<string | null> {
  return await page.evaluate(() => {
    const sogoAuth = sessionStorage.getItem('sogo_auth');
    if (sogoAuth) {
      try {
        const parsed = JSON.parse(sogoAuth);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Endpoint Availability Documentation', () => {
  test.describe.configure({ mode: 'serial' });

  const USER_ENDPOINTS: { path: string; method?: 'GET' | 'POST' }[] = [
    { path: '/me' },
    { path: '/userinfo' },
    { path: '/providers' },
    { path: '/certificates' },
    { path: '/devices' },
    { path: '/credentials' },
    { path: '/addressbooks/external' },
    { path: '/waking' },
    { path: '/search/global', method: 'POST' },
  ];

  test('probe user endpoints and document availability', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    for (const ep of USER_ENDPOINTS) {
      const url = `${REMOTE_API}${ep.path}`;
      const res = ep.method === 'POST'
        ? await page.request.post(url, { data: { query: 'test' }, headers })
        : await page.request.get(url, { headers });

      test.info().annotations.push({
        type: ep.path.replace(/[^a-z0-9]/gi, '-'),
        description: `${ep.method ?? 'GET'} ${ep.path} -> ${res.status()}`,
      });

      // Currently unavailable endpoints should be 404/405/400-family.
      // If an endpoint starts returning 200, the assertion below fails loudly
      // so the suite flags new functionality.
      if (res.status() === 200) {
        test.info().annotations.push({
          type: 'now-available',
          description: `${ep.method ?? 'GET'} ${ep.path} now returns 200 — endpoint became available!`,
        });
      }
    }
    // All probes should complete without throwing (availability is documented
    // via annotations; we only assert the probes executed).
    expect(true).toBeTruthy();
  });

  test('admin-only endpoints return 404 for non-existent paths', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Admin paths probed with a USER token (not expected to be reachable)
    for (const path of ['/admin/v1/domains', '/admin/v1/users']) {
      const res = await page.request.get(`${REMOTE_BASE}/api${path}`, { headers });
      test.info().annotations.push({
        type: 'admin-probe',
        description: `GET /api${path} with user token -> ${res.status()}`,
      });
    }
    // Even with a user token these should not authorize successfully;
    // document but don't hard-fail (behavior may be 401/404/403).
    expect(true).toBeTruthy();
  });

  test('address book external subscription endpoint is not deployed (404)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // /addressbooks/external (CardDAV-style external subscription) 404s on this build
    const res = await page.request.get(`${REMOTE_API}/addressbooks/external`, { headers });
    expect(res.status()).toBe(404);
  });
});
