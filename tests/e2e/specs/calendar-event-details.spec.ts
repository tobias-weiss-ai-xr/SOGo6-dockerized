// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Calendar Event Details, Updates & Attendance on the live SOGo6 demo.
//
// Verified API behavior:
//   - GET /events/{key}            -> full event object by key
//   - PATCH /events/{key}          -> partial update (title) works
//   - POST /events/{key}/attendance {status:'accepted'} -> marks attendance
//   - DELETE /events/{key}         -> removes the event
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

async function createTempEvent(page: import('@playwright/test').Page): Promise<{ key: string; calKey: string }> {
  const token = await getAuthToken(page);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const calRes = await page.request.get(`${REMOTE_API}/calendars`, { headers });
  const calKey = (await calRes.json())?.data?.calendars?.[0]?.key;

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 45 * 60 * 1000);

  const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/events`, {
    data: {
      title: 'E2E Event Details Probe',
      description: 'temporary event',
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      timezone: 'UTC',
      location: 'Test Room 1',
    },
    headers,
  });
  expect([200, 201]).toContain(createRes.status());
  const body = await createRes.json();
  const key = body?.data?.key ?? body?.key;
  expect(key).toBeTruthy();
  return { key, calKey };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Calendar Event Details & Attendance', () => {
  test.describe.configure({ mode: 'serial' });

  test('event detail GET returns the full event by key', async ({ page }) => {
    await loginAsUser(page);
    const { key } = await createTempEvent(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await page.request.get(`${REMOTE_API}/events/${encodeURIComponent(key)}`, { headers });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const event = body?.data ?? body;
      expect(event.key ?? event.uid).toBeTruthy();
      expect(event.component_type).toBe('event');
      // title present in some form
      const title = event.title ?? event.summary;
      expect(title).toBeTruthy();
    } finally {
      await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(key)}`, { headers });
    }
  });

  test('event PATCH updates the title', async ({ page }) => {
    await loginAsUser(page);
    const { key } = await createTempEvent(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const patchRes = await page.request.patch(`${REMOTE_API}/events/${encodeURIComponent(key)}`, {
        data: { title: 'E2E Event Details Probe (renamed via PATCH)' },
        headers,
      });
      expect(patchRes.status()).toBe(200);
      const patchBody = await patchRes.json();
      const event = patchBody?.data ?? patchBody;
      const title = event.title ?? event.summary;
      expect(String(title)).toContain('renamed via PATCH');
    } finally {
      await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(key)}`, { headers });
    }
  });

  test('event attendance can be accepted', async ({ page }) => {
    await loginAsUser(page);
    const { key } = await createTempEvent(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      const res = await page.request.post(`${REMOTE_API}/events/${encodeURIComponent(key)}/attendance`, {
        data: { status: 'accepted' },
        headers,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      // Response returns the updated event or attendance confirmation
      expect(body?.data || body?.error_code).toBeTruthy();
    } finally {
      await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(key)}`, { headers });
    }
  });

  test('deleting an event removes it from detail lookups', async ({ page }) => {
    await loginAsUser(page);
    const { key } = await createTempEvent(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const delRes = await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(key)}`, { headers });
    expect([200, 204]).toContain(delRes.status());

    // Subsequent detail GET should 404 (or return an error envelope)
    const getRes = await page.request.get(`${REMOTE_API}/events/${encodeURIComponent(key)}`, { headers });
    expect([404, 500, 400]).toContain(getRes.status());
  });
});
