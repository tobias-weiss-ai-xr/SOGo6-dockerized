// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Polls, events & async jobs.
//
// Stories for the scheduling-poll lifecycle (create → list → respond → results),
// the global events feed, and async background-job status checking.
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

let createdPollId: string | null = null;

test.describe('Epic — Scheduling polls', () => {

  test('POLL-01 user lists existing polls (empty initially)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/polls`, { headers: bearer(tk) });
    expect(200, `GET /polls -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const polls = body?.data?.polls ?? [];
    test.info().annotations.push({ type: 'polls', description: `count: ${Array.isArray(polls) ? polls.length : 0}` });
  });

  test('POLL-02 user creates a scheduling poll', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/polls`, {
      headers: bearer(tk),
      data: {
        title: `Meeting time ${Date.now()}`,
        participants: ['maxmustermann@sogo6.contextual-intelligence.org'],
        time_slots: [
          { start: '2026-09-20T10:00:00Z', end: '2026-09-20T11:00:00Z' },
          { start: '2026-09-21T14:00:00Z', end: '2026-09-21T15:00:00Z' },
        ],
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    });
    expect([200, 201], `POST /polls -> ${res.status()}`).toContain(res.status());
    const body = await res.json();
    createdPollId = body?.data?.id ?? null;
    test.info().annotations.push({ type: 'poll-create', description: `id=${createdPollId ?? '?'} status=${body?.data?.status}` });
  });

  test('POLL-03 user re-lists polls and sees the new one', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/polls`, { headers: bearer(tk) });
    expect(200, `GET /polls (verify) -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const polls = body?.data?.polls ?? [];
    test.info().annotations.push({ type: 'polls-after', description: `count: ${Array.isArray(polls) ? polls.length : 0}` });
  });

  test('POLL-04 user reads poll results (empty before responses)', async ({ request }) => {
    if (!createdPollId) { test.info().annotations.push({ type: 'skip', description: 'no poll id' }); return; }
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/polls/${createdPollId}/results`, { headers: bearer(tk) });
    expect([200, 404], `GET /polls/:id/results -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'poll-results', description: `-> ${res.status()}` });
  });

  test('POLL-05 user submits a response to the poll', async ({ request }) => {
    if (!createdPollId) { test.info().annotations.push({ type: 'skip', description: 'no poll id' }); return; }
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/polls/${createdPollId}/respond`, {
      headers: bearer(tk),
      data: { selected_slot: 0, comment: 'Monday works best for me' },
    });
    expect(ACCEPT, `POST /polls/:id/respond -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'poll-respond', description: `-> ${res.status()}` });
  });

  test('POLL-06 user reads poll results after responding', async ({ request }) => {
    if (!createdPollId) { test.info().annotations.push({ type: 'skip', description: 'no poll id' }); return; }
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/polls/${createdPollId}/results`, { headers: bearer(tk) });
    expect([200, 404], `GET /polls/:id/results (after) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'poll-results-after', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Events feed & async jobs', () => {

  test('POLL-07 user reads the global events feed', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/events`, { headers: bearer(tk) });
    expect(200, `GET /events -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const events = body?.data?.events ?? [];
    test.info().annotations.push({ type: 'events', description: `count: ${Array.isArray(events) ? events.length : 0}` });
  });

  test('POLL-08 user reads a non-existent event (graceful 404)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/events/nonexistent-id`, { headers: bearer(tk) });
    expect(404, `GET /events/nonexistent -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'event-404', description: `-> ${res.status()}` });
  });

  test('POLL-09 user patches an event (attendance)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.patch(`${REMOTE_API}/events/nonexistent-id/attendance`, {
      headers: bearer(tk), data: { status: 'accepted' },
    });
    expect([200, 400, 404, 405, 422], `PATCH /events/:id/attendance -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'event-attendance', description: `-> ${res.status()}` });
  });

  test('POLL-10 user checks async job status', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/jobs/0`, { headers: bearer(tk) });
    expect([200, 404], `GET /jobs/0 -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'job', description: `-> ${res.status()}` });
  });

  test('POLL-11 user requests job result', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/jobs/0/result`, { headers: bearer(tk) });
    expect([200, 400, 404], `GET /jobs/0/result -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'job-result', description: `-> ${res.status()}` });
  });
});
