// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Calendar event CRUD against the LOCAL stack via the REST API:
//   POST   /api/user/v1/calendars/<key>/events   (create)
//   GET    /api/user/v1/events/<event_key>        (read)
//   PATCH  /api/user/v1/events/<event_key>        (update)
//   DELETE /api/user/v1/events/<event_key>        (delete)
// plus the tasks list endpoint. All created data uses a unique title/uid and
// is cleaned up in afterAll (best effort) so repeated runs leave no residue.
//
//   npx playwright test local-calendar-crud.spec.ts

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };
const UNIQ = Date.now();

let token = '';
let calendarKey = '';
let eventKey = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/user/v1/auth/login`, {
    data: { username: USER.email, password: USER.password },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();

  const auth = { Authorization: `Bearer ${token}` };
  const calendars = await request.get(`${API}/api/user/v1/calendars`, { headers: auth });
  calendarKey = (await calendars.json()).data.calendars[0].key;
});

const auth = () => ({ Authorization: `Bearer ${token}` });

test.describe('local calendar/task CRUD @local', () => {
  test('calendars exposes a default calendar', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/calendars`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.calendars)).toBe(true);
    const def = body.data.calendars.find((c: any) => c.is_default === true);
    expect(def).toBeTruthy();
  });

  test('event create returns a retrievable event', async ({ request }) => {
    const res = await request.post(`${API}/api/user/v1/calendars/${calendarKey}/events`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: {
        title: `E2E Standup ${UNIQ}`,
        date_start: '2026-09-10T09:00:00.000Z',
        date_end: '2026-09-10T09:30:00.000Z',
        description: 'created by local-calendar-crud.spec.ts',
      },
    });
    expect(res.status()).toBe(201);
    const created = (await res.json()).data;
    eventKey = created.key;
    expect(eventKey).toBeTruthy();

    const got = await request.get(`${API}/api/user/v1/events/${eventKey}`, { headers: auth() });
    expect(got.status()).toBe(200);
    const data = (await got.json()).data;
    expect(data.title).toBe(`E2E Standup ${UNIQ}`);
    expect(data.date_start).toBe('2026-09-10T09:00:00.000Z');
  });

  test('event can be patched', async ({ request }) => {
    expect(eventKey).toBeTruthy();
    const res = await request.patch(`${API}/api/user/v1/events/${eventKey}`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { title: `E2E Standup ${UNIQ} UPDATED` },
    });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.title).toBe(`E2E Standup ${UNIQ} UPDATED`);
  });

  test('event can be deleted (GET afterwards is 404)', async ({ request }) => {
    expect(eventKey).toBeTruthy();
    const del = await request.delete(`${API}/api/user/v1/events/${eventKey}`, { headers: auth() });
    expect(del.status()).toBe(200);
    const after = await request.get(`${API}/api/user/v1/events/${eventKey}`, { headers: auth() });
    expect(after.status()).toBe(404);
    eventKey = '';
  });

  test('tasks list is served (empty on a fresh account is valid)', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/tasks`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.tasks)).toBe(true);
    expect(typeof body.data.total_count).toBe('number');
  });
});

test.afterAll(async ({ request }) => {
  if (eventKey) {
    await request.delete(`${API}/api/user/v1/events/${eventKey}`, { headers: auth() }).catch(() => {});
  }
});
