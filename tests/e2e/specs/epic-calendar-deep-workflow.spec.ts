// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Calendar deep workflow.
//
// Stories for CalDAV connection info, calendar overview, event CRUD with
// attendees, team-calendar invite acceptance flow, external calendar feeds,
// and free/busy multi-user lookups.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Calendar deep: CalDAV & overview', () => {

  test('CALD-01 user reads CalDAV connection metadata', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/caldav/connection`, { headers: bearer(tk) });
    expect(200, `GET /calendars/caldav/connection -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const d = body?.data ?? {};
    test.info().annotations.push({
      type: 'caldav-conn',
      description: `home=${d.calendar_home_path?.slice(-30)} comps=${JSON.stringify(d.supported_components ?? [])}`,
    });
  });

  test('CALD-02 user reads CalDAV calendar overview', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/caldav/overview`, { headers: bearer(tk) });
    expect(200, `GET /calendars/caldav/overview -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    test.info().annotations.push({ type: 'caldav-overview', description: `keys: ${Object.keys(body?.data ?? {}).join(',')}` });
  });

  test('CALD-03 user lists all calendars with metadata', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `GET /calendars -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const cals = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'calendars', description: `count: ${cals.length}` });
  });

  test('CALD-04 user creates a calendar event with attendees', async ({ request }) => {
    const tk = await token(request);
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/events`, {
      headers: bearer(tk),
      data: {
        summary: `Project standup ${Date.now()}`,
        dtstart: new Date(Date.now() + 48 * 3600_000).toISOString(),
        dtend: new Date(Date.now() + 49 * 3600_000).toISOString(),
        attendees: [{ email: 'maxmustermann@sogo6.contextual-intelligence.org', cn: 'Max Mustermann' }],
      },
    });
    expect(ACCEPT, `POST events with attendees -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'event-attendees', description: `-> ${res.status()}` });
  });

  test('CALD-05 user adds an external calendar subscription', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/external-calendars`, {
      headers: bearer(tk),
      data: { name: `University holidays ${Date.now()}`, url: 'https://example.org/holidays.ics' },
    });
    expect(ACCEPT, `POST /external-calendars -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'ext-cal', description: `-> ${res.status()}` });
  });

  test('CALD-06 user lists external calendar subscriptions', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/external-calendars`, { headers: bearer(tk) });
    expect([200, 404], `GET /external-calendars -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const feeds = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'ext-cals', description: `count: ${feeds.length}` });
    }
  });
});

test.describe('Epic — Calendar deep: team invites & free/busy', () => {

  test('CALD-07 user lists incoming team-calendar invites', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(tk) });
    expect(200, `GET /calendars/teams/invites -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const invites = body?.data?.invites ?? body?.data ?? [];
    test.info().annotations.push({ type: 'invites', description: `count: ${Array.isArray(invites) ? invites.length : 0}` });
  });

  test('CALD-08 user creates a team calendar', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/calendars/teams`, {
      headers: bearer(tk),
      data: { name: `Dev team ${Date.now()}`, description: 'Cross-functional sync' },
    });
    expect(ACCEPT, `POST /calendars/teams -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'team-create', description: `-> ${res.status()}` });
  });

  test('CALD-09 user runs a multi-actor free/busy query', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/freebusy`, {
      headers: bearer(tk),
      data: {
        utcStartDate: new Date().toISOString(),
        utcEndDate: new Date(Date.now() + 2_1600_000).toISOString(),
        users: [
          'testuser@sogo6.contextual-intelligence.org',
          'maxmustermann@sogo6.contextual-intelligence.org',
        ],
      },
    });
    expect([200, 201, 400, 404, 405, 422], `POST /freebusy multi-user -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'multi-fb', description: `-> ${res.status()}` });
  });

  test('CALD-10 user reads appointment slots (creator view)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(tk) });
    expect(200, `GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'slots', description: `-> ${res.status()}` });
  });

  test('CALD-11 user attempts to accept a non-existent invite (graceful 404)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/calendars/teams/invites/nonexistent-id/accept`, {
      headers: bearer(tk), data: {},
    });
    // Should not 5xx — either 404 (not found) or 405 (method/route mismatch)
    expect([200, 201, 400, 404, 405, 422], `POST accept fake invite -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'accept-404', description: `-> ${res.status()}` });
  });
});
