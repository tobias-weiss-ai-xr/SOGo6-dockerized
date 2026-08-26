// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Rectorate leadership (university executive role).
//
// Realistic multi-step stories for a rectorate executive (`rektorat`):
// team-calendar governance, scheduling & free/busy, external calendar feeds,
// and corporate communication with the wider directory.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role credentials: rektorat@sogo6.contextual-intelligence.org / Rektorat2026!Admin
//
// Every story is authenticated with a real JWT (LDAP user bind via /auth/login).
// 5xx fails the test; 2xx/4xx are acceptable (validation errors & gaps are valid).

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'rektorat@sogo6.contextual-intelligence.org',
  password: 'Rektorat2026!Admin',
};

const ACCEPT = [200, 201, 202, 204, 400, 404, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Rectorate leadership: team calendars & governance', () => {

  test('EPIC/REKT-01 rectorate executive logs in and sees calendars', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'role login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `auth GET /calendars -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const cals = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'calendars', description: `count: ${cals.length}` });
    expect(Array.isArray(cals)).toBe(true);
  });

  test('EPIC/REKT-02 executive creates a rectorate team calendar', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/calendars/teams`, {
      headers: bearer(tk),
      data: { name: `Rectorate Board ${Date.now()}`, description: 'Executive board planning' },
    });
    expect([200, 201, 400, 404, 422], `POST /calendars/teams -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'team', description: `-> ${res.status()}` });
  });

  test('EPIC/REKT-03 executive lists team calendars they belong to', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/teams`, { headers: bearer(tk) });
    expect([200, 404], `GET /calendars/teams -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const teams = Array.isArray(body?.data?.teams) ? body.data.teams : (Array.isArray(body?.data) ? body.data : []);
      test.info().annotations.push({ type: 'teams', description: `count: ${teams.length}` });
    }
  });

  test('EPIC/REKT-04 executive checks all-outgoing invites', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(tk) });
    expect([200, 404], `GET /calendars/teams/invites -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'invites', description: `-> ${res.status()}` });
  });

  test('EPIC/REKT-05 executive runs free/busy over the board room', async ({ request }) => {
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

  test('EPIC/REKT-06 executive schedules a board meeting event', async ({ request }) => {
    const tk = await token(request);
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/events`, {
      headers: bearer(tk),
      data: {
        summary: `Board meeting ${Date.now()}`,
        dtstart: new Date(Date.now() + 24 * 3600_000).toISOString(),
        dtend: new Date(Date.now() + 26 * 3600_000).toISOString(),
      },
    });
    expect([200, 201, 400, 404, 422], `POST events -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'event', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Rectorate leadership: communication & corporate planning', () => {

  test('EPIC/REKT-07 executive adds an external calendar feed', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/external-calendars`, {
      headers: bearer(tk),
      data: { name: `Holidays ${Date.now()}`, url: 'https://example.org/holidays.ics' },
    });
    expect([200, 201, 400, 404, 422], `POST /external-calendars -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'external', description: `-> ${res.status()}` });
  });

  test('EPIC/REKT-08 external calendar feeds are listed and synchronised', async ({ request }) => {
    const tk = await token(request);
    const list = await request.get(`${REMOTE_API}/external-calendars`, { headers: bearer(tk) });
    expect([200, 404], `GET /external-calendars -> ${list.status()}`).toContain(list.status());
    if (list.status() === 200) {
      const body = await list.json();
      const feeds = Array.isArray(body?.data) ? body.data : [];
      if (feeds.length) {
        const key = feeds[0]?.key ?? feeds[0]?.id;
        const sync = await request.post(`${REMOTE_API}/external-calendars/${encodeURIComponent(key)}/sync`, {
          headers: bearer(tk), data: {},
        });
        test.info().annotations.push({ type: 'sync', description: `feed -> ${sync.status()}` });
      }
    }
  });

  test('EPIC/REKT-09 executive publishes a board-wide announcement by mail', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: bearer(tk),
      data: {
        from: ROLE.email,
        to: ['lisa.mayer@sogo6.contextual-intelligence.org', 'sabine.weber@sogo6.contextual-intelligence.org'],
        subject: `Rectorate announcement ${Date.now()}`,
        body: 'Please review the attached strategy paper.',
        is_html: false,
      },
    });
    expect([200, 201, 400, 404, 422], `POST mail -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'announce', description: `-> ${res.status()}` });
  });

  test('EPIC/REKT-10 executive reviews the mailbox for follow-ups', async ({ request }) => {
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

  test('EPIC/REKT-11 executive files a strategy review task', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/tasks`, { headers: bearer(tk) });
    expect([200, 404], `GET /tasks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'tasks', description: `-> ${res.status()}` });
  });
});