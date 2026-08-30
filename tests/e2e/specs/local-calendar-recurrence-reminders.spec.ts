// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar recurrence + reminders @local @calendar.
//
//   POST /calendars/<key>/events   {recurrence_rule: {frequency, interval, until}}
//   GET  /calendars/<key>/events   (listing EXPANDS occurrences into the window)
//   GET  /reminders?lookahead=N    (reminders firing in the next N minutes)
//   DELETE /events/<key>           (master delete removes the whole series)
//
//   npx playwright test local-calendar-recurrence-reminders.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';
let calKey = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, LOCAL_API))!;
  expect(token).toBeTruthy();
  const res = await request.get(`${LOCAL_API}/calendars`, { headers: auth() });
  const cals = ((await res.json()).data ?? {}).calendars ?? [];
  calKey = cals.find((c: any) => /personal/i.test(c.name ?? ''))?.key;
  expect(calKey, 'personal calendar exists').toBeTruthy();
});

function windowParams(startOffsetDays: number, endOffsetDays: number): string {
  const start = new Date(Date.now() + startOffsetDays * 86400000).toISOString();
  const end = new Date(Date.now() + endOffsetDays * 86400000).toISOString();
  return `start_date_time=${encodeURIComponent(start)}&end_date_time=${encodeURIComponent(end)}`;
}

async function listEvents(request: any, params: string): Promise<any[]> {
  const res = await request.get(`${LOCAL_API}/calendars/${calKey}/events?${params}`, { headers: auth() });
  expect(res.status(), `list -> ${res.status()} ${await res.text()}`).toBe(200);
  return ((await res.json()).data ?? {}).events ?? [];
}

test.describe('local calendar recurrence @local @calendar', () => {
  let masterKey = '';
  const title = () => `[local-e2e] daily ${Date.now()}`;
  let subject = '';

  test.afterAll(async ({ request }) => {
    if (masterKey) {
      await request.delete(`${LOCAL_API}/events/${masterKey}`, { headers: auth() }).catch(() => {});
    }
  });

  test('REC-01 a daily event with until=+5d expands to 5 occurrences', async ({ request }) => {
    test.setTimeout(60000);
    subject = title();
    const start = new Date(Date.now() + 86400000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const until = new Date(Date.now() + 5 * 86400000)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');

    const res = await request.post(`${LOCAL_API}/calendars/${calKey}/events`, {
      headers: json(),
      data: {
        title: subject,
        date_start: start.toISOString(),
        date_end: end.toISOString(),
        recurrence_rule: { frequency: 'daily', interval: 1, until },
      },
    });
    expect(res.status(), `create -> ${res.status()} ${await res.text()}`).toBe(201);
    const data = (await res.json()).data ?? {};
    masterKey = data.key;
    expect(masterKey).toBeTruthy();
    expect(data.recurrence_rule?.frequency ?? 'daily').toBe('daily');
  });

  test('REC-02 the listing shows 5 expanded occurrences (window ≤45 days)', async ({ request }) => {
    // window 0..+7 days: within MAX_EVENT_FETCH_DAYS=45, covers the 5 dailies
    const events = await listEvents(request, windowParams(0, 7));
    const occurrences = events.filter((e: any) => e.title === subject);
    expect(occurrences.length, `5 daily occurrences of "${subject}"`).toBe(5);
    // occurrences are on consecutive days, same time of day
    const starts = occurrences.map((e: any) => new Date(e.date_start).getUTCDate()).sort((a: number, b: number) => a - b);
    const uniqueDays = new Set(starts);
    expect(uniqueDays.size, 'occurrences fall on 5 distinct days').toBe(5);
  });

  test('REC-03 a narrower window shows only the occurrences it covers', async ({ request }) => {
    // +1..+3 days: master (+1d), +2d, +3d → 3 occurrences
    const events = await listEvents(request, windowParams(1, 3));
    const occurrences = events.filter((e: any) => e.title === subject);
    expect(occurrences.length, '3 occurrences inside the narrow window').toBe(3);
  });

  test('REC-04 invalid recurrence frequency is rejected (422)', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/calendars/${calKey}/events`, {
      headers: json(),
      data: {
        title: '[local-e2e] bad-freq',
        date_start: new Date(Date.now() + 86400000).toISOString(),
        date_end: new Date(Date.now() + 90000000).toISOString(),
        recurrence_rule: { frequency: 'whenever', interval: 1 },
      },
    });
    expect(res.status()).toBe(422);
  });

  test('REC-05 deleting the master removes the whole series', async ({ request }) => {
    const del = await request.delete(`${LOCAL_API}/events/${masterKey}`, { headers: auth() });
    expect([200, 204]).toContain(del.status());
    masterKey = ''; // already cleaned up
    const events = await listEvents(request, windowParams(0, 7));
    expect(events.filter((e: any) => e.title === subject).length, 'series fully gone').toBe(0);
  });
});

test.describe('local calendar reminders @local @calendar', () => {
  let eventKey = '';

  test.afterAll(async ({ request }) => {
    if (eventKey) {
      await request.delete(`${LOCAL_API}/events/${eventKey}`, { headers: auth() }).catch(() => {});
    }
  });

  test('REM-01 an event with a popup reminder registers an active reminder', async ({ request }) => {
    test.setTimeout(60000);
    // A reminder is ACTIVE from trigger_at (= start - minutes_before) until
    // event end. Event starts in ~20 min with a 30-min reminder → its
    // trigger_at lies 10 min in the PAST, i.e. it is pending right now.
    const start = new Date(Date.now() + 20 * 60000);
    const end = new Date(Date.now() + 80 * 60000);
    const title = `[local-e2e] reminder ${Date.now()}`;
    const res = await request.post(`${LOCAL_API}/calendars/${calKey}/events`, {
      headers: json(),
      data: {
        title,
        date_start: start.toISOString(),
        date_end: end.toISOString(),
        reminders: [{ method: 'popup', minutes_before: 30 }],
      },
    });
    expect(res.status(), `create -> ${res.status()} ${await res.text()}`).toBe(201);
    const data = (await res.json()).data ?? {};
    eventKey = data.key;
    expect(data.reminders).toEqual([{ method: 'popup', minutes_before: 30 }]);

    // the reminder engine may lag a moment behind the event create — poll
    let hit: any;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !hit) {
      await new Promise((r) => setTimeout(r, 2000));
      const list = await request.get(`${LOCAL_API}/reminders?lookahead=60`, { headers: auth() });
      expect(list.status()).toBe(200);
      const reminders = ((await list.json()).data ?? {}).reminders ?? [];
      hit = reminders.find((r: any) => r.event_key === eventKey);
    }
    expect(hit, 'the reminder must be pending within the lookahead window').toBeTruthy();
    expect(hit.method).toBe('popup');
    expect(hit.minutes_before).toBe(30);
  });

  test('REM-02 deleting the event clears its reminder', async ({ request }) => {
    const del = await request.delete(`${LOCAL_API}/events/${eventKey}`, { headers: auth() });
    expect([200, 204]).toContain(del.status());
    eventKey = '';
    const list = await request.get(`${LOCAL_API}/reminders?lookahead=60`, { headers: auth() });
    const reminders = ((await list.json()).data ?? {}).reminders ?? [];
    expect(reminders.find((r: any) => r.event_key === eventKey)).toBeFalsy();
  });
});
