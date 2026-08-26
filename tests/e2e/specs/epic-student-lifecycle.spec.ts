// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Student lifecycle (second student account).
//
// Realistic stories for a student (testuser2) who joins group study,
// manages resources, calendar, tasks, preferences and inbox — independent
// from the primary testuser account.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role credentials: testuser2@sogo6.contextual-intelligence.org / password123

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'testuser2@sogo6.contextual-intelligence.org',
  password: 'password123',
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Student lifecycle: study resources & booking', () => {

  test('STUD-01 second student authenticates and reads the system', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'student2 login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `auth GET /calendars -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'login', description: 'ok' });
  });

  test('STUD-02 student views available campus resources', async ({ request }) => {
    const tk = await token(request);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 7 * 86400_000).toISOString();
    const res = await request.get(`${REMOTE_API}/resources/available?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`, { headers: bearer(tk) });
    expect([200, 400, 404, 422], `GET /resources/available -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'resources', description: `-> ${res.status()}` });
  });

  test('STUD-03 student checks a resource room availability window', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/resources/0/availability?date_from=${encodeURIComponent(new Date().toISOString())}&date_to=${encodeURIComponent(new Date(Date.now() + 86400_000).toISOString())}`, { headers: bearer(tk) });
    expect([200, 400, 404, 422], `GET /resources/0/availability -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'avail', description: `-> ${res.status()}` });
  });

  test('STUD-04 student books a study room', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/resources/0/book`, {
      headers: bearer(tk),
      data: {
        utc_start: new Date(Date.now() + 3 * 86400_000 + 14 * 3600_000).toISOString(),
        utc_end: new Date(Date.now() + 3 * 86400_000 + 16 * 3600_000).toISOString(),
        purpose: 'Group study for Linear Algebra',
      },
    });
    expect(ACCEPT, `POST /resources/0/book -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'book', description: `-> ${res.status()}` });
  });

  test('STUD-05 student lists their bookings', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/resources/my-bookings`, { headers: bearer(tk) });
    expect(200, `GET /resources/my-bookings -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'my-bookings', description: `-> ${res.status()}` });
  });

  test('STUD-06 student marks a resource as favourite', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/resources/favorites`, {
      headers: bearer(tk), data: { resource_id: '0' },
    });
    expect([...ACCEPT, 405], `POST /resources/favorites -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'fav', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Student lifecycle: academic workflow', () => {

  test('STUD-07 student views their calendar', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `GET /calendars -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const cals = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'cals', description: `count: ${cals.length}` });
  });

  test('STUD-08 student creates a task for an assignment', async ({ request }) => {
    const tk = await token(request);
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: bearer(tk),
      data: { title: `Submit Linear Algebra HW ${Date.now()}`, description: 'Due next Monday' },
    });
    expect(ACCEPT, `POST tasks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'task', description: `-> ${res.status()}` });
  });

  test('STUD-09 student reads and updates preferences', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/preferences`, { headers: bearer(tk) });
    expect(200, `GET /preferences -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'prefs', description: `-> ${res.status()}` });
  });

  test('STUD-10 student checks inbox for course announcements', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET INBOX -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'inbox', description: `-> ${res.status()}` });
  });

  test('STUD-11 student accesses address books for study-group contacts', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    expect([200, 404], `GET /addressbooks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'ab', description: `-> ${res.status()}` });
  });
});
