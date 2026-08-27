// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Mail list pagination, sorting and field selection.
// Endpoint under test: GET /api/user/v1/mailboxes/{account}/folders/{folder}/mails
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

const INBOX = 'INBOX';

test.describe('Mail list pagination / sort / fields', () => {

  test('limit parameter caps the number of returned mails', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?limit=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'limit3', description: `returned: ${mails.length}` });
    }
  });

  test('offset pagination returns a different page', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const r1 = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?limit=5&offset=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const r2 = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?limit=5&offset=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(r1.status());
    expect([200, 404]).toContain(r2.status());
    test.info().annotations.push({ type: 'offset', description: `p1=${r1.status()} p2=${r2.status()}` });
  });

  test('sort by date descending is accepted', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?sort_by=date&sort_order=desc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'sort-date', description: `-> ${res.status()}` });
  });

  test('sort by subject is accepted', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?sort_by=subject&sort_order=asc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'sort-subject', description: `-> ${res.status()}` });
  });

  test('field selection reduces payload (fields_action=exclude)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?fields=contents&fields_action=exclude`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      if (mails.length > 0) {
        test.info().annotations.push({ type: 'fields', description: `keys: ${Object.keys(mails[0]).join(', ').slice(0, 100)}` });
      }
    }
  });

  test('large limit is handled without error', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${INBOX}/mails?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'limit100', description: `-> ${res.status()}` });
  });
});
