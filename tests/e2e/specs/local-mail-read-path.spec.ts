// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// User mail read path against the LOCAL stack: mailboxes, IMAP folder tree,
// profile identities and preferences. These are the REST endpoints the UI
// drive the mail module with; exercising them locally catches regressions in
// the dev stack (the remote suite already covers the live demo).
//
//   npx playwright test local-mail-read-path.spec.ts

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/user/v1/auth/login`, {
    data: { username: USER.email, password: USER.password },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

test.describe('local mail read path @local', () => {
  test('mailboxes exposes the main account', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/mailboxes`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).not.toBeFalsy();
  });

  test('folders lists the IMAP folder tree of the main account', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const folder = body.data.find((f: any) => f.name === 'INBOX');
    expect(folder).toBeTruthy();
    expect(typeof folder.message_count).toBe('number');
  });

  test('profile exposes the mail identity and main mailbox', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/profile`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const identities = body.data?.mailboxes?.[0]?.identities ?? [];
    expect(identities.length).toBeGreaterThan(0);
    expect(identities[0].mail).toBe(USER.email);
  });

  test('preferences are served', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/preferences`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });
});
