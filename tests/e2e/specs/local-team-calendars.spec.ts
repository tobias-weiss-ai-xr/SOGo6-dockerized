// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Team calendars (@local): create/detail/list, direct member add (user_uid +
// share_level enum), invite flow (pending -> accept -> member, reject),
// member patch/remove, team delete.
// Regression for bug #41: accept/reject 500'd — the invite repo passed a
// row-nested values_list to update_in_table (flat per-column list expected).

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let token = '';
let token2 = '';
let teamId = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const auth2 = () => ({ Authorization: `Bearer ${token2}` });
const json = (t = token) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  for (const [user, setter] of [
    ['testuser@example.org', (v: string) => { token = v; }],
    ['testuser2@example.org', (v: string) => { token2 = v; }],
  ] as const) {
    const login = await request.post(`${USER_API}/auth/login`, {
      data: { username: user, password: 'password123' },
    });
    expect(login.status()).toBe(200);
    setter((await login.json()).data.jwt_token);
  }
});

test.afterAll(async ({ request }) => {
  // Failure-safe cleanup: re-derive the team by unique name if state was lost.
  const list = await request.get(`${USER_API}/calendars/teams`, { headers: auth() });
  const teams = (await list.json()).data.calendars;
  for (const t of teams) {
    if (t.name.includes(STAMP)) {
      await request.delete(`${USER_API}/calendars/teams/${t.key}`, { headers: auth() });
    }
  }
});

