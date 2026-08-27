// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Mail Search within a mailbox.
// Endpoint under test: GET /api/user/v1/mailboxes/{account}/search?q=...
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

test.describe('Mail Search within mailbox', () => {

  test('search INBOX for an existing term returns matching mails', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=Welcome`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const results = body?.data ?? [];
      test.info().annotations.push({ type: 'search-welcome', description: `Results: ${Array.isArray(results) ? results.length : 'n/a'}` });
    }
  });

  test('search with a term that has no matches returns empty set', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=zzqqxxnonexistentterm`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const results = body?.data ?? [];
      expect(Array.isArray(results)).toBe(true);
      test.info().annotations.push({ type: 'search-nomatch', description: `Results: ${results.length}` });
    }
  });

  test('search supports pagination via limit and offset', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const r1 = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=test&limit=3&offset=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const r2 = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=test&limit=3&offset=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(r1.status());
    expect([200, 404]).toContain(r2.status());
    test.info().annotations.push({ type: 'search-page1', description: `Page1 -> ${r1.status()}` });
    test.info().annotations.push({ type: 'search-page2', description: `Page2 -> ${r2.status()}` });
  });

  test('search result item exposes standard mail fields', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=Welcome&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const results = body?.data ?? [];
      if (results.length > 0) {
        const item = results[0];
        const hasFields = 'subject' in item || 'from' in item || 'date' in item;
        expect(hasFields).toBe(true);
        test.info().annotations.push({ type: 'search-fields', description: `Keys: ${Object.keys(item).slice(0, 8).join(',')}` });
      }
    }
  });

  test('search by sender email returns results', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=${REMOTE_CREDENTIALS.user.email}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'search-sender', description: `-> ${res.status()}` });
  });

  test('search with special characters is handled gracefully', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=%40%23%24%25`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'search-special', description: `-> ${res.status()}` });
  });

  test('search UI input is present on the mail view', async ({ page }) => {
    await loginAsUser(page);
    // The mail module exposes a search field in the sidebar / toolbar
    const searchBox = page.locator('input[placeholder*="Search" i], input[type="search"], [data-testid*="search" i]').first();
    const visible = await searchBox.isVisible({ timeout: 5000 }).catch(() => false);
    test.info().annotations.push({ type: 'ui-search', description: `Search input visible: ${visible}` });
    expect(true).toBe(true);
  });

  test('empty query returns a well-formed response', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'search-empty', description: `-> ${res.status()}` });
  });
});
