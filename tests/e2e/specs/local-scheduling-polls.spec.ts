// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Scheduling polls (@local): create time-slot polls with external participant
// emails, participants respond anonymously (capability by poll id), results
// aggregate votes and pick the best slot.
// Regressions for bug #37 (respond required auth though participants are
// external emails) and bug #38 (expires_at was stored but never enforced).

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;

const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PARTICIPANTS = [`alice.${STAMP}@example.org`, `bob.${STAMP}@example.org`];

let userToken = '';
let pollId = '';

const auth = () => ({ Authorization: `Bearer ${userToken}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  userToken = (await login.json()).data.jwt_token;
});

test.describe('local scheduling polls @local @polls', () => {
  test('SP-01 create returns an open poll with token', async ({ request }) => {
    const res = await request.post(`${USER_API}/polls`, {
      headers: json(),
      data: {
        title: `[local-e2e] poll ${STAMP}`,
        time_slots: [
          { start: '2026-10-22T12:00:00Z', end: '2026-10-22T13:00:00Z' },
          { start: '2026-10-23T12:00:00Z', end: '2026-10-23T13:00:00Z' },
        ],
        participants: PARTICIPANTS,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const poll = (await res.json()).data;
    pollId = poll.id;
    expect(poll.status).toBe('open');
    expect(poll.time_slots).toHaveLength(2);
    expect(poll.participants).toEqual(PARTICIPANTS);
    expect(poll.responses).toEqual([]);
    expect(poll.token).toBeTruthy();
  });

  test('SP-02 the poll appears in the owner list', async ({ request }) => {
    const res = await request.get(`${USER_API}/polls`, { headers: auth() });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.polls.some((p: any) => p.id === pollId)).toBe(true);
  });

  test('SP-03 create validation: empty time_slots / missing participants -> 422', async ({ request }) => {
    const empty = await request.post(`${USER_API}/polls`, {
      headers: json(),
      data: { title: 'x', time_slots: [], participants: ['a@example.org'] },
    });
    expect(empty.status()).toBe(422);
    const missing = await request.post(`${USER_API}/polls`, {
      headers: json(),
      data: { title: 'x', time_slots: [{ start: '2026-10-22T12:00:00Z', end: '2026-10-22T13:00:00Z' }] },
    });
    expect(missing.status()).toBe(422);
  });

  test('SP-04 anonymous participants can respond (bug #37)', async ({ request }) => {
    for (const [i, participant] of PARTICIPANTS.entries()) {
      const res = await request.post(`${USER_API}/polls/${pollId}/respond`, {
        headers: { 'Content-Type': 'application/json' },
        data: { participant, available_slots: ['0', ...(i === 0 ? ['1'] : [])] },
      });
      expect(res.status(), `${participant}: ${await res.text()}`).toBe(200);
      expect((await res.json()).data.status).toBe('recorded');
    }
  });

  test('SP-05 slot indices must be strings; ints are a 422 trap', async ({ request }) => {
    const res = await request.post(`${USER_API}/polls/${pollId}/respond`, {
      headers: { 'Content-Type': 'application/json' },
      data: { participant: PARTICIPANTS[0], available_slots: [0, 1] },
    });
    expect(res.status()).toBe(422);
  });

  test('SP-06 a non-participant email is rejected (404 S000531)', async ({ request }) => {
    const res = await request.post(`${USER_API}/polls/${pollId}/respond`, {
      headers: { 'Content-Type': 'application/json' },
      data: { participant: `outsider.${STAMP}@example.org`, available_slots: ['0'] },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error_code).toBe('S000531');
  });

  test('SP-07 re-voting replaces the previous response', async ({ request }) => {
    const before = await (await request.get(`${USER_API}/polls/${pollId}/results`, { headers: auth() })).json();
    const countBefore = before.data.poll.responses.length;

    const res = await request.post(`${USER_API}/polls/${pollId}/respond`, {
      headers: { 'Content-Type': 'application/json' },
      data: { participant: PARTICIPANTS[0], available_slots: ['1'] },
    });
    expect(res.status()).toBe(200);

    const after = await (await request.get(`${USER_API}/polls/${pollId}/results`, { headers: auth() })).json();
    const responses = after.data.poll.responses;
    expect(responses).toHaveLength(countBefore); // replaced, not appended
    const mine = responses.filter((r: any) => r.participant === PARTICIPANTS[0]);
    expect(mine).toHaveLength(1);
    expect(mine[0].available_slots).toEqual(['1']);
  });

  test('SP-08 results aggregate votes and pick the best slot', async ({ request }) => {
    // second participant switches to slot 1 too -> unambiguous winner
    const revote = await request.post(`${USER_API}/polls/${pollId}/respond`, {
      headers: { 'Content-Type': 'application/json' },
      data: { participant: PARTICIPANTS[1], available_slots: ['1'] },
    });
    expect(revote.status()).toBe(200);

    const res = await request.get(`${USER_API}/polls/${pollId}/results`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.participant_count).toBe(2);
    expect(data.response_count).toBe(2); // both re-votes replaced, not appended
    expect(data.best_slot).toBe('1');
    expect(data.slot_counts['1']).toBe(2);
  });

  test('SP-09 results of an unknown poll -> 404', async ({ request }) => {
    const res = await request.get(`${USER_API}/polls/does-not-exist/results`, { headers: auth() });
    expect(res.status()).toBe(404);
  });

  test('SP-10 expired polls reject votes (bug #38)', async ({ request }) => {
    const created = await request.post(`${USER_API}/polls`, {
      headers: json(),
      data: {
        title: `[local-e2e] expired ${STAMP}`,
        time_slots: [{ start: '2026-10-22T12:00:00Z', end: '2026-10-22T13:00:00Z' }],
        participants: [PARTICIPANTS[0]],
        expires_at: 1000000, // 1970 — long past
      },
    });
    expect(created.status()).toBe(201);
    const expiredId = ((await created.json()).data ?? {}).id;

    const res = await request.post(`${USER_API}/polls/${expiredId}/respond`, {
      headers: { 'Content-Type': 'application/json' },
      data: { participant: PARTICIPANTS[0], available_slots: ['0'] },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error_code).toBe('S000530');
  });
});
