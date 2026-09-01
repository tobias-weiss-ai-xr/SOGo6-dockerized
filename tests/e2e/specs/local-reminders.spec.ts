// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Active reminders (@local): GET /reminders lists event alarms whose
// trigger_at (= date_start - minutes_before) has passed and whose event has
// not ended (plus lookahead). Filters: method (popup|email), lookahead (0-60).

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const CAL_KEY = '6abddb60-547b-41b0-8a3e-56e4309a5550'; // testuser personal calendar
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let token = '';
let eventKey = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

function isoIn(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

async function createEvent(request: any, title: string, startInMin: number, reminders: any[]): Promise<string> {
  const res = await request.post(`${USER_API}/calendars/${CAL_KEY}/events`, {
    headers: json(),
    data: {
      title,
      date_start: isoIn(startInMin),
      date_end: isoIn(startInMin + 30),
      reminders,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data.key;
}

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  token = (await login.json()).data.jwt_token;
});

test.afterAll(async ({ request }) => {
  if (eventKey) {
    await request.delete(`${USER_API}/events/${eventKey}`, { headers: auth() });
  }
});

test.describe('local reminders @local @reminders', () => {
  test('RM-01 a due popup reminder is listed with trigger_at', async ({ request }) => {
    // event starts in 2 min, reminder fires 5 min before start -> already due
    eventKey = await createEvent(request, `[local-e2e] due ${STAMP}`, 2, [
      { method: 'popup', minutes_before: 5 },
    ]);
    const res = await request.get(`${USER_API}/reminders`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    const mine = data.reminders.find((r: any) => r.event_key === eventKey);
    expect(mine, 'due reminder must be listed').toBeTruthy();
    expect(mine.method).toBe('popup');
    expect(mine.minutes_before).toBe(5);
    expect(mine.trigger_at).toBeTruthy(); // date_start - 5min, in the past
    expect(mine.title).toContain(STAMP);
    expect(mine.dates_with_tz.date_start_tz_event).toBeTruthy();
  });

  test('RM-02 the method filter narrows the list', async ({ request }) => {
    const res = await request.get(`${USER_API}/reminders?method=email`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.reminders.every((r: any) => r.method === 'email')).toBe(true);
    expect(data.reminders.find((r: any) => r.event_key === eventKey)).toBeFalsy();
  });

  test('RM-03 an unknown method is a 422 trap', async ({ request }) => {
    const res = await request.get(`${USER_API}/reminders?method=carrier-pigeon`, { headers: auth() });
    expect(res.status()).toBe(422);
  });

  test('RM-04 a future reminder is not yet active', async ({ request }) => {
    // event starts in 30 min, reminder 5 min before -> fires in 25 min: inactive
    const futureKey = await createEvent(request, `[local-e2e] future ${STAMP}`, 30, [
      { method: 'popup', minutes_before: 5 },
    ]);
    const res = await request.get(`${USER_API}/reminders`, { headers: auth() });
    const data = (await res.json()).data;
    expect(data.reminders.find((r: any) => r.event_key === futureKey)).toBeFalsy();
    await request.delete(`${USER_API}/events/${futureKey}`, { headers: auth() });
  });

  test('RM-05 lookahead is bounded (61 -> 422)', async ({ request }) => {
    const res = await request.get(`${USER_API}/reminders?lookahead=61`, { headers: auth() });
    expect(res.status()).toBe(422);
  });

  test('RM-06 deleting the event removes the reminder', async ({ request }) => {
    const del = await request.delete(`${USER_API}/events/${eventKey}`, { headers: auth() });
    expect(del.status()).toBe(200);
    eventKey = '';
    const res = await request.get(`${USER_API}/reminders`, { headers: auth() });
    const data = (await res.json()).data;
    expect(data.reminders.find((r: any) => r.title.includes(STAMP))).toBeFalsy();
  });
});
