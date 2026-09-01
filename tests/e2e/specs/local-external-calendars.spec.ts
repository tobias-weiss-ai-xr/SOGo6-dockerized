// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// External calendar subscriptions (ICS/CALDAV) (@local): create/list/get/put
// + sync status/trigger + owner unsubscribe.
// Pinned: DELETE by the owner is allowed (the read-only ICS cap must not
// block subscription removal) — verified after the submodule rebase where
// delete_calendar still routes through the ACL DELETE check.

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const FOREIGN_CAL = '81f1125f-a645-4b37-891b-ca9e0a5bde00'; // testuser2's calendar
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let token = '';
let extKey = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  token = (await login.json()).data.jwt_token;
});

test.afterAll(async ({ request }) => {
  if (extKey) {
    await request.delete(`${USER_API}/external-calendars/${extKey}`, { headers: auth() });
  }
});

test.describe('local external calendars @local @external-cal', () => {
  test('EC-01 create an ICS subscription returns the calendar', async ({ request }) => {
    const res = await request.post(`${USER_API}/external-calendars`, {
      headers: json(),
      data: { name: `[local-e2e] ext ${STAMP}`, url: 'https://example.org/nothing.ics' },
    });
    expect(res.status(), await res.text()).toBe(201);
    const cal = (await res.json()).data;
    extKey = cal.key;
    expect(cal.name).toContain(STAMP);
    expect(cal.source_type).toBe('ics');
    expect(cal.include_in_freebusy).toBe(true);
  });

  test('EC-02 the subscription appears in the list', async ({ request }) => {
    const res = await request.get(`${USER_API}/external-calendars`, { headers: auth() });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.calendars.some((c: any) => c.key === extKey)).toBe(true);
  });

  test('EC-03 GET detail echoes the subscription', async ({ request }) => {
    const res = await request.get(`${USER_API}/external-calendars/${extKey}`, { headers: auth() });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.key).toBe(extKey);
  });

  test('EC-04 PUT renames and recolors the subscription', async ({ request }) => {
    const res = await request.put(`${USER_API}/external-calendars/${extKey}`, {
      headers: json(),
      data: { name: `[local-e2e] ext renamed ${STAMP}`, color: '#ff8800' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const cal = (await res.json()).data;
    expect(cal.name).toContain('renamed');
    expect(cal.color).toBe('#ff8800');
  });

  test('EC-05 sync status + manual sync enqueue a job', async ({ request }) => {
    const status = await request.get(`${USER_API}/external-calendars/${extKey}/sync`, { headers: auth() });
    expect(status.status()).toBe(200);
    const st = (await status.json()).data;
    expect(['pending', 'syncing', 'completed', 'error']).toContain(st.sync_status);

    const trigger = await request.post(`${USER_API}/external-calendars/${extKey}/sync`, {
      headers: json(),
      data: {},
    });
    // POST without a JSON body would be rejected by the content-type gate (S000205);
    // with an empty JSON body it enqueues a sync job.
    expect(trigger.status(), await trigger.text()).toBe(202);
    expect((await trigger.json()).data.job_id).toBeTruthy();
  });

  test('EC-06 unknown calendar detail -> 404 S000602', async ({ request }) => {
    const res = await request.get(`${USER_API}/external-calendars/00000000-0000-0000-0000-000000000000`, {
      headers: auth(),
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error_code).toBe('S000602');
  });

  test('EC-07 the owner can unsubscribe (DELETE works)', async ({ request }) => {
    const del = await request.delete(`${USER_API}/external-calendars/${extKey}`, { headers: auth() });
    expect(del.status(), await del.text()).toBe(200);
    const after = await request.get(`${USER_API}/external-calendars/${extKey}`, { headers: auth() });
    expect(after.status()).toBe(404);
    extKey = ''; // afterAll must not retry
  });

  test('EC-08 a foreign calendar cannot be deleted by a non-owner', async ({ request }) => {
    const res = await request.delete(`${USER_API}/calendars/${FOREIGN_CAL}`, { headers: auth() });
    expect(res.status()).toBe(403);
    expect((await res.json()).error_code).toBe('S000620');
  });

  test('EC-09 create validation: missing url -> 422', async ({ request }) => {
    const res = await request.post(`${USER_API}/external-calendars`, {
      headers: json(),
      data: { name: 'no-url' },
    });
    expect(res.status()).toBe(422);
  });
});
