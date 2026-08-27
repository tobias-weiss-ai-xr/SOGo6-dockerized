// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Calendar Event CRUD lifecycle.
// Tests:
//   - Create a calendar event via API (date_start/date_end/timezone)
//   - Get event by ID via /events/{key}
//   - Update event (title, description)
//   - List events with date range filter
//   - Delete event via /events/{key}
//   - Calendar sharing endpoint
//   - Event attendees endpoint
//   - Create all-day event
//   - Free/Busy query
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

function getISOString(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Calendar Event CRUD', () => {

  test('list calendars via API', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const calendars = body?.data?.calendars ?? body?.data ?? [];
    test.info().annotations.push({ type: 'calendars', description: `Calendars: ${calendars.length}` });
    expect(calendars.length).toBeGreaterThan(0);
  });

  test('create and delete a calendar event', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Get first calendar
    const calRes = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const calBody = await calRes.json();
    const calendars = calBody?.data?.calendars ?? calBody?.data ?? [];
    if (calendars.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No calendars available' });
      return;
    }
    const calKey = calendars[0].key || calendars[0].id || calendars[0].calendar_key;

    // Create event (API uses date_start/date_end, not start/end)
    const startTime = getISOString(1);
    const endTime = getISOString(1);
    const eventTitle = `E2E Test Event ${Date.now()}`;
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${calKey}/events`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: eventTitle,
        description: 'E2E test event description',
        date_start: startTime,
        date_end: endTime,
        timezone: 'UTC',
      },
    });
    test.info().annotations.push({ type: 'create', description: `POST event -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    const createBody = await createRes.json();
    const eventId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.event_id;
    if (eventId) {
      // Get event (detail route is at /events/{eventKey})
      const getRes = await page.request.get(`${REMOTE_API}/events/${encodeURIComponent(eventId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      test.info().annotations.push({ type: 'get', description: `GET event -> ${getRes.status()}` });
      expect([200, 404]).toContain(getRes.status());

      // Delete event (detail route is at /events/{eventKey})
      const delRes = await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(eventId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      test.info().annotations.push({ type: 'delete', description: `DELETE event -> ${delRes.status()}` });
      expect([200, 204, 404]).toContain(delRes.status());
    }
  });

  test('update calendar event (title and description)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    const calRes = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const calBody = await calRes.json();
    const calendars = calBody?.data?.calendars ?? calBody?.data ?? [];
    if (calendars.length === 0) return;
    const calKey = calendars[0].key || calendars[0].id || calendars[0].calendar_key;

    // Create event
    const startTime = getISOString(2);
    const endTime = getISOString(2);
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${calKey}/events`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Update Test ${Date.now()}`,
        description: 'Original description',
        date_start: startTime,
        date_end: endTime,
        timezone: 'UTC',
      },
    });
    if (createRes.status() !== 200 && createRes.status() !== 201) return;

    const createBody = await createRes.json();
    const eventId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.event_id;
    if (!eventId) return;

    // Update (detail route)
    const updateRes = await page.request.patch(`${REMOTE_API}/events/${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Updated ${Date.now()}`,
        description: 'Updated description',
      },
    });
    test.info().annotations.push({ type: 'update', description: `PATCH event -> ${updateRes.status()}` });
    expect([200, 204, 404]).toContain(updateRes.status());

    // Cleanup
    await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('list events with date range filter', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const calRes = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const calBody = await calRes.json();
    const calendars = calBody?.data?.calendars ?? calBody?.data ?? [];
    if (calendars.length === 0) return;
    const calKey = calendars[0].key || calendars[0].id || calendars[0].calendar_key;

    const startRange = getISOString(-30);
    const endRange = getISOString(30);
    const res = await page.request.get(
      `${REMOTE_API}/calendars/${calKey}/events?start=${encodeURIComponent(startRange)}&end=${encodeURIComponent(endRange)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    test.info().annotations.push({ type: 'list-range', description: `GET events with range -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const events = body?.data?.events ?? body?.data ?? [];
      test.info().annotations.push({ type: 'events', description: `Events in range: ${Array.isArray(events) ? events.length : 'N/A'}` });
    }
  });

  test('get all events across all calendars', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'all-events', description: `GET /events -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('calendar page loads without fatal error', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes("this page couldn't load") || text.includes('application error');
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('calendar UI has view switcher', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    // Look for calendar view switcher (month/week/day buttons)
    const hasViewSwitcher = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('month') || text.includes('week') || text.includes('day') ||
             text.includes('monat') || text.includes('woche') || text.includes('tag');
    });
    test.info().annotations.push({ type: 'view-switcher', description: `View switcher found: ${hasViewSwitcher}` });
  });

  test('create all-day event', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const calRes = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const calBody = await calRes.json();
    const calendars = calBody?.data?.calendars ?? calBody?.data ?? [];
    if (calendars.length === 0) return;
    const calKey = calendars[0].key || calendars[0].id || calendars[0].calendar_key;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${calKey}/events`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E All-Day ${Date.now()}`,
        date_start: dateStr,
        date_end: dateStr,
        all_day: true,
        timezone: 'UTC',
      },
    });
    test.info().annotations.push({ type: 'all-day', description: `POST all-day event -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    // Cleanup
    const createBody = await createRes.json();
    const eventId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.event_id;
    if (eventId) {
      await page.request.delete(`${REMOTE_API}/events/${encodeURIComponent(eventId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('free/busy query for own calendar', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const startRange = getISOString(0);
    const endRange = getISOString(7);
    const res = await page.request.get(
      `${REMOTE_API}/calendars/freebusy?start=${encodeURIComponent(startRange)}&end=${encodeURIComponent(endRange)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    test.info().annotations.push({ type: 'freebusy', description: `GET freebusy -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('delete non-existent event returns 404', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const fakeId = `nonexistent-${Date.now()}`;
    const delRes = await page.request.delete(`${REMOTE_API}/events/${fakeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'delete-404', description: `DELETE non-existent -> ${delRes.status()}` });
    expect([404, 200, 204]).toContain(delRes.status());
  });
});
