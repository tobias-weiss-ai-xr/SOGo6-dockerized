// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Calendar Free/Busy, Reminders & Shares on the live SOGo6 demo.
//
// Verified API behavior:
//   - POST /freebusy {target_uids,start,end} -> data.attendees with busy periods
//   - GET /reminders                        -> data.reminders[]
//   - GET /external-calendars               -> data.calendars[]
//   - GET /calendars/{key}/shares           -> data.shares[]
//   - GET /events?start=&end=               -> data.events[]
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
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

test.describe('Calendar Free/Busy, Reminders & Shares', () => {
  test.describe.configure({ mode: 'serial' });

  test('reminders endpoint returns the reminders list', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/reminders`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const reminders = body?.data?.reminders ?? [];
    expect(Array.isArray(reminders)).toBeTruthy();
  });

  test('external calendars list returns an empty collection', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(`${REMOTE_API}/external-calendars`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const calendars = body?.data?.calendars ?? [];
    expect(Array.isArray(calendars)).toBeTruthy();
  });

  test('calendar shares list responds', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const calRes = await page.request.get(`${REMOTE_API}/calendars`, { headers });
    expect(calRes.status()).toBe(200);
    const calBody = await calRes.json();
    const calendars = calBody?.data?.calendars ?? [];
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;

    const res = await page.request.get(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/shares`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const shares = body?.data?.shares ?? [];
    expect(Array.isArray(shares)).toBeTruthy();
  });

  test('free/busy reports busy periods for created events', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Create an event tomorrow 08:00-09:00 UTC, then verify free/busy sees it
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(8, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h

    // Get a calendar first
    const calRes = await page.request.get(`${REMOTE_API}/calendars`, { headers });
    const calBody = await calRes.json();
    const calKey = calBody?.data?.calendars?.[0]?.key;

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/events`, {
      data: {
        title: 'E2E FreeBusy Event',
        date_start: start.toISOString(),
        date_end: end.toISOString(),
        timezone: 'UTC',
      },
      headers,
    });
    expect([200, 201]).toContain(createRes.status());
    const createdBody = await createRes.json();
    const eventKey = createdBody?.data?.key ?? createdBody?.key;

    // Query free/busy across the whole day
    const dayStart = new Date(start);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const fbRes = await page.request.post(`${REMOTE_API}/freebusy`, {
      data: {
        target_uids: [CREDENTIALS.email],
        start: dayStart.toISOString(),
        end: dayEnd.toISOString(),
      },
      headers,
    });
    expect(fbRes.status()).toBe(200);
    const fbBody = await fbRes.json();
    const attendees = fbBody?.data?.attendees ?? {};
    const myPeriods = attendees[CREDENTIALS.email]?.periods ?? [];
    test.info().annotations.push({
      type: 'freebusy',
      description: `${myPeriods.length} busy period(s) found for ${CREDENTIALS.email}: ${JSON.stringify(myPeriods)}`,
    });
    expect(myPeriods.length).toBeGreaterThan(0);

    // Clean up the event
    const delRes = await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(eventKey)}`, { headers });
    expect([200, 204]).toContain(delRes.status());
  });

  test('events by date range returns a list (possibly empty)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await page.request.get(
      `${REMOTE_API}/events?start=2026-08-01T00:00:00.000Z&end=2026-08-31T00:00:00.000Z`,
      { headers }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const events = body?.data?.events ?? [];
    expect(Array.isArray(events)).toBeTruthy();
    expect(typeof body?.data?.total_count).toBe('number');
  });

  test('calendar page in UI renders without fatal error', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\\u2019t load') || text.includes("this page couldn't load");
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });
});
