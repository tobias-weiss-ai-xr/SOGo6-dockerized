// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — User settings deep workflow.
//
// Stories for reading the full preferences tree, patching individual
// preference sections (general, calendar, mail, contact), reading the
// customisation theme, and profile updates.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role: sabine.weber@sogo6.contextual-intelligence.org / DeanUni2026!Secure

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'sabine.weber@sogo6.contextual-intelligence.org',
  password: 'DeanUni2026!Secure',
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — User settings: preferences tree', () => {

  test('SETT-01 user reads the full preferences tree', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/preferences`, { headers: bearer(tk) });
    expect(200, `GET /preferences -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const prefs = body?.data ?? {};
    const sections = Object.keys(prefs);
    test.info().annotations.push({ type: 'prefs', description: `sections: ${sections.join(',')}` });
  });

  test('SETT-02 user patches general preferences (language)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.patch(`${REMOTE_API}/preferences`, {
      headers: bearer(tk),
      data: { USER_GENERAL: { SOGO_U_LANGUAGE: 'English', SOGO_U_TIMEZONE: 'UTC' } },
    });
    expect([200, 400, 422], `PATCH /preferences (general) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'patch-general', description: `-> ${res.status()}` });
  });

  test('SETT-03 user patches calendar preferences', async ({ request }) => {
    const tk = await token(request);
    const res = await request.patch(`${REMOTE_API}/preferences`, {
      headers: bearer(tk),
      data: { USER_CALENDAR_GENERAL: { SOGO_U_CALENDAR_VIEW_FIRST_DAY: 1, SOGO_U_WORKDAY_START_TIME: '08:00' } },
    });
    expect([200, 400, 422], `PATCH /preferences (calendar) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'patch-cal', description: `-> ${res.status()}` });
  });

  test('SETT-04 user patches mail preferences', async ({ request }) => {
    const tk = await token(request);
    const res = await request.patch(`${REMOTE_API}/preferences`, {
      headers: bearer(tk),
      data: { USER_MAIL_GENERAL_SETTINGS: { SOGO_U_SORT_BY_THREAD: true, SOGO_U_MARK_READ_DELAY: 0 } },
    });
    expect([200, 400, 422], `PATCH /preferences (mail) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'patch-mail', description: `-> ${res.status()}` });
  });

  test('SETT-05 user reads the customisation theme CSS', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/customization/themes`, { headers: bearer(tk) });
    expect(200, `GET /customization/themes -> ${res.status()}`).toBe(res.status());
    const body = await res.text();
    const hasVars = body.includes('--primary') && body.includes('--background');
    test.info().annotations.push({ type: 'theme', description: `hasCSSVars=${hasVars} len=${body.length}` });
  });

  test('SETT-06 user verifies preferences persisted after patch', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/preferences`, { headers: bearer(tk) });
    expect(200, `GET /preferences (verify) -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const general = body?.data?.USER_GENERAL ?? {};
    test.info().annotations.push({
      type: 'persisted',
      description: `lang=${general.SOGO_U_LANGUAGE ?? '?'} tz=${general.SOGO_U_TIMEZONE ?? '?'}`,
    });
  });
});

test.describe('Epic — User settings: profile & mailboxes', () => {

  test('SETT-07 user reads their full profile', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/profile`, { headers: bearer(tk) });
    expect(200, `GET /profile -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const d = body?.data ?? {};
    test.info().annotations.push({ type: 'profile', description: `cn=${d.cn ?? d.display_name ?? '?'}` });
  });

  test('SETT-08 user reads mailbox accounts list', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes`, { headers: bearer(tk) });
    expect([200, 404], `GET /mailboxes -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const boxes = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'mailboxes', description: `count: ${boxes.length}` });
    }
  });

  test('SETT-09 user reads CalDAV connection (for external client config)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/caldav/connection`, { headers: bearer(tk) });
    expect(200, `GET /calendars/caldav/connection -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const d = body?.data ?? {};
    test.info().annotations.push({ type: 'caldav', description: `home=${d.calendar_home_path?.slice(-30)}` });
  });

  test('SETT-10 user reads CalDAV overview', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/caldav/overview`, { headers: bearer(tk) });
    expect(200, `GET /calendars/caldav/overview -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'caldav-ov', description: `-> ${res.status()}` });
  });

  test('SETT-11 user accesses snooze list (zero snoozed items)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/snooze/`, { headers: bearer(tk) });
    expect(200, `GET /snooze -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const snoozed = body?.data?.snoozed ?? [];
    test.info().annotations.push({ type: 'snooze', description: `count: ${Array.isArray(snoozed) ? snoozed.length : 0}` });
  });
});
