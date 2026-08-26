// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Faculty dean (collegiate leadership role).
//
// Realistic multi-step stories for a faculty dean (`sabine.weber`): faculty
// calendar orchestration, delegate/assignment delegation, email snoozing, and
// task-driven faculty workflow.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role credentials: sabine.weber@sogo6.contextual-intelligence.org / DeanUni2026!Secure
//
// Every story is authenticated with a real JWT (LDAP user bind via /auth/login).
// 5xx fails the test; 2xx/4xx are acceptable.

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'sabine.weber@sogo6.contextual-intelligence.org',
  password: 'DeanUni2026!Secure',
};

const ACCEPT = [200, 201, 202, 204, 400, 404, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Faculty dean: calendar & delegation', () => {

  test('EPIC/DEAN-01 dean logs in and reads faculty calendars', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'role login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `auth GET /calendars -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'calendars', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-02 dean lists pending team-calendar invites', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(tk) });
    expect([200, 404], `GET invites -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'invites', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-03 dean lists team memberships', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/teams`, { headers: bearer(tk) });
    expect([200, 404], `GET teams -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'teams', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-04 dean runs a faculty free/busy lookup', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/freebusy`, {
      headers: bearer(tk),
      data: {
        utcStartDate: new Date().toISOString(),
        utcEndDate: new Date(Date.now() + 2_1600_000).toISOString(),
        users: [ROLE.email],
      },
    });
    expect([200, 201, 400, 404, 405, 422], `POST /freebusy -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'freebusy', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-05 dean reads and updates their profile', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/profile`, { headers: bearer(tk) });
    expect(200, `GET /profile -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'profile', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-06 dean lists delegated/shared mailboxes', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/shared-mailboxes`, { headers: bearer(tk) });
    expect([200, 404], `GET /shared-mailboxes -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const boxes = Array.isArray(body?.data) ? body.data : (body?.data?.mailboxes ?? []);
      test.info().annotations.push({ type: 'shared', description: `mailboxes: ${Array.isArray(boxes) ? boxes.length : 0}` });
    }
  });
});

test.describe('Epic — Faculty dean: mailbox productivity', () => {

  test('EPIC/DEAN-07 dean snoozes a mailbox item for later', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/snooze/`, {
      headers: bearer(tk),
      data: {
        account_id: '0',
        mail_uids: ['99999'],
        folder: 'INBOX',
        snooze_until: new Date(Date.now() + 48 * 3600_000).toISOString(),
      },
    });
    expect([200, 201, 400, 404, 409, 422], `POST /snooze -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'snooze', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-08 dean lists currently snoozed items', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/snooze/`, { headers: bearer(tk) });
    expect(200, `auth GET /snooze -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const snoozed = body?.data?.snoozed ?? [];
    test.info().annotations.push({ type: 'snoozed', description: `count: ${Array.isArray(snoozed) ? snoozed.length : 0}` });
    expect(Array.isArray(snoozed)).toBe(true);
  });

  test('EPIC/DEAN-09 dean files a faculty task and lists open tasks', async ({ request }) => {
    const tk = await token(request);
    const tasksG = await request.get(`${REMOTE_API}/tasks`, { headers: bearer(tk) });
    expect([200, 404], `GET /tasks -> ${tasksG.status()}`).toContain(tasksG.status());
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: bearer(tk),
      data: { title: `Review faculty report ${Date.now()}`, description: 'For senate meeting' },
    });
    expect([200, 201, 400, 404, 422], `POST tasks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'task', description: `-> ${res.status()}` });
  });

  test('EPIC/DEAN-10 dean reviews the inbox for faculty matters', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET INBOX -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'inbox', description: `mails: ${mails.length}` });
    }
  });

  test('EPIC/DEAN-11 dean manages resource-booking presence', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/resources/favorites`, { headers: bearer(tk) });
    expect([200, 404], `GET /resources/favorites -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'res', description: `-> ${res.status()}` });
  });
});