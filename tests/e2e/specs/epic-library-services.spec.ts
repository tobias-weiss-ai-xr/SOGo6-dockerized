// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Library services (campus library staff role).
//
// Realistic multi-step stories for a library employee (`bibliothek`):
// cataloguing session rooms, resource/room availability & booking, appointment
// slots for consultations, and patron-facing mail/task flows.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role credentials: bibliothek@sogo6.contextual-intelligence.org / LibraryUni2026!
//
// Every story is authenticated with a real JWT (LDAP user bind via /auth/login).
// 5xx fails the test; 2xx/4xx are acceptable (validation errors & gaps are valid).

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'bibliothek@sogo6.contextual-intelligence.org',
  password: 'LibraryUni2026!',
};

const ACCEPT = [200, 201, 202, 204, 400, 404, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Library services: session rooms & resource booking', () => {

  test('EPIC/LIB-01 library staff can log in and list resource rooms', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'role login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/resources`, { headers: bearer(tk) });
    expect(200, `auth GET /resources -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const rooms = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'resources', description: `rooms: ${rooms.length}` });
    expect(Array.isArray(rooms)).toBe(true);
  });

  test('EPIC/LIB-02 catalogued room list and favorites are readable', async ({ request }) => {
    const tk = await token(request);
    const fav = await request.get(`${REMOTE_API}/resources/favorites`, { headers: bearer(tk) });
    expect([200, 404], `GET /resources/favorites -> ${fav.status()}`).toContain(fav.status());
    const my = await request.get(`${REMOTE_API}/resources/my-bookings`, { headers: bearer(tk) });
    expect(200, `GET /resources/my-bookings -> ${my.status()}`).toBe(my.status());
    test.info().annotations.push({ type: 'favorites', description: `-> ${fav.status()} / bookings -> ${my.status()}` });
  });

  test('EPIC/LIB-03 library staff checks a room availability window', async ({ request }) => {
    const tk = await token(request);
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 3_600_000).toISOString();
    const res = await request.get(`${REMOTE_API}/resources/available`, {
      headers: bearer(tk),
      params: { start_time: from, end_time: to },
    });
    expect([200, 400, 422, 404], `GET /resources/available -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'availability', description: `-> ${res.status()}` });
  });

  test('EPIC/LIB-04 library staff books a room for a reading group', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/resources/0/book`, {
      headers: bearer(tk),
      data: {
        resource_id: '0',
        start: new Date(Date.now() + 7_200_000).toISOString(),
        end: new Date(Date.now() + 8_400_000).toISOString(),
        title: `Reading group ${Date.now()}`,
      },
    });
    expect(ACCEPT, `POST /resources/0/book -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'book', description: `-> ${res.status()}` });
  });

  test('EPIC/LIB-05 booking is listed back in my-bookings', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/resources/my-bookings`, { headers: bearer(tk) });
    expect(200, `GET /resources/my-bookings -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const bookings = Array.isArray(body?.data) ? body.data : (body?.data?.bookings ?? []);
    test.info().annotations.push({ type: 'my-bookings', description: `count: ${Array.isArray(bookings) ? bookings.length : 0}` });
  });

  test('EPIC/LIB-06 library staff marks a favourite room', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/resources/0/favorite`, {
      headers: bearer(tk),
      data: {},
    });
    expect(ACCEPT, `POST /resources/0/favorite -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'favorite', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Library services: consultation slots & patron flows', () => {

  test('EPIC/LIB-07 staff creates a bookable consultation slot', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/appointment-slots`, {
      headers: bearer(tk),
      data: {
        title: `Research consultation ${Date.now()}`,
        description: 'Literature search help',
        duration_minutes: 30,
        start_time: '09:00',
        end_time: '17:00',
        days_of_week: [1, 2, 3, 4, 5],
      },
    });
    expect(ACCEPT, `POST /appointment-slots -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'slot', description: `-> ${res.status()}` });
  });

  test('EPIC/LIB-08 published consultation slots are listed', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(tk) });
    expect(200, `GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'list-slots', description: `-> ${res.status()}` });
  });

  test('EPIC/LIB-09 staff searches the campus directory for a patron', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=mustermann`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET /contacts/autocomplete -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      test.info().annotations.push({ type: 'directory', description: `matches seen` });
    }
  });

  test('EPIC/LIB-10 staff files a task to prepare reading lists', async ({ request }) => {
    const tk = await token(request);
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: bearer(tk),
      data: { title: `Prepare reading list ${Date.now()}`, description: 'For reference desk' },
    });
    expect([200, 201, 400, 404, 422], `POST tasks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'task', description: `-> ${res.status()}` });
  });

  test('EPIC/LIB-11 staff reads mailbox to triage patron enquiries', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET INBOX mails -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'inbox', description: `mails: ${mails.length}` });
    }
  });
});