// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar user-to-user shares @local @calendar.
//
//   POST   /api/user/v1/calendars/<key>/shares           create share (201)
//   GET    /api/user/v1/calendars/<key>/shares           list shares
//   DELETE /api/user/v1/calendars/<key>/shares/<uid>     remove share (200)
//
// ShareCreateSchema fields: user_uid (required), public_level (none |
// view_date_time | view_all | respond | modify_if_org | modify — default
// view_all), confidential_level, private_level, can_create, can_delete.
//
// Regression context (2026-08-31, round 11):
//   - Bug #18: share create returned 200 though the route declares 201.
//   - Bug #20: duplicate share raised S000603 "Calendar Already Exists"
//     (client cannot distinguish share vs calendar) — now S000653
//     "Share Already Exists".
//   - Bug #21: sharee event create/task create ACL-checked as the calendar
//     OWNER (always allowed) — can_create=false sharees could write events.
//     Now 403 S000620 unless the share grants can_create.
//
//   npx playwright test local-calendar-shares.spec.ts

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const CT = { 'Content-Type': 'application/json' };

let ownerToken = '';
let shareeToken = '';
const ownerAuth = () => ({ Authorization: `Bearer ${ownerToken}`, ...CT });
const shareeAuth = () => ({ Authorization: `Bearer ${shareeToken}`, ...CT });

let ownerCalKey = '';
const SHAREE = 'testuser2@example.org';

