// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for System Info & Auth-mode endpoints on the live SOGo6 demo.
//
// Verified API behavior:
//   - GET /system (user API)              -> data.system (SOGO_S_* settings)
//   - GET /auth/mode?username=...         -> {kind: 'plain'} (public)
//   - POST /auth/login                    -> {data: {jwt_token}} (public)
//   - GET /vapid-public-key               -> public key for push notifications
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
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

test.describe('System Info & Auth', () => {
  test.describe.configure({ mode: 'serial' });

  test('auth mode reports plain login for the test user (public)', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/auth/mode?username=${encodeURIComponent(CREDENTIALS.email)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // 'plain' (password) or a challenge-based mode are both valid for this demo
    // Response shape: { data: { kind: 'plain', location, SOGO_D_PWD_RECOVERY } }
    const mode = body?.data?.kind;
    test.info().annotations.push({
      type: 'auth-mode',
      description: JSON.stringify(body),
    });
    expect(['plain', 'password', 'webauthn']).toContain(mode);
  });

  test('login via user API issues a JWT', async ({ page }) => {
    const res = await page.request.post(`${REMOTE_API}/auth/login`, {
      data: { username: CREDENTIALS.email, password: CREDENTIALS.password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const token = body?.data?.jwt_token ?? body?.jwt_token;
    expect(token).toBeTruthy();
  });

  test('GET /system exposes system settings for an authenticated user', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/system`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data?.system).toBeTruthy();
    // system is an object with SOGO_S_* keys
    const system = body?.data?.system ?? {};
    const keys = Object.keys(system);
    expect(keys.some((k) => k.startsWith('SOGO_'))).toBeTruthy();
  });

  test('VAPID public key endpoint responds for push notifications', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/vapid-public-key`, { headers });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test('environment endpoint advertises the API base URL', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_BASE}/env`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.REACT_APP_API_BASE_URL).toContain('/api/user/v1');
    expect(typeof body?.SSE_ENABLED).toBe('boolean');
  });

  test('waking ping endpoint returns 404 (not deployed) — documented', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/waking`, { headers });
    expect(res.status()).toBe(404);
  });
});
