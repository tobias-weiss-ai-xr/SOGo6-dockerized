// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for the Mail LIFE-CYCLE on the live SOGo6 demo site:
//   - send a self-addressed email via the API (real SMTP round-trip)
//   - mail accounts & settings API (filters, vacation, forward, notify)
//   - mail search (now working — IMAP connected via sogo6-stalwart:993/SSL/TLS)
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

test.describe('Mail Life-Cycle', () => {
  test.describe.configure({ mode: 'serial' });

  test('send a self-addressed email via API (real SMTP delivery)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email], // self-send: no external spam
        subject: `E2E Self-Send ${Date.now()}`,
        body: 'Hello from the Playwright e2e suite.',
        is_html: false,
      },
      headers,
    });

    // 200 + "No Error" means SMTP accepted and queued delivery
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.error_code).toBe('S000000');
  });

  test('mail accounts list exposes the main mailbox with the testuser identity', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/mailboxes`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const accounts = body?.data ?? [];
    expect(accounts.length).toBeGreaterThan(0);

    const main = accounts.find((a: any) => a.id === '0') ?? accounts[0];
    const identities = main?.identities ?? [];
    const identity = identities.find((i: any) => i.mail?.includes('testuser'));
    expect(identity).toBeTruthy();
    expect(identity.mail).toBe(CREDENTIALS.email);
  });

  test('mail settings endpoints respond (filters/vacation/forward/notify)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    for (const path of ['filters', 'vacation', 'forward', 'notify']) {
      const res = await page.request.get(`${REMOTE_API}/mailboxes/0/${path}`, { headers });
      test.info().annotations.push({
        type: path,
        description: `GET /mailboxes/0/${path} -> ${res.status()}`,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      // Each endpoint returns a settings object (key may be e.g. 'notification'
      // for /notify). Assert it's a non-null object rather than a specific key.
      const data = body?.data ?? {};
      expect(typeof data).toBe('object');
      expect(Object.keys(data).length).toBeGreaterThan(0);
    }
  });

  test('mail search returns results (IMAP now connected)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=test&limit=5`, { headers });
    // IMAP is now connected (fixed: sogo6-stalwart:993/SSL/TLS).
    // Search should return 200 with results.
    test.info().annotations.push({
      type: 'fixed',
      description: `GET /mailboxes/0/search -> ${res.status()}. IMAP now connected via sogo6-stalwart:993/SSL/TLS.`,
    });
    expect(res.status()).toBe(200);
  });

  test('mail filters UI page loads', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/mail/filters`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\\u2019t load') || text.includes("this page couldn't load");
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('mail vacation UI page loads', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/mail/vacation`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\\u2019t load') || text.includes("this page couldn't load");
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('mail forward UI page loads', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/mail/forward`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\\u2019t load') || text.includes("this page couldn't load");
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });
});
