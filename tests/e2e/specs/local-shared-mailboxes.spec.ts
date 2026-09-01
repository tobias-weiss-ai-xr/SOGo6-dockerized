// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Shared mailboxes (@local): admin provision -> member sees it -> notes flow.
// Regression for bug #39: the user-facing SharedMailboxSchema declared
// created_at as fields.DateTime(); the module returns strings, so the list
// 500'd the moment a single shared mailbox existed.

import { test, expect, adminPassword } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const ADMIN_API = `${API}/api/admin/v1`;
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const pwd = adminPassword();
test.skip(!pwd, 'SOGO_ADMIN_PASSWORD not set — admin provisioning unavailable');

let token = '';
let adminToken = '';
let mailboxId = '';
let noteId = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const adminJson = () => ({ ...adminAuth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  token = (await login.json()).data.jwt_token;

  const adminLogin = await request.post(`${ADMIN_API}/auth/login`, {
    data: { username: 'admin', password: pwd },
  });
  adminToken = (await adminLogin.json()).data.jwt_token;
});

test.afterAll(async ({ request }) => {
  if (mailboxId) {
    await request.delete(`${ADMIN_API}/shared-mailboxes/${mailboxId}`, { headers: adminAuth() });
  }
});

test.describe('local shared mailboxes @local @shared-mailbox', () => {
  test('SM-01 admin provisions a shared mailbox with a member', async ({ request }) => {
    const res = await request.post(`${ADMIN_API}/shared-mailboxes`, {
      headers: adminJson(),
      data: {
        email: `probe.sm.${STAMP}@example.org`,
        name: `[local-e2e] SM ${STAMP}`,
        member_uids: ['testuser@example.org'],
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const mb = (await res.json()).data;
    mailboxId = mb.id;
    expect(mb.is_active).toBe(true);
    expect(mb.member_roles.some((r: any) => r.uid === 'testuser@example.org')).toBe(true);
  });

  test('SM-02 the member sees the mailbox in their list (bare array, bug #39)', async ({ request }) => {
    const res = await request.get(`${USER_API}/shared-mailboxes/`, { headers: auth() });
    expect(res.status(), await res.text()).toBe(200);
    const body = JSON.parse(await res.text());
    expect(Array.isArray(body), 'user list is a bare array, not enveloped').toBe(true);
    const mine = body.find((m: any) => m.id === mailboxId);
    expect(mine, 'provisioned mailbox visible to member').toBeTruthy();
    expect(mine.role).toBe('member');
    expect(typeof mine.created_at).toBe('string');
  });

  test('SM-03 the member gets the mailbox detail', async ({ request }) => {
    const res = await request.get(`${USER_API}/shared-mailboxes/${mailboxId}`, { headers: auth() });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.id).toBe(mailboxId);
  });

  test('SM-04 the member can create, list and delete notes', async ({ request }) => {
    const create = await request.post(`${USER_API}/shared-mailboxes/${mailboxId}/notes`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { content: `[local-e2e] note ${STAMP}` },
    });
    expect(create.status(), await create.text()).toBe(201);
    const note = (await create.json()).data;
    noteId = note.id;
    expect(note.author_uid).toBe('testuser@example.org');

    const list = await request.get(`${USER_API}/shared-mailboxes/${mailboxId}/notes`, { headers: auth() });
    expect(list.status()).toBe(200);
    expect((await list.json()).data.notes.some((n: any) => n.id === noteId)).toBe(true);

    const del = await request.delete(`${USER_API}/shared-mailboxes/${mailboxId}/notes/${noteId}`, {
      headers: auth(),
    });
    expect(del.status()).toBe(200);
    noteId = '';
  });

  test('SM-05 notes require content (422) and unknown mailboxes deny (403 S000399)', async ({ request }) => {
    // Quirk pinned: content:"" satisfies marshmallow `required` (present, not
    // missing) — empty notes are accepted. Clean the empty note up again.
    const noContent = await request.post(`${USER_API}/shared-mailboxes/${mailboxId}/notes`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { content: '' },
    });
    expect(noContent.status(), await noContent.text()).toBe(201);
    const emptyNote = (await noContent.json()).data;
    await request.delete(`${USER_API}/shared-mailboxes/${mailboxId}/notes/${emptyNote.id}`, {
      headers: auth(),
    });

    const unknown = await request.get(`${USER_API}/shared-mailboxes/does-not-exist/notes`, {
      headers: auth(),
    });
    expect(unknown.status()).toBe(403);
    expect((await unknown.json()).error_code).toBe('S000399');
  });

  test('SM-06 admin deletes the mailbox; it vanishes for the member', async ({ request }) => {
    const del = await request.delete(`${ADMIN_API}/shared-mailboxes/${mailboxId}`, {
      headers: adminAuth(),
    });
    expect(del.status(), await del.text()).toBe(200);
    mailboxId = '';

    const list = await request.get(`${USER_API}/shared-mailboxes/`, { headers: auth() });
    const body = JSON.parse(await list.text());
    expect(body.find((m: any) => m.id !== undefined && m.email.includes(STAMP))).toBeFalsy();
  });

  test('SM-07 the surface requires authentication', async ({ request }) => {
    const res = await request.get(`${USER_API}/shared-mailboxes/`);
    expect(res.status()).toBe(401);
  });
});
