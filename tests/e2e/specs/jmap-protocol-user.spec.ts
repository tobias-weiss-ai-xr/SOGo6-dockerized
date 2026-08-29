// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// User-side JMAP protocol suite (RFC 8620) against the LOCAL stack.
//
// JMAP is a user mail protocol and is mounted under /api/user/v1/jmap (it was
// moved there from the admin API, where g.user is anonymous and every mail
// method failed). It resolves the caller's real mail account: the session
// advertises the main-account id "0" (cs.DEFAULT_IDENTITY_KEY_VALUE), and
// clients MUST send `accountId` at the TOP LEVEL of the request body
// (RFC 8620 §2.1) — not nested inside methodCalls.
//
// These tests exercise the real running stack: session/status resources and a
// Mailbox/get that returns the caller's actual IMAP folders (INBOX, ...).
//
//   npx playwright test jmap-protocol-user.spec.ts

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

test.describe('JMAP user protocol @local', () => {
  test('session advertises capabilities, apiUrl and the main account id "0"', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/jmap/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const session = await res.json();
    expect(session.capabilities?.['urn:ietf:params:jmap:core']).toBeDefined();
    expect(session.apiUrl).toBe('/jmap');
    expect(session.accounts?.['0']).toBeTruthy();
    expect(session.primaryAccounts?.['urn:ietf:params:jmap:mail']).toBe('0');
    expect(session.username).toBe(USER.email);
    expect(session.uploadUrl).toContain('/jmap/upload/');
    expect(session.downloadUrl).toContain('/jmap/download/');
  });

  test('status reports the protocol enabled', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/jmap/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data?.enabled).toBe(true);
    expect(Array.isArray(body.data?.capabilities)).toBe(true);
    expect(body.data.capabilities.length).toBeGreaterThan(0);
  });

  test('Mailbox/get returns real folders (accountId at top level, RFC 8620 §2.1)', async ({ request }) => {
    const res = await request.post(`${API}/api/user/v1/jmap`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: '0',
        methodCalls: [['Mailbox/get', { ids: null }, '0']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    expect(Array.isArray(env.methodResponses)).toBe(true);
    const [name, result, callId] = env.methodResponses[0];
    expect(name).toBe('Mailbox/get');
    expect(callId).toBe('0');
    expect(result.accountId).toBe('0');
    const names = (result.list ?? []).map((m: any) => m.name);
    expect(names).toContain('INBOX');
  });

  test('omitting urn:ietf:params:jmap:core yields an unknownCapability method error', async ({ request }) => {
    const res = await request.post(`${API}/api/user/v1/jmap`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: [],
        methodCalls: [['Mailbox/get', { ids: null }, '0']],
      },
    });
    expect(res.status()).toBe(200); // protocol-level error, not HTTP 4xx
    const env = await res.json();
    const [name, err] = env.methodResponses[0];
    expect(name).toBe('error');
    expect(err.type).toBe('unknownCapability');
  });

  test('accountId must be the main-account id "0", not the user email', async ({ request }) => {
    // RFC clients copy accountId from the session. Passing the email instead
    // must NOT resolve to a mailbox (external-account lookup fails) — this
    // documents why the session advertises "0" rather than the uid.
    const res = await request.post(`${API}/api/user/v1/jmap`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: USER.email,
        methodCalls: [['Mailbox/get', { ids: null }, '0']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, err] = env.methodResponses[0];
    expect(name).toBe('error');
    expect(err.description ?? '').toContain('External Account');
  });

  test('JMAP is no longer reachable under the admin API', async ({ request }) => {
    // We moved JMAP to the user API: the admin context has no real g.user, so
    // the gateway could never build there. Assert the admin URL no longer
    // serves a JMAP session resource.
    const res = await request.get(`${API}/api/admin/v1/jmap/session`);
    const body = await res.json().catch(() => ({}));
    const is4xx = [401, 403, 404].includes(res.status());
    const notASession = body.capabilities == null;
    expect(is4xx || notASession).toBe(true);
  });
});
