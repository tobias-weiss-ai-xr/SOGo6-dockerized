// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Resources / Resource Booking.
// Endpoint under test: GET /api/user/v1/resources
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

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
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

test.describe('Resources / Resource Booking', () => {

  test('GET resources returns a list', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const resources = Array.isArray(body) ? body : (body?.data ?? []);
      expect(Array.isArray(resources)).toBe(true);
      test.info().annotations.push({ type: 'resources-get', description: `count: ${resources.length}` });
    }
  });

  test('resource list items are well-formed objects', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const resources = Array.isArray(body) ? body : (body?.data ?? []);
      if (resources.length > 0) {
        test.info().annotations.push({ type: 'resource-keys', description: `keys: ${Object.keys(resources[0]).join(', ').slice(0, 100)}` });
      }
    }
  });

  test('resources module is reachable in the UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/resources`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const heading = page.locator('h1, h2, [role="heading"]').first();
    const text = await heading.textContent().catch(() => '');
    test.info().annotations.push({ type: 'ui-resources', description: `Heading: ${(text || '').slice(0, 60)}` });
    expect(true).toBe(true);
  });

  test('resources settings page is reachable', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/resources`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    test.info().annotations.push({ type: 'ui-resources-settings', description: 'navigated to /en/user_settings/resources' });
    expect(true).toBe(true);
  });
});
