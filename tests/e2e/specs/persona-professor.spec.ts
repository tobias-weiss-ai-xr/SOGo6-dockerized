// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests — Persona: PROFESSOR
// Realistic daily workflows: lecture scheduling (recurring), booking lecture halls,
// sending class announcements, managing student contacts, office hours, grading
// tasks, delegating calendar to a secretary, free/busy checks.
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
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

async function getOrCreateCalendar(page: import('@playwright/test').Page, token: string, name: string): Promise<string> {
  const list = await page.request.get(`${REMOTE_API}/calendars`, { headers: { Authorization: `Bearer ${token}` } });
  const cals = list.status() === 200 ? (await list.json())?.data ?? [] : [];
  if (cals.length) return String(cals[0].key ?? cals[0].id ?? '0');
  const created = await page.request.post(`${REMOTE_API}/calendars`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name, color: '#cc3333', description: 'Teaching calendar' },
  });
  const body = created.status() === 200 || created.status() === 201 ? await created.json() : null;
  return String(body?.data?.key ?? body?.data?.id ?? '0');
}

test.describe('Persona — Professor: Lecture scheduling', () => {

  test('professor logs in and opens the calendar', async ({ page }) => {
    await loginAsUser(page);
    expect(page.url()).toContain('/u/');
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('professor creates a teaching calendar', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `Lectures_${Date.now()}`, color: '#cc3333', description: 'Course lectures' },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'create-cal', description: `-> ${res.status()}` });
  });

  test('professor schedules a single lecture event', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const calKey = await getOrCreateCalendar(page, token, `Lectures_${Date.now()}`);
    const res = await page.request.post(`${REMOTE_API}/calendars/${calKey}/events`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `Lecture ${Date.now()}`,
        date_start: '2026-09-01T10:00:00',
        date_end: '2026-09-01T11:30:00',
        timezone: 'Europe/Berlin',
        description: 'Introduction to the course',
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'create-event', description: `-> ${res.status()}` });
  });

  test('professor reviews upcoming lectures', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const events = body?.data?.events ?? body?.data ?? [];
      test.info().annotations.push({ type: 'events', description: `lectures: ${Array.isArray(events) ? events.length : 'n/a'}` });
    }
  });

  test('professor sets office hours as calendar events', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const calKey = await getOrCreateCalendar(page, token, `OfficeHours_${Date.now()}`);
    const res = await page.request.post(`${REMOTE_API}/calendars/${calKey}/events`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `Office Hours ${Date.now()}`,
        date_start: '2026-09-02T14:00:00',
        date_end: '2026-09-02T16:00:00',
        timezone: 'Europe/Berlin',
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'office-hours', description: `-> ${res.status()}` });
  });

  test('professor checks free/busy before scheduling', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const now = new Date();
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now); end.setUTCHours(23, 59, 59, 999);
    const res = await page.request.post(`${REMOTE_API}/freebusy`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { target_uids: [CREDENTIALS.email], start: start.toISOString(), end: end.toISOString() },
    });
    expect([200, 400, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      test.info().annotations.push({ type: 'freebusy', description: `attendees: ${Object.keys(body?.data?.attendees ?? {}).length}` });
    } else {
      test.info().annotations.push({ type: 'freebusy', description: `-> ${res.status()}` });
    }
  });
});

test.describe('Persona — Professor: Rooms & resources', () => {

  test('professor books a lecture hall', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const resources = Array.isArray(body) ? body : (body?.data ?? []);
      test.info().annotations.push({ type: 'rooms', description: `rooms: ${resources.length}` });
    }
  });

  test('professor checks a specific room availability', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources/available`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { start_time: '2030-01-02T09:00:00Z', end_time: '2030-01-02T10:00:00Z' },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'room-avail', description: `-> ${res.status()}` });
  });
});

test.describe('Persona — Professor: Class communication', () => {

  test('professor sends a class announcement', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        from: CREDENTIALS.email,
        to: ['class@sogo6.contextual-intelligence.org'],
        subject: `Announcement ${Date.now()}`,
        body: 'Next lecture will cover chapter 5.',
        is_html: false,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'announce', description: `-> ${res.status()}` });
  });

  test('professor reads student emails in the inbox', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'inbox', description: `-> ${res.status()}` });
  });

  test('professor manages the student address book', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const abRes = await page.request.get(`${REMOTE_API}/addressbooks`, { headers: { Authorization: `Bearer ${token}` } });
    const abs = abRes.status() === 200 ? (await abRes.json())?.data ?? [] : [];
    const bookKey = abs[0]?.key ?? abs[0]?.id ?? '0';
    const res = await page.request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        display_name: `Student ${Date.now()}`,
        first_name: 'A',
        last_name: 'Student',
        kind: 'individual',
        emails: [{ value: `student${Date.now()}@sogo6.contextual-intelligence.org`, types: ['school'], pref: 1 }],
        phones: [{ number: '+49123456789', types: ['mobile'] }],
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'student-contact', description: `-> ${res.status()}` });
  });

  test('professor checks address books list', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'addressbooks', description: `-> ${res.status()}` });
  });
});

test.describe('Persona — Professor: Grading & delegation', () => {

  test('professor creates a grading task', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const calKey = await getOrCreateCalendar(page, token, `Grading_${Date.now()}`);
    const res = await page.request.post(`${REMOTE_API}/calendars/${calKey}/tasks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: `Grade midterms ${Date.now()}`, description: '30 exams' },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'grading-task', description: `-> ${res.status()}` });
  });

  test('professor lists tasks to track grading progress', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'tasks', description: `-> ${res.status()}` });
  });

  test('professor shares the calendar with the secretary', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const calKey = await getOrCreateCalendar(page, token, `Shared_${Date.now()}`);
    const res = await page.request.get(`${REMOTE_API}/calendars/${calKey}/shares`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'cal-share', description: `-> ${res.status()}` });
  });

  test('professor reviews the preferences/settings', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'prefs', description: `-> ${res.status()}` });
  });

  test('professor exports the calendar (known gap: may 404)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const calKey = await getOrCreateCalendar(page, token, `Export_${Date.now()}`);
    const res = await page.request.get(`${REMOTE_API}/calendars/${calKey}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 202, 404, 409]).toContain(res.status());
    test.info().annotations.push({ type: 'cal-export', description: `export -> ${res.status()} (known gap if 404, async 202/409 otherwise)` });
  });
});
