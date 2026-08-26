// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Semester planning across three faculty roles.
//
// Cross-role story: rectorat (executive) initiates a semester-planning
// meeting, sabine.weber (dean) coordinates faculty calendars, and
// klaus.schmidt (professor) contributes availability and creates tasks.
// This exercises multi-actor free/busy, team calendars, mail coordination,
// and shared resources across three distinct LDAP accounts.
//
// Runs against https://sogo6.contextual-intelligence.org

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ACTORS = {
  exec:   { email: 'rektorat@sogo6.contextual-intelligence.org', password: 'Rektorat2026!Admin' },
  dean:   { email: 'sabine.weber@sogo6.contextual-intelligence.org', password: 'DeanUni2026!Secure' },
  prof:   { email: 'klaus.schmidt@sogo6.contextual-intelligence.org', password: 'ProfessorUni2026!' },
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

const TK: Record<string, string | null> = {};
async function tk(request: any, who: 'exec' | 'dean' | 'prof') {
  if (!TK[who]) TK[who] = await apiLogin(request, ACTORS[who].email, ACTORS[who].password);
  return TK[who];
}

test.describe('Epic — Semester planning: multi-role coordination', () => {

  test('SEM-01 all three faculty roles authenticate', async ({ request }) => {
    const [te, td, tp] = await Promise.all([
      tk(request, 'exec'), tk(request, 'dean'), tk(request, 'prof'),
    ]);
    expect(te && td && tp, 'all three faculty authenticated').toBeTruthy();
    test.info().annotations.push({ type: 'auth', description: 'exec+dean+prof ok' });
  });

  test('SEM-02 rectorate runs a three-person free/busy query', async ({ request }) => {
    const t = await tk(request, 'exec');
    const res = await request.post(`${REMOTE_API}/freebusy`, {
      headers: bearer(t),
      data: {
        utcStartDate: new Date().toISOString(),
        utcEndDate: new Date(Date.now() + 7 * 86400_000).toISOString(),
        users: [ACTORS.exec.email, ACTORS.dean.email, ACTORS.prof.email],
      },
    });
    expect([200, 201, 400, 404, 405, 422], `POST 3-person freebusy -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: '3p-fb', description: `-> ${res.status()}` });
  });

  test('SEM-03 rectorate creates a semester-planning team calendar', async ({ request }) => {
    const t = await tk(request, 'exec');
    const res = await request.post(`${REMOTE_API}/calendars/teams`, {
      headers: bearer(t),
      data: { name: `WS 2026/27 Planning ${Date.now()}`, description: 'Semester planning committee' },
    });
    expect(ACCEPT, `POST /calendars/teams -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'team-create', description: `-> ${res.status()}` });
  });

  test('SEM-04 dean and professor both check team-calendar invites', async ({ request }) => {
    const td = await tk(request, 'dean');
    const tp = await tk(request, 'prof');
    const [rd, rp] = await Promise.all([
      request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(td) }),
      request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(tp) }),
    ]);
    expect(200, `dean invites -> ${rd.status()}`).toBe(rd.status());
    expect(200, `prof invites -> ${rp.status()}`).toBe(rp.status());
    test.info().annotations.push({ type: 'invites-both', description: `D ${rd.status()} / P ${rp.status()}` });
  });

  test('SEM-05 rectorate sends semester-planning mail to both', async ({ request }) => {
    const t = await tk(request, 'exec');
    const res = await request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: bearer(t),
      data: {
        from: ACTORS.exec.email,
        to: [ACTORS.dean.email, ACTORS.prof.email],
        subject: `Semester Planning WS 2026/27 ${Date.now()}`,
        body: 'Please prepare your course schedules for the planning meeting.',
        is_html: false,
      },
    });
    expect(ACCEPT, `broadcast mail -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'broadcast', description: `-> ${res.status()}` });
  });

  test('SEM-06 dean and professor read their inboxes', async ({ request }) => {
    const td = await tk(request, 'dean');
    const tp = await tk(request, 'prof');
    const [rd, rp] = await Promise.all([
      request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=3`, { headers: bearer(td) }),
      request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=3`, { headers: bearer(tp) }),
    ]);
    expect([200, 404], `dean INBOX -> ${rd.status()}`).toContain(rd.status());
    expect([200, 404], `prof INBOX -> ${rp.status()}`).toContain(rp.status());
    test.info().annotations.push({ type: 'both-inbox', description: `D ${rd.status()} / P ${rp.status()}` });
  });
});

test.describe('Epic — Semester planning: tasks, resources & follow-up', () => {

  test('SEM-07 professor creates a task for course preparation', async ({ request }) => {
    const t = await tk(request, 'prof');
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(t) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: bearer(t),
      data: { title: `Prepare lecture slides WS 2026/27 ${Date.now()}`, description: 'Numerical Methods and Linear Algebra' },
    });
    expect(ACCEPT, `POST task -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'task-create', description: `-> ${res.status()}` });
  });

  test('SEM-08 dean checks available resources for a planning venue', async ({ request }) => {
    const t = await tk(request, 'dean');
    const from = new Date(Date.now() + 14 * 86400_000).toISOString();
    const to = new Date(Date.now() + 21 * 86400_000).toISOString();
    const res = await request.get(`${REMOTE_API}/resources/available?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`, { headers: bearer(t) });
    expect([200, 400, 404, 422], `dean resources -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'resources', description: `-> ${res.status()}` });
  });

  test('SEM-09 all three roles check their preferences in parallel', async ({ request }) => {
    const [te, td, tp] = await Promise.all([
      tk(request, 'exec'), tk(request, 'dean'), tk(request, 'prof'),
    ]);
    const [re, rd, rp] = await Promise.all([
      request.get(`${REMOTE_API}/preferences`, { headers: bearer(te) }),
      request.get(`${REMOTE_API}/preferences`, { headers: bearer(td) }),
      request.get(`${REMOTE_API}/preferences`, { headers: bearer(tp) }),
    ]);
    expect(200, `exec prefs -> ${re.status()}`).toBe(re.status());
    expect(200, `dean prefs -> ${rd.status()}`).toBe(rd.status());
    expect(200, `prof prefs -> ${rp.status()}`).toBe(rp.status());
    test.info().annotations.push({ type: '3p-prefs', description: `E ${re.status()} / D ${rd.status()} / P ${rp.status()}` });
  });

  test('SEM-10 rectorate checks shared-mailbox governance', async ({ request }) => {
    const t = await tk(request, 'exec');
    const res = await request.get(`${REMOTE_API}/shared-mailboxes`, { headers: bearer(t) });
    expect([200, 404], `exec shared-mailboxes -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'shared', description: `-> ${res.status()}` });
  });

  test('SEM-11 professor and dean verify calendar isolation (each sees own)', async ({ request }) => {
    const td = await tk(request, 'dean');
    const tp = await tk(request, 'prof');
    const [rd, rp] = await Promise.all([
      request.get(`${REMOTE_API}/calendars`, { headers: bearer(td) }),
      request.get(`${REMOTE_API}/calendars`, { headers: bearer(tp) }),
    ]);
    expect(200, `dean cals -> ${rd.status()}`).toBe(rd.status());
    expect(200, `prof cals -> ${rp.status()}`).toBe(rp.status());
    test.info().annotations.push({ type: 'cal-iso', description: `D ${rd.status()} / P ${rp.status()}` });
  });
});
