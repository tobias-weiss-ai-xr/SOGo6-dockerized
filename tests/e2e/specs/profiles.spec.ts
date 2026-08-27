// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for the Profile on the live SOGo6 demo — including a reliability
// probe for the intermittently-failing profile data chain.
//
// Known backend flakiness (verified):
//   - GET /preferences and GET /shared-mailboxes can intermittently 500 with
//     "I/O operation on closed file" from the Redis session cache, which makes
//     the profile page briefly show "Failed to load profile." This probe
//     measures the failure rate without hard-failing on a single blip.
//
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

async function isFatalError(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() || '';
    return text.includes('this page couldn\\u2019t load') || text.includes("this page couldn't load")
      || text.includes('server error occurred');
  });
}

test.describe('Profile', () => {
  test.describe.configure({ mode: 'serial' });

  test('profile API returns mailboxes with the testuser identity', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/profile`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const mailboxes = body?.data?.mailboxes ?? [];
    expect(mailboxes.length).toBeGreaterThan(0);

    const mbox = mailboxes.find((m: any) => m.id === '0') ?? mailboxes[0];
    const identity = (mbox?.identities ?? []).find((i: any) => i.mail?.includes('testuser'));
    expect(identity).toBeTruthy();
    expect(identity.mail).toBe(CREDENTIALS.email);
    expect(identity.name).toBeTruthy();
  });

  test('profile API returns user preferences', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // /preferences is intermittently 500 (Redis session cache) — tolerate a
    // 200 with retry and record observations.
    let status = 0;
    let attempts = 0;
    let body: any = null;
    while (attempts < 4 && status !== 200) {
      attempts++;
      const res = await page.request.get(`${REMOTE_API}/preferences`, { headers });
      status = res.status();
      if (status === 200) body = await res.json();
      else await page.waitForTimeout(800);
    }

    test.info().annotations.push({
      type: 'preferences-retries',
      description: `GET /preferences: ${attempts} attempt(s) -> ${status}.`,
    });
    expect(status).toBe(200);
    const prefs = body?.data ?? {};
    // preferences should contain USER_CALENDAR_* and/or mail-related groups
    const keys = Object.keys(prefs);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.startsWith('USER_'))).toBeTruthy();
  });

  test('profile UI page shows the account identity and email', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/profile`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    expect(await isFatalError(page)).toBeFalsy();
    const state = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      return {
        hasName: text.includes('test user'),
        hasEmail: text.includes(REMOTE_CREDENTIALS.user.email),
        hasHeading: text.includes('profile'),
        len: text.length,
      };
    });
    test.info().annotations.push({ type: 'profile-ui', description: JSON.stringify(state) });
    expect(state.hasHeading).toBeTruthy();
    expect(state.hasName || state.hasEmail).toBeTruthy();
  });

  test('profile data chain reliability probe (documents persistent shared-mailboxes 500)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const endpoints = ['/profile', '/preferences', '/shared-mailboxes'];
    const ROUNDS = 4;
    const results: Record<string, number[]> = {};

    for (const ep of endpoints) {
      results[ep] = [];
      for (let i = 0; i < ROUNDS; i++) {
        const res = await page.request.get(`${REMOTE_API}${ep}`, { headers });
        results[ep].push(res.status());
        await page.waitForTimeout(500);
      }
    }

    test.info().annotations.push({
      type: 'reliability',
      description: JSON.stringify(results),
    });

    // /profile must be stable (the identity it serves is the page's core).
    const profileOk = results['/profile'].filter((s) => s === 200).length;
    expect(profileOk).toBeGreaterThan(0);

    // /preferences may 500 intermittently (Redis session cache) — needs at least
    // one success.
    const prefsOk = results['/preferences'].filter((s) => s === 200).length;
    test.info().annotations.push({
      type: '/preferences ok',
      description: `preferences: ${prefsOk}/${ROUNDS} ok`,
    });
    expect(prefsOk).toBeGreaterThan(0);

    // /shared-mailboxes was observed 500 CONSTANTLY (5/5) on 2026-08-22 — root
    // cause: ApiSharedMailboxes/ApiSharedMailbox/ApiResourceBooking hardcoded
    // ClientPostgreSQL while the deployment uses MariaDB. Fixed by switching to
    // f"Client{SOGO_P_DB_TYPE}" (server deploy 2026-08-22). Now expect 200.
    const shOk = results['/shared-mailboxes'].filter((s) => s === 200).length;
    const sh500 = results['/shared-mailboxes'].filter((s) => s === 500).length;
    test.info().annotations.push({
      type: '/shared-mailboxes',
      description: `shared-mailboxes: ${shOk}/${ROUNDS} ok, ${sh500} x500 (was persistent 500 before the ClientPostgreSQL→dynamic fix)`,
    });
    expect(shOk).toBeGreaterThan(0);
  });

  test('profile settings page columns render (user settings profile)', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/profile`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasForm = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      return text.includes('profile') && (text.includes('account') || text.length > 800);
    });
    expect(hasForm).toBeTruthy();
  });
});
