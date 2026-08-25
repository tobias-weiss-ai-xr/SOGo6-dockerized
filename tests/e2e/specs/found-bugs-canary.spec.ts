// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// FOUND-BUGS CANARY — documents known OPEN bugs discovered by this e2e suite.
// Each test expects the CURRENT (buggy) behaviour and therefore PASSES today.
// If the bug is FIXED, the test FAILS and alerts us to update/remove the entry.
// This turns discovered defects into regression canaries.
//
// Inventory (verified): mail filter auto-replies not wired (404), export/download 404,
// PATCH /preferences 404 (profile not seeded), snooze POST 400, filters/validate 400,
// auth self-service endpoints 500/412 even with valid auth.
//
// Runs against https://sogo6.contextual-intelligence.org
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
};

async function doLogin(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 25000 });
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return await page.evaluate(() => {
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) { try { const p = JSON.parse(raw); if (p.token) return p.token; } catch { /* ignore */ } }
    return null;
  });
}

let TOKEN: string | null = null;
test.beforeAll(async ({ browser }) => {
  const page = await (browser as import('@playwright/test').Browser).newPage();
  TOKEN = await doLogin(page);
  await page.close();
}, 60000);

const auth = () => ({ Authorization: `Bearer ${TOKEN}` });

test.describe('Found-bugs canary — documented open defects', () => {

  test('BUG-01: mail filter auto-replies (vacation/forward/notify) are not wired -> expected 404', async ({ request }) => {
    for (const f of ['vacation', 'forward', 'notify']) {
      const res = await request.get(`${REMOTE_API}/mailboxes/0/filters/${f}`, { headers: auth() });
      test.info().annotations.push({ type: 'filter', description: `/mailboxes/0/filters/${f} -> ${res.status()}` });
      expect(res.status()).toBe(404); // S000637 — flip when wired
    }
  });

  test('BUG-02: mail export & download are not implemented -> expected 404', async ({ request }) => {
    const exp = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/export`, { headers: auth() });
    test.info().annotations.push({ type: 'export', description: `export -> ${exp.status()}` });
    expect(exp.status()).toBe(404);
    const dl = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/14/download`, { headers: auth() });
    test.info().annotations.push({ type: 'download', description: `download -> ${dl.status()}` });
    expect(dl.status()).toBe(404);
  });

  test('BUG-03: PATCH /preferences -> expected 404 (profile record not seeded)', async ({ request }) => {
    const res = await request.patch(`${REMOTE_API}/preferences`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { settings: { SOGO_U_LANGUAGE: 'de' } },
    });
    test.info().annotations.push({ type: 'prefs', description: `PATCH /preferences -> ${res.status()}` });
    expect(res.status()).toBe(404);
  });

  test('BUG-04: POST /snooze -> expected 400 (schema requires account_id/folder_name/mail_uid)', async ({ request }) => {
    const res = await request.post(`${REMOTE_API}/snooze/`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { snooze_until: '2030-01-01T00:00:00Z' },
    });
    test.info().annotations.push({ type: 'snooze', description: `POST /snooze -> ${res.status()}` });
    expect(res.status()).toBe(400);
  });

  test('BUG-06: auth self-service endpoints return 500/412 even with valid auth -> canary', async ({ request }) => {
    const webauthnCreds = await request.get(`${REMOTE_API}/auth/webauthn/credentials`, { headers: auth() });
    test.info().annotations.push({ type: 'auth', description: `webauthn/credentials -> ${webauthnCreds.status()}` });
    expect([500, 412, 404]).toContain(webauthnCreds.status());
    const samlMeta = await request.get(`${REMOTE_API}/auth/saml2/metadata`, { headers: auth() });
    test.info().annotations.push({ type: 'auth', description: `saml2/metadata -> ${samlMeta.status()}` });
    expect([500, 412, 404]).toContain(samlMeta.status());
  });
});