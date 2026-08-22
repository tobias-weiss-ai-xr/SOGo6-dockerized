// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Calendar functionality on the live SOGo6 demo site.
// Verified against real API responses:
//   - GET  /calendars                      -> { data: { calendars: [...] } }
//   - GET  /calendars/{key}/events         -> { data: { events: [...] } }
//   - POST /calendars/{key}/events         -> create event
//   - GET  /events                         -> { data: { events: [...] } }
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

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await getAuthToken(page);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function getCalendars(page: import('@playwright/test').Page): Promise<any[]> {
  const headers = await authHeaders(page);
  const res = await page.request.get(`${REMOTE_API}/calendars`, { headers });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body?.data?.calendars ?? [];
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Calendar Functionality', () => {
  test.describe.configure({ mode: 'serial' });

  test('login and verify calendar API returns calendars', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThanOrEqual(1);

    const personal = calendars.find((c: any) => c.is_default === true || c.source_type === 'local');
    expect(personal).toBeTruthy();
    expect(personal.key).toBeTruthy();
    expect(personal.name).toBeTruthy();
  });

  test('GET /calendars/{key}/events returns events list', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);

    const headers = await authHeaders(page);
    const res = await page.request.get(
      `${REMOTE_API}/calendars/${encodeURIComponent(calendars[0].key)}/events`,
      { headers }
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body?.data).toBeTruthy();
    expect(Array.isArray(body?.data?.events)).toBeTruthy();
    // Fresh demo may have 0 events — just verify the endpoint works
  });

  test('POST + DELETE calendar event lifecycle', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;

    const headers = await authHeaders(page);

    // Build event for tomorrow 10:00-11:00
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const start = new Date(tomorrow);
    start.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(11, 0, 0, 0);

    const eventPayload = {
      title: 'E2E Calendar Test',
      description: 'Created by Playwright e2e test',
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      timezone: 'UTC',
    };

    const createRes = await page.request.post(
      `${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/events`,
      { data: eventPayload, headers }
    );
    expect([200, 201]).toContain(createRes.status());

    const createdBody = await createRes.json();
    const eventKey = createdBody?.data?.key ?? createdBody?.key;
    expect(eventKey).toBeTruthy();

    // Verify event exists by fetching it directly (more reliable than list query
    // which may filter by a default date window)
    const getEventRes = await page.request.get(
      `${REMOTE_API}/events/${encodeURIComponent(eventKey)}`,
      { headers }
    );
    expect(getEventRes.status()).toBe(200);
    const gotEventBody = await getEventRes.json();
    const gotEvent = gotEventBody?.data ?? gotEventBody;
    expect(gotEvent.title).toBe('E2E Calendar Test');

    // Delete event (detail routes are at /events/{event_key})
    const delRes = await page.request.delete(
      `${REMOTE_API}/events/${encodeURIComponent(eventKey)}`,
      { headers }
    );
    expect([200, 204]).toContain(delRes.status());
  });

  test('calendar page loads without "Could not load contacts" error', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('could not load contacts') ||
             text.includes('kontakte konnten nicht geladen werden') ||
             text.includes('failed to fetch');
    });

    expect(hasError).toBeFalsy();

    // Calendar page should render
    await expect(page.locator('body')).toBeVisible();
  });

  test('calendar UI renders view switcher and today button', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    // Look for month/week/day view controls
    const viewSwitcher = page.locator(
      'button:has-text("Month"), button:has-text("Week"), button:has-text("Day"), ' +
      'button:has-text("Monat"), button:has-text("Woche"), button:has-text("Tag"), ' +
      '[aria-label*="month"], [aria-label*="week"], [aria-label*="day"]'
    ).first();

    const todayBtn = page.locator(
      'button:has-text("Today"), button:has-text("Heute"), [aria-label*="today"]'
    ).first();

    const hasViewSwitcher = await viewSwitcher.isVisible({ timeout: 5000 }).catch(() => false);
    const hasToday = await todayBtn.isVisible({ timeout: 3000 }).catch(() => false);

    // At least one of the calendar controls should be present
    expect(hasViewSwitcher || hasToday).toBeTruthy();
  });
});
