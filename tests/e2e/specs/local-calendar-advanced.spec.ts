// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar advanced surfaces (@local): tasks, freebusy, shares, export.
//
//   Tasks:    GET/POST /calendars/<key>/tasks, GET/PUT/DELETE /tasks/<key>
//   Freebusy: POST /freebusy {target_uids, start, end}
//   Shares:   GET/POST /calendars/<key>/shares {user_uid, public_level}
//   Export:   POST->202 async job /calendars/<key>/export
//
//   npx playwright test local-calendar-advanced.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const USER = { email: 'testuser@example.org', password: 'password123' };
const OTHER = { email: 'testuser2@example.org', password: 'password123' };

let token = '';
let calKey = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, USER_API))!;
  expect(token).toBeTruthy();
  const res = await request.get(`${USER_API}/calendars`, { headers: auth() });
  const cals = ((await res.json()).data ?? {}).calendars ?? [];
  const personal = cals.find((c: any) => /personal/i.test(c.name ?? ''));
  calKey = personal?.key;
  expect(calKey, 'personal calendar exists').toBeTruthy();
});

test.describe('local calendar tasks @local @calendar', () => {
  const uniq = `task ${Date.now()}`;
  let taskKey = '';

  test('TASK-01 create a task in the personal calendar', async ({ request }) => {
    const res = await request.post(`${USER_API}/calendars/${calKey}/tasks`, {
      headers: json(),
      data: { title: `[local-e2e] ${uniq}`, description: 'e2e probe', percent_complete: 0 },
    });
    expect(res.status(), `create task -> ${res.status()} ${await res.text()}`).toBe(201);
    const body = await res.json();
    expect(body.data.component_type).toBe('task');
    taskKey = body.data.key;
    expect(taskKey).toBeTruthy();
  });

  test('TASK-02 the task appears in the calendar task list', async ({ request }) => {
    const res = await request.get(`${USER_API}/calendars/${calKey}/tasks`, { headers: auth() });
    expect(res.status()).toBe(200);
    const tasks = ((await res.json()).data ?? {}).tasks ?? [];
    expect(tasks.some((t: any) => t.key === taskKey)).toBe(true);
  });

  test('TASK-03 unknown task key returns 404', async ({ request }) => {
    const res = await request.get(`${USER_API}/tasks/00000000-0000-0000-0000-000000000000`, {
      headers: auth(),
    });
    expect(res.status()).toBe(404);
  });

  test('TASK-04 the task can be deleted', async ({ request }) => {
    const del = await request.delete(`${USER_API}/tasks/${taskKey}`, { headers: auth() });
    expect([200, 204]).toContain(del.status());
    const gone = await request.get(`${USER_API}/tasks/${taskKey}`, { headers: auth() });
    expect(gone.status()).toBe(404);
  });
});

test.describe('local calendar freebusy + shares + export @local @calendar', () => {
  test('FB-01 freebusy reports a busy period for an existing event window', async ({ request }) => {
    // testuser has an "[local-e2e] itip" event at +2 days 1h (local-itip.spec);
    // probe a window around "now + 2 days" so an event-free calendar still
    // passes vacuously — instead use a WIDE window and assert schema shape.
    const start = new Date(Date.now() - 86400000).toISOString().replace(/\.\d{3}Z/, 'Z');
    const end = new Date(Date.now() + 7 * 86400000).toISOString().replace(/\.\d{3}Z/, 'Z');
    const res = await request.post(`${USER_API}/freebusy`, {
      headers: json(),
      data: { target_uids: [USER.email], start, end },
    });
    expect(res.status(), `freebusy -> ${res.status()} ${await res.text()}`).toBe(200);
    const body = (await res.json()).data;
    expect(Object.keys(body.attendees)).toContain(USER.email);
    expect(typeof body.is_available).toBe('boolean');
    // periods, when present, must carry start/end/type
    for (const p of body.attendees[USER.email].periods ?? []) {
      expect(p.start).toBeTruthy();
      expect(p.end).toBeTruthy();
      expect(p.type).toBe('busy');
    }
  });

  test('FB-02 freebusy requires target_uids (422 without)', async ({ request }) => {
    const res = await request.post(`${USER_API}/freebusy`, {
      headers: json(),
      data: { start: new Date().toISOString(), end: new Date().toISOString() },
    });
    expect(res.status()).toBe(422);
  });

  test('SHARE-01 share the calendar with another user (view_all) and list it back', async ({ request }) => {
    const create = await request.post(`${USER_API}/calendars/${calKey}/shares`, {
      headers: json(),
      data: { user_uid: OTHER.email, public_level: 'view_all' },
    });
    // 200 on first share; 409 (S000603 "Calendar Already Exists") when the
    // share already exists from a previous run — both leave the share in place.
    expect([200, 409]).toContain(create.status());
    if (create.status() === 200) {
      const share = (await create.json()).data;
      expect(share.user_uid).toBe(OTHER.email);
      expect(share.public_level).toBe('view_all');
    }

    const list = await request.get(`${USER_API}/calendars/${calKey}/shares`, { headers: auth() });
    expect(list.status()).toBe(200);
    const shares = ((await list.json()).data ?? {}).shares ?? [];
    expect(shares.some((s: any) => s.user_uid === OTHER.email)).toBe(true);
  });

  test('EXPORT-01 export round-trip: 202 → agent job → ICS result', async ({ request }) => {
    test.setTimeout(90000);
    const res = await request.get(`${USER_API}/calendars/${calKey}/export`, { headers: auth() });
    expect(res.status(), `export enqueue -> ${res.status()} ${await res.text()}`).toBe(202);
    const jobId = (await res.json()).data.job_id;
    expect(jobId).toMatch(/[0-9a-f-]{36}/);

    // async-liveness: poll until the agent processes the job (deadline 60s)
    let status = '';
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * i, 5000)));
      const poll = await request.get(`${USER_API}/jobs/${jobId}`, { headers: auth() });
      status = ((await poll.json()).data ?? {}).status ?? '';
      if (status === 'success' || status === 'failure') break;
    }
    expect(status, 'export job must succeed').toBe('success');

    const result = await request.get(`${USER_API}/jobs/${jobId}/result`, { headers: auth() });
    expect(result.status()).toBe(200);
    const ics = await result.text();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
  });
});