test.describe('local calendar shares @local @calendar', () => {
  test.beforeAll(async ({ request }) => {
    const owner = await request.post(`${LOCAL_API}/auth/login`, {
      headers: CT, data: { username: 'testuser@example.org', password: 'password123' },
    });
    ownerToken = ((await owner.json()).data ?? {}).jwt_token ?? '';
    expect(ownerToken, 'owner login').toBeTruthy();

    const sharee = await request.post(`${LOCAL_API}/auth/login`, {
      headers: CT, data: { username: SHAREE, password: 'password123' },
    });
    shareeToken = ((await sharee.json()).data ?? {}).jwt_token ?? '';
    expect(shareeToken, 'sharee login').toBeTruthy();

    const cals = await request.get(`${LOCAL_API}/calendars`, { headers: ownerAuth() });
    const own = ((await cals.json()).data.calendars ?? []).find((c: any) => c.is_default);
    expect(own, 'owner default calendar').toBeTruthy();
    ownerCalKey = own.key;

    // clean slate: drop any share left by an aborted run
    await request.delete(`${LOCAL_API}/calendars/${ownerCalKey}/shares/${SHAREE}`, {
      headers: ownerAuth(),
    }).catch(() => {});
  });

  test.afterAll(async ({ request }) => {
    if (ownerToken && ownerCalKey) {
      await request.delete(`${LOCAL_API}/calendars/${ownerCalKey}/shares/${SHAREE}`, {
        headers: ownerAuth(),
      }).catch(() => {});
    }
  });

  test('SH-01 share create returns 201 and echoes the granted levels (bug #18 regression)', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/shares`, {
      headers: ownerAuth(),
      data: { user_uid: SHAREE, public_level: 'view_all', can_create: true, can_delete: false },
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    expect(body.data.user_uid).toBe(SHAREE);
    expect(body.data.public_level).toBe('view_all');
    expect(body.data.can_create).toBe(true);
  });

  test('SH-02 duplicate share -> 409 S000653 "Share Already Exists" (bug #20 regression)', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/shares`, {
      headers: ownerAuth(),
      data: { user_uid: SHAREE },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error_code).toBe('S000653');
    expect(body.error_msg).toBe('Share Already Exists');
  });

  test('SH-03 share listing shows the granted entry', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/calendars/${ownerCalKey}/shares`, { headers: ownerAuth() });
    expect(res.status()).toBe(200);
    const shares = (await res.json()).data;
    const mine = Array.isArray(shares) ? shares.find((s: any) => s.user_uid === SHAREE) : shares;
    expect(mine, `share visible in listing: ${JSON.stringify(shares)}`).toBeTruthy();
  });

  test('SH-04 sharee sees the shared calendar in their calendar list', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/calendars`, { headers: shareeAuth() });
    expect(res.status()).toBe(200);
    const cals = (await res.json()).data.calendars ?? [];
    const shared = cals.find((c: any) => c.key === ownerCalKey);
    expect(shared, `shared calendar listed for sharee: ${JSON.stringify(cals.map((c: any) => c.key))}`).toBeTruthy();
    // the sharee sees the OWNER's calendar with SHARE-derived permissions,
    // not their own owner permissions
    expect(shared.permissions.public_level).toBe('view_all');
    expect(shared.permissions.can_create).toBe(true);
  });

  test('SH-05 sharee with can_create can write an event the owner sees', async ({ request }) => {
    const ev = {
      title: '[local-e2e] shares write probe',
      date_start: '2026-09-10T10:00:00Z',
      date_end: '2026-09-10T11:00:00Z',
    };
    const created = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/events`, {
      headers: shareeAuth(), data: ev,
    });
    expect(created.status(), await created.text()).toBe(201);
    const key = (await created.json()).data.key;
    expect(key).toBeTruthy();

    // owner lists their calendar and finds the sharee-written event
    const ownerView = await request.get(
      `${LOCAL_API}/calendars/${ownerCalKey}/events?start_date_time=2026-09-10T00:00:00.000Z&end_date_time=2026-09-11T00:00:00.000Z`,
      { headers: ownerAuth() });
    const titles = ((await ownerView.json()).data.events ?? (await ownerView.json()).data ?? [])
      .map((e: any) => e.title);
    expect(titles, `owner sees sharee event: ${JSON.stringify(titles)}`).toContain(ev.title);

    // cleanup by owner (owner always has can_delete)
    const del = await request.delete(`${LOCAL_API}/events/${key}`, { headers: ownerAuth() });
    expect(del.status()).toBe(200);
  });

  test('SH-06 sharee cannot delete when can_delete=false (bug #21 regression)', async ({ request }) => {
    const ev = {
      title: '[local-e2e] shares candel probe',
      date_start: '2026-09-10T12:00:00Z',
      date_end: '2026-09-10T13:00:00Z',
    };
    const created = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/events`, {
      headers: ownerAuth(), data: ev,
    });
    const key = (await created.json()).data.key;

    const res = await request.delete(`${LOCAL_API}/events/${key}`, { headers: shareeAuth() });
    expect(res.status(), await res.text()).toBe(403);
    expect((await res.json()).error_code).toBe('S000620');

    // event must survive
    const still = await request.get(`${LOCAL_API}/events/${key}`, { headers: ownerAuth() });
    expect(still.status()).toBe(200);
    await request.delete(`${LOCAL_API}/events/${key}`, { headers: ownerAuth() }).catch(() => {});
  });

  test('SH-07 downgrade to view_date_time masks titles as "Busy"', async ({ request }) => {
    const ev = {
      title: '[local-e2e] shares busy probe',
      date_start: '2026-09-10T14:00:00Z',
      date_end: '2026-09-10T15:00:00Z',
    };
    const created = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/events`, {
      headers: ownerAuth(), data: ev,
    });
    const key = (await created.json()).data.key;

    // swap share level: remove + re-add with view_date_time
    await request.delete(`${LOCAL_API}/calendars/${ownerCalKey}/shares/${SHAREE}`, { headers: ownerAuth() });
    const readd = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/shares`, {
      headers: ownerAuth(),
      data: { user_uid: SHAREE, public_level: 'view_date_time' },
    });
    expect(readd.status()).toBe(201);

    const shareeView = await request.get(
      `${LOCAL_API}/calendars/${ownerCalKey}/events?start_date_time=2026-09-10T00:00:00.000Z&end_date_time=2026-09-11T00:00:00.000Z`,
      { headers: shareeAuth() });
    const events = (await shareeView.json()).data.events ?? [];
    const hit = events.find((e: any) => e.date_start?.startsWith('2026-09-10T14:00'));
    expect(hit, `sharee sees the slot: ${JSON.stringify(events)}`).toBeTruthy();
    expect(hit.title, 'view_date_time masks the title').toBe('Busy');

    await request.delete(`${LOCAL_API}/events/${key}`, { headers: ownerAuth() }).catch(() => {});
  });

  test('SH-08 after share removal the sharee loses write AND read access', async ({ request }) => {
    // restore full share first
    await request.delete(`${LOCAL_API}/calendars/${ownerCalKey}/shares/${SHAREE}`, { headers: ownerAuth() }).catch(() => {});
    await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/shares`, {
      headers: ownerAuth(),
      data: { user_uid: SHAREE, public_level: 'view_all', can_create: true },
    });

    const res = await request.delete(`${LOCAL_API}/calendars/${ownerCalKey}/shares/${SHAREE}`, {
      headers: ownerAuth(),
    });
    expect(res.status(), await res.text()).toBe(200);

    const write = await request.post(`${LOCAL_API}/calendars/${ownerCalKey}/events`, {
      headers: shareeAuth(),
      data: { title: 'x', date_start: '2026-09-10T16:00:00Z', date_end: '2026-09-10T17:00:00Z' },
    });
    expect(write.status()).toBe(403);

    // public_level=none: the calendar stays resolvable but leaks NO events
    const read = await request.get(
      `${LOCAL_API}/calendars/${ownerCalKey}/events?start_date_time=2026-09-10T00:00:00.000Z&end_date_time=2026-09-11T00:00:00.000Z`,
      { headers: shareeAuth() });
    expect(read.status()).toBe(200);
    const body = await read.json();
    expect((body.data.events ?? body.data ?? []).length, 'no events leak after share removal').toBe(0);

    // and the calendar is gone from the sharee's own list
    const cals = await request.get(`${LOCAL_API}/calendars`, { headers: shareeAuth() });
    const keys = ((await cals.json()).data.calendars ?? []).map((c: any) => c.key);
    expect(keys).not.toContain(ownerCalKey);
  });
});