test.describe('local team calendars @local @team-cal', () => {
  test('TC-01 create a team calendar (source_type team)', async ({ request }) => {
    const res = await request.post(`${USER_API}/calendars/teams`, {
      headers: json(),
      data: { name: `[local-e2e] team ${STAMP}`, description: `e2e ${STAMP}` },
    });
    expect(res.status(), await res.text()).toBe(201);
    const team = (await res.json()).data;
    teamId = team.key;
    expect(team.source_type).toBe('team');
    expect(team.is_default).toBe(false);
    expect(team.include_in_freebusy).toBe(true);
  });

  test('TC-02 team detail and list', async ({ request }) => {
    const detail = await request.get(`${USER_API}/calendars/teams/${teamId}`, { headers: auth() });
    expect(detail.status()).toBe(200);
    expect((await detail.json()).data.name).toContain(STAMP);

    const list = await request.get(`${USER_API}/calendars/teams`, { headers: auth() });
    expect(list.status()).toBe(200);
    const data = (await list.json()).data;
    expect(data.calendars.some((c: any) => c.key === teamId)).toBe(true);
    expect(data.total_count).toBeGreaterThan(0);
  });

  test('TC-03 add a member directly (user_uid + share_level enum)', async ({ request }) => {
    const res = await request.post(`${USER_API}/calendars/teams/${teamId}/members`, {
      headers: json(),
      data: { user_uid: 'testuser2@example.org', share_level: 'modify' },
    });
    expect(res.status(), await res.text()).toBe(201);
    const member = (await res.json()).data;
    expect(member.user_uid).toBe('testuser2@example.org');
    expect(member.share_level).toBe('modify');
    expect(member.can_create).toBe(true);
    expect(member.can_delete).toBe(true);
  });

  test('TC-04 the member now sees the team', async ({ request }) => {
    const list = await request.get(`${USER_API}/calendars/teams`, { headers: auth2() });
    expect(list.status()).toBe(200);
    expect((await list.json()).data.calendars.some((c: any) => c.key === teamId)).toBe(true);
  });

  test('TC-05 invalid share_level -> 422 with enum message', async ({ request }) => {
    const res = await request.post(`${USER_API}/calendars/teams/${teamId}/members`, {
      headers: json(),
      data: { user_uid: 'x@example.org', share_level: 'admin' },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors.json.share_level[0]).toContain('view_all');
  });

  test('TC-06 invite -> pending, then accept adds the member (bug #41)', async ({ request }) => {
    // invite on a second, fresh team so the accept path is exercised cleanly
    const created = await request.post(`${USER_API}/calendars/teams`, {
      headers: json(),
      data: { name: `[local-e2e] invite team ${STAMP}` },
    });
    expect(created.status()).toBe(201);
    const inviteTeamId = (await created.json()).data.key;

    const invited = await request.post(`${USER_API}/calendars/teams/${inviteTeamId}/invites`, {
      headers: json(),
      data: { user_uid: 'testuser2@example.org', share_level: 'view_all' },
    });
    expect(invited.status(), await invited.text()).toBe(201);
    const invite = (await invited.json()).data;
    expect(invite.status).toBe('pending');
    expect(invite.invited_by).toBe('testuser@example.org');

    const mine = await request.get(`${USER_API}/calendars/teams/invites`, { headers: auth2() });
    expect(mine.status()).toBe(200);
    const pending = (await mine.json()).data.invites.find((i: any) => i.id === invite.id);
    expect(pending, 'invite must appear in the invitee list').toBeTruthy();

    const accept = await request.post(
      `${USER_API}/calendars/teams/invites/${invite.id}/accept`,
      { headers: json(token2), data: {} },
    );
    expect(accept.status(), await accept.text()).toBe(200);
    const member = (await accept.json()).data;
    expect(member.user_uid).toBe('testuser2@example.org');
    expect(member.share_level).toBe('view_all');
    expect(member.can_create).toBe(false);

    const members = await request.get(`${USER_API}/calendars/teams/${inviteTeamId}/members`, {
      headers: auth(),
    });
    expect((await members.json()).data.members.some((m: any) => m.user_uid === 'testuser2@example.org'))
      .toBe(true);
  });

  test('TC-07 invite -> reject stays rejected and adds no member', async ({ request }) => {
    const created = await request.post(`${USER_API}/calendars/teams`, {
      headers: json(),
      data: { name: `[local-e2e] reject team ${STAMP}` },
    });
    const rejectTeamId = (await created.json()).data.key;

    const invite = (await (await request.post(`${USER_API}/calendars/teams/${rejectTeamId}/invites`, {
      headers: json(),
      data: { user_uid: 'testuser2@example.org', share_level: 'respond' },
    })).json()).data;

    const reject = await request.post(
      `${USER_API}/calendars/teams/invites/${invite.id}/reject`,
      { headers: json(token2), data: {} },
    );
    expect(reject.status(), await reject.text()).toBe(200);
    expect((await reject.json()).data.status).toBe('rejected');

    const members = await request.get(`${USER_API}/calendars/teams/${rejectTeamId}/members`, {
      headers: auth(),
    });
    expect((await members.json()).data.members.some((m: any) => m.user_uid === 'testuser2@example.org'))
      .toBe(false);
  });

  test('TC-08 patch a member share_level', async ({ request }) => {
    const res = await request.patch(
      `${USER_API}/calendars/teams/${teamId}/members/testuser2@example.org`,
      { headers: json(), data: { share_level: 'view_all' } },
    );
    expect(res.status(), await res.text()).toBe(200);
    const member = (await res.json()).data;
    expect(member.share_level).toBe('view_all');
    expect(member.can_delete).toBe(false);
  });

  test('TC-09 remove the member; unknown team -> 404', async ({ request }) => {
    const del = await request.delete(
      `${USER_API}/calendars/teams/${teamId}/members/testuser2@example.org`,
      { headers: auth() },
    );
    expect(del.status()).toBe(200);
    const members = await request.get(`${USER_API}/calendars/teams/${teamId}/members`, { headers: auth() });
    expect((await members.json()).data.total_count).toBe(0);

    const unknown = await request.get(
      `${USER_API}/calendars/teams/00000000-0000-0000-0000-000000000000`,
      { headers: auth() },
    );
    expect(unknown.status()).toBe(404);
  });

  test('TC-10 delete the team; it disappears from the list', async ({ request }) => {
    const del = await request.delete(`${USER_API}/calendars/teams/${teamId}`, { headers: auth() });
    expect(del.status()).toBe(200);
    const list = await request.get(`${USER_API}/calendars/teams`, { headers: auth() });
    expect((await list.json()).data.calendars.some((c: any) => c.key === teamId)).toBe(false);
    teamId = '';
  });
});
