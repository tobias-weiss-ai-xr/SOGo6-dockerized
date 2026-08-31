// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar RECURRENCE-ID exceptions @local @calendar.
//
//   POST   /api/user/v1/calendars/<key>/events      create recurring series
//   GET    /api/user/v1/calendars/<key>/events?start_date_time&end_date_time
//         expands occurrences (each keeps the master key + per-occurrence
//         recurrence_id). NOTE: params are start_date_time/end_date_time in
//         YYYY-MM-DDTHH:MM:SS.mmmZ form — an ISO +00:00 offset is a 422.
//   PATCH  /api/user/v1/events/<master_key> {"recurrence_id": ..., ...}
//         splits a DETACHED occurrence (new key, recurrence_id set).
//   DELETE /api/user/v1/events/<master_key>?recurrence_id=...
//         deletes ONE occurrence (EXDATE); without the param the whole
//         series is deleted.
//
// Regression context (2026-08-31, round 11):
//   - Bug #19 (data loss): DELETE with ?recurrence_id= silently ignored the
//     param and soft-deleted the ENTIRE series (master + detached exceptions)
//     with a 200. The route now scopes the delete via EXDATE.
//   - Malformed recurrence_id -> 422 (query schema); recurrence_id on a
//     NON-recurring event -> 404 S000605 (no occurrence to scope to).
//
//   npx playwright test local-calendar-occurrences.spec.ts

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const CT = { 'Content-Type': 'application/json' };

let token = '';
const auth = () => ({ Authorization: `Bearer ${token}`, ...CT });

let calKey = '';

const START = '2026-10-05T09:00:00Z';   // Monday
const END = '2026-10-05T10:00:00Z';
const WINDOW = {
  from: '2026-10-04T00:00:00.000Z',
  to: '2026-10-12T00:00:00.000Z',
};

