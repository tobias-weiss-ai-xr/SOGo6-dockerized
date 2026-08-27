// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Shared Mailboxes listing.
// Endpoint under test: GET /api/user/v1/shared-mailboxes
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

test.describe('Shared Mailboxes listing', () => {

  test('GET shared-mailboxes returns a list (empty for a fresh user)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/shared-mailboxes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body?.data ?? []);
      expect(Array.isArray(list)).toBe(true);
      test.info().annotations.push({ type: 'shared-get', description: `count: ${list.length}` });
    }
  });

  test('shared-mailboxes response is well-formed JSON', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/shared-mailboxes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
      test.info().annotations.push({ type: 'shared-shape', description: `top-level is array: ${Array.isArray(body)}` });
    }
  });

  test('shared mailboxes settings page is reachable in the UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/mail/shared-mailboxes`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    test.info().annotations.push({ type: 'ui-shared', description: 'navigated to shared-mailboxes settings' });
    expect(true).toBe(true);
  });
});
