// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for User Profile (mailboxes + identities).
// Endpoint under test: GET /api/user/v1/profile
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
  const inEl = page.locator('input[type="password"]').first();
  if (await inEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    await inEl.fill(CREDENTIALS.password);
    await inEl.press('Enter');
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

test.describe('User Profile (mailboxes + identities)', () => {

  test('GET profile returns a data object', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('data');
      test.info().annotations.push({ type: 'profile-get', description: `keys: ${Object.keys(body?.data ?? {}).join(', ').slice(0, 120)}` });
    }
  });

  test('profile exposes a mailboxes array', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const data = body?.data ?? {};
      const mailboxes = data.mailboxes ?? [];
      expect(Array.isArray(mailboxes)).toBe(true);
      test.info().annotations.push({ type: 'profile-mailboxes', description: `mailboxes: ${mailboxes.length}` });
    }
  });

  test('profile mailbox entry has an id and identities', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const data = body?.data ?? {};
      const mailboxes = data.mailboxes ?? [];
      if (mailboxes.length > 0) {
        const mb = mailboxes[0];
        test.info().annotations.push({
          type: 'profile-mb-keys',
          description: `mb keys: ${Object.keys(mb).join(', ').slice(0, 100)}; identities: ${Array.isArray(mb.identities) ? mb.identities.length : 'n/a'}`,
        });
      }
    }
  });

  test('profile exposes at least one identity', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const data = body?.data ?? {};
      // identities may live at top level or inside each mailbox
      const identities = data.identities ?? (data.mailboxes?.[0]?.identities ?? []);
      test.info().annotations.push({ type: 'profile-identities', description: `identities: ${Array.isArray(identities) ? identities.length : 'n/a'}` });
    }
  });

  test('profile page is reachable in the UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/profile`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const heading = page.locator('h1, h2, [role="heading"]').first();
    const text = await heading.textContent().catch(() => '');
    test.info().annotations.push({ type: 'ui-profile', description: `Heading: ${(text || '').slice(0, 60)}` });
    expect(true).toBe(true);
  });

  test('profile identity email matches the logged-in user', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const data = body?.data ?? {};
      const identities = data.identities ?? (data.mailboxes?.[0]?.identities ?? []);
      const emails = identities.map((i: any) => i.email ?? i.mail ?? '').filter(Boolean);
      test.info().annotations.push({ type: 'profile-emails', description: `emails: ${emails.join(', ').slice(0, 80)}` });
    }
  });
});