test.describe('local calendar occurrence exceptions @local @calendar', () => {
  let masterKey = '';

  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${LOCAL_API}/auth/login`, {
      headers: CT, data: { username: 'testuser@example.org', password: 'password123' },
    });
    token = ((await login.json()).data ?? {}).jwt_token ?? '';
    expect(token).toBeTruthy();

    const cals = await request.get(`${LOCAL_API}/calendars`, { headers: auth() });
    const own = ((await cals.json()).data.calendars ?? []).find((c: any) => c.is_default);
    expect(own).toBeTruthy();
    calKey = own.key;

    // unique daily series Mon..Fri 2026-10-05..09
    const res = await request.post(`${LOCAL_API}/calendars/${calKey}/events`, {
      headers: auth(),
      data: {
        title: `[local-e2e] occurrences ${Date.now().toString(36)}`,
        date_start: START,
        date_end: END,
        recurrence_rule: { frequency: 'daily', interval: 1, until: '2026-10-09T10:00:00Z' },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    masterKey = (await res.json()).data.key;
  });

  test.afterAll(async ({ request }) => {
    if (token && masterKey) {
      await request.delete(`${LOCAL_API}/events/${masterKey}`, { headers: auth() }).catch(() => {});
    }
  });

  async function listSeries(request: any): Promise<any[]> {
    const res = await request.get(
      `${LOCAL_API}/calendars/${calKey}/events?start_date_time=${WINDOW.from}&end_date_time=${WINDOW.to}`,
      { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    const events = data.events ?? data;
    return events.filter((e: any) => e.key === masterKey || e.uid === masterKey || e.title?.includes('[local-e2e] occurrences'));
  }

  test('OCC-01 listing expands occurrences with per-slot recurrence_id', async ({ request }) => {
    const events = await listSeries(request);
    expect(events.length).toBe(5);
    const rids = events.map((e: any) => e.recurrence_id).sort();
    expect(rids.every((r: string) => typeof r === 'string'), `each occurrence has recurrence_id: ${JSON.stringify(rids)}`).toBeTruthy();
    expect(rids[0]).toContain('2026-10-05');
    expect(rids[4]).toContain('2026-10-09');
    // occurrences share the master key
    expect(new Set(events.map((e: any) => e.key)).size).toBe(1);
  });

  test('OCC-02 PATCH with recurrence_id detaches ONE occurrence', async ({ request }) => {
    const rid = '2026-10-06T09:00:00Z';
    const res = await request.patch(`${LOCAL_API}/events/${masterKey}`, {
      headers: auth(),
      data: { recurrence_id: rid, title: '[local-e2e] occurrences moved', date_start: '2026-10-06T13:00:00Z', date_end: '2026-10-06T14:00:00Z' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const detached = (await res.json()).data;
    expect(detached.key).not.toBe(masterKey);
    expect(detached.recurrence_id).toContain('2026-10-06T09:00:00');

    // listing: 5 slots, the detached one moved to 13:00
    const events = await listSeries(request);
    expect(events.length).toBe(5);
    const moved = events.find((e: any) => e.date_start?.startsWith('2026-10-06T13:00:00'));
    expect(moved, `detached slot moved: ${JSON.stringify(events.map((e: any) => e.date_start))}`).toBeTruthy();
    expect(events.filter((e: any) => e.date_start?.startsWith('2026-10-06T09:00:00')).length).toBe(0);
  });

  test('OCC-03 DELETE single occurrence leaves the rest (bug #19 regression)', async ({ request }) => {
    const rid = '2026-10-07T09:00:00Z';
    const res = await request.delete(`${LOCAL_API}/events/${masterKey}?recurrence_id=${rid}`, { headers: auth() });
    expect(res.status(), `occurrence delete ${res.status()} ${await res.text()}`).toBe(200);

    // master must SURVIVE
    const master = await request.get(`${LOCAL_API}/events/${masterKey}`, { headers: auth() });
    expect(master.status(), 'master survives single-occurrence delete').toBe(200);

    // listing: 5 - 1(EXDATE) - 1(moved) = 4 slots, no 10-07 09:00
    const events = await listSeries(request);
    expect(events.length, `after EXDATE: ${JSON.stringify(events.map((e: any) => e.date_start))}`).toBe(4);
    expect(events.filter((e: any) => e.date_start?.startsWith('2026-10-07T09:00')).length).toBe(0);
  });

  test('OCC-04 DELETE with recurrence_id on a NON-recurring event -> 404 S000605', async ({ request }) => {
    const created = await request.post(`${LOCAL_API}/calendars/${calKey}/events`, {
      headers: auth(),
      data: { title: '[local-e2e] occurrences single', date_start: '2026-10-05T15:00:00Z', date_end: '2026-10-05T16:00:00Z' },
    });
    const key = (await created.json()).data.key;

    const res = await request.delete(`${LOCAL_API}/events/${key}?recurrence_id=2026-10-05T15:00:00Z`, { headers: auth() });
    expect(res.status(), await res.text()).toBe(404);
    expect((await res.json()).error_code).toBe('S000605');

    // the event itself must NOT have been deleted
    const still = await request.get(`${LOCAL_API}/events/${key}`, { headers: auth() });
    expect(still.status(), 'non-scoped delete must not remove the event').toBe(200);
    await request.delete(`${LOCAL_API}/events/${key}`, { headers: auth() }).catch(() => {});
  });

  test('OCC-05 malformed recurrence_id -> 422', async ({ request }) => {
    const res = await request.delete(`${LOCAL_API}/events/${masterKey}?recurrence_id=not-a-date`, { headers: auth() });
    expect(res.status()).toBe(422);
  });

  test('OCC-06 whole-series delete still cascades the detached exception', async ({ request }) => {
    const res = await request.delete(`${LOCAL_API}/events/${masterKey}`, { headers: auth() });
    expect(res.status()).toBe(200);

    const master = await request.get(`${LOCAL_API}/events/${masterKey}`, { headers: auth() });
    expect(master.status()).toBe(404);

    const events = await listSeries(request);
    expect(events.length, `series fully gone: ${JSON.stringify(events.map((e: any) => e.title))}`).toBe(0);
  });
});
