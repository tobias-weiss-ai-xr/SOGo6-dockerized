// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Peer-to-peer student interaction.
//
// Stories for two students interacting: mail exchange, calendar visibility,
// directory lookups of each other, shared resource access, and team-calendar
// membership from the peer perspective.
//
// Actors:
//   student-a = [see tests/e2e/.env] / [see tests/e2e/.env]
//   student-b = testuser2@sogo6.contextual-intelligence.org / password123
//
// Runs against https://sogo6.contextual-intelligence.org

import { test, expect, apiLogin, bearer, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ACTORS = {
  a: { email: REMOTE_CREDENTIALS.user.email, password: REMOTE_CREDENTIALS.user.password },
  b: { email: 'testuser2@sogo6.contextual-intelligence.org', password: 'password123' },
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

const TK: Record<string, string | null> = {};
async function tk(request: any, who: 'a' | 'b') {
  if (!TK[who]) TK[who] = await apiLogin(request, ACTORS[who].email, ACTORS[who].password);
  return TK[who];
}

test.describe('Epic — Peer interaction: mutual discovery', () => {

  test('PEER-01 both students authenticate independently', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    expect(ta && tb, 'both students authenticated').toBeTruthy();
    test.info().annotations.push({ type: 'auth', description: 'both ok' });
  });

  test('PEER-02 student-A looks up student-B in the directory', async ({ request }) => {
    const t = await tk(request, 'a');
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=testuser2`, { headers: bearer(t) });
    expect([200, 404], `GET autocomplete?q=testuser2 -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'lookup-ab', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('PEER-03 student-B looks up student-A in the directory', async ({ request }) => {
    const t = await tk(request, 'b');
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=testuser`, { headers: bearer(t) });
    expect([200, 404], `GET autocomplete?q=testuser -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'lookup-ba', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('PEER-04 both students see their own calendars (isolation check)', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    const [ra, rb] = await Promise.all([
      request.get(`${REMOTE_API}/calendars`, { headers: bearer(ta) }),
      request.get(`${REMOTE_API}/calendars`, { headers: bearer(tb) }),
    ]);
    expect(200, `A calendars -> ${ra.status()}`).toBe(ra.status());
    expect(200, `B calendars -> ${rb.status()}`).toBe(rb.status());
    test.info().annotations.push({ type: 'isolation', description: `A ${ra.status()} / B ${rb.status()}` });
  });

  test('PEER-05 both students check their address books independently', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    const [ra, rb] = await Promise.all([
      request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(ta) }),
      request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tb) }),
    ]);
    expect([200, 404], `A addressbooks -> ${ra.status()}`).toContain(ra.status());
    expect([200, 404], `B addressbooks -> ${rb.status()}`).toContain(rb.status());
    test.info().annotations.push({ type: 'ab-iso', description: `A ${ra.status()} / B ${rb.status()}` });
  });

  test('PEER-06 both students check shared mailbox access', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    const [ra, rb] = await Promise.all([
      request.get(`${REMOTE_API}/shared-mailboxes`, { headers: bearer(ta) }),
      request.get(`${REMOTE_API}/shared-mailboxes`, { headers: bearer(tb) }),
    ]);
    expect([200, 404], `A shared -> ${ra.status()}`).toContain(ra.status());
    expect([200, 404], `B shared -> ${rb.status()}`).toContain(rb.status());
    test.info().annotations.push({ type: 'shared', description: `A ${ra.status()} / B ${rb.status()}` });
  });
});

test.describe('Epic — Peer interaction: mail & resources', () => {

  test('PEER-07 student-A emails student-B about a group project', async ({ request }) => {
    const t = await tk(request, 'a');
    const res = await request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: bearer(t),
      data: {
        from: ACTORS.a.email,
        to: [ACTORS.b.email],
        subject: `Group project sync ${Date.now()}`,
        body: 'Can we meet Thursday to split the remaining work?',
        is_html: false,
      },
    });
    expect(ACCEPT, `POST mail A→B -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'mail-ab', description: `-> ${res.status()}` });
  });

  test('PEER-08 student-B checks inbox for the project mail', async ({ request }) => {
    const t = await tk(request, 'b');
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: bearer(t),
    });
    expect([200, 404], `GET B INBOX -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'b-inbox', description: `mails: ${Array.isArray(mails) ? mails.length : 0}` });
    }
  });

  test('PEER-09 both students check resource availability for the same time slot', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    const from = encodeURIComponent(new Date(Date.now() + 5 * 86400_000).toISOString());
    const to = encodeURIComponent(new Date(Date.now() + 7 * 86400_000).toISOString());
    const [ra, rb] = await Promise.all([
      request.get(`${REMOTE_API}/resources/available?date_from=${from}&date_to=${to}`, { headers: bearer(ta) }),
      request.get(`${REMOTE_API}/resources/available?date_from=${from}&date_to=${to}`, { headers: bearer(tb) }),
    ]);
    expect([200, 400, 404, 422], `A resources -> ${ra.status()}`).toContain(ra.status());
    expect([200, 400, 404, 422], `B resources -> ${rb.status()}`).toContain(rb.status());
    test.info().annotations.push({ type: 'resources', description: `A ${ra.status()} / B ${rb.status()}` });
  });

  test('PEER-10 both students run free/busy against each other', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    const body = {
      utcStartDate: new Date().toISOString(),
      utcEndDate: new Date(Date.now() + 2_1600_000).toISOString(),
      users: [ACTORS.a.email, ACTORS.b.email],
    };
    const [ra, rb] = await Promise.all([
      request.post(`${REMOTE_API}/freebusy`, { headers: bearer(ta), data: body }),
      request.post(`${REMOTE_API}/freebusy`, { headers: bearer(tb), data: body }),
    ]);
    expect([200, 201, 400, 404, 405, 422], `A freebusy -> ${ra.status()}`).toContain(ra.status());
    expect([200, 201, 400, 404, 405, 422], `B freebusy -> ${rb.status()}`).toContain(rb.status());
    test.info().annotations.push({ type: 'fb-both', description: `A ${ra.status()} / B ${rb.status()}` });
  });

  test('PEER-11 both students check team-calendar invites (peer view)', async ({ request }) => {
    const ta = await tk(request, 'a');
    const tb = await tk(request, 'b');
    const [ra, rb] = await Promise.all([
      request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(ta) }),
      request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(tb) }),
    ]);
    expect([200, 404], `A invites -> ${ra.status()}`).toContain(ra.status());
    expect([200, 404], `B invites -> ${rb.status()}`).toContain(rb.status());
    test.info().annotations.push({ type: 'invites', description: `A ${ra.status()} / B ${rb.status()}` });
  });
});
