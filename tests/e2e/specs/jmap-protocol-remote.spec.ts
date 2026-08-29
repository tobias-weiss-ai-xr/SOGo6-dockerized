// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// JMAP protocol suite against the LIVE SOGo6 demo
// (https://sogo6.contextual-intelligence.org).
//
// The demo now runs the fixed server image: JMAP lives under
// /api/user/v1/jmap (user context, like the local stack) and Mailbox/get
// returns the caller's real IMAP folders. This suite pins that live surface:
// session/status resources, RFC 8620 §2.1 top-level accountId handling, real
// mailbox listing, capability validation, and proof that JMAP is gone from the
// admin API (the pre-fix location).
//
// All assertions are read-only (GET session/status + idempotent POST dispatch).
//
//   npx playwright test jmap-protocol-remote.spec.ts

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const JMAP_BASE = `${REMOTE_BASE}/api/user/v1/jmap`;
const API = `${REMOTE_BASE}/api/user/v1`;

let token = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/auth/login`, {
    data: {
      username: REMOTE_CREDENTIALS.user.email,
      password: REMOTE_CREDENTIALS.user.password,
    },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();
});

test.describe('JMAP protocol on the live demo (user API) @remote', () => {
  test('session advertises core capabilities and the main account id "0"', async ({ request }) => {
    const res = await request.get(`${JMAP_BASE}/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const session = await res.json();
    expect(session.capabilities?.['urn:ietf:params:jmap:core']).toBeDefined();
    expect(session.apiUrl).toBe('/jmap');
    expect(session.accounts?.['0']).toBeTruthy();
    expect(session.primaryAccounts?.['urn:ietf:params:jmap:mail']).toBe('0');
    expect(session.uploadUrl).toContain('/jmap/upload/');
    expect(session.downloadUrl).toContain('/jmap/download/');
  });

  test('status reports the protocol enabled with capabilities', async ({ request }) => {
    const res = await request.get(`${JMAP_BASE}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data?.enabled).toBe(true);
    expect(Array.isArray(body.data?.capabilities)).toBe(true);
    expect(body.data.capabilities).toContain('urn:ietf:params:jmap:mail');
  });

  test('Mailbox/get returns the caller real folders (top-level accountId, RFC 8620 §2.1)', async ({ request }) => {
    const res = await request.post(`${JMAP_BASE}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: '0',
        methodCalls: [['Mailbox/get', { ids: null }, '0']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, result, callId] = env.methodResponses[0];
    expect(name).toBe('Mailbox/get');
    expect(callId).toBe('0');
    expect(result.accountId).toBe('0');
    const names = (result.list ?? []).map((m: any) => m.name);
    expect(names).toContain('INBOX');
  });

  test('core/echo echoes arguments verbatim (RFC 8620 §2.2)', async ({ request }) => {
    const payload = { hello: 'e2e-roundtrip', n: 42, nested: { ok: true } };
    const res = await request.post(`${JMAP_BASE}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: ['urn:ietf:params:jmap:core'],
        methodCalls: [['Core/echo', payload, 'c1']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, result, callId] = env.methodResponses[0];
    expect(name).toBe('Core/echo');
    expect(callId).toBe('c1');
    expect(result).toEqual(payload);
  });

  test('omitting urn:ietf:params:jmap:core yields an unknownCapability method error', async ({ request }) => {
    const res = await request.post(`${JMAP_BASE}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: [],
        methodCalls: [['Core/echo', { a: 1 }, 'c2']],
      },
    });
    expect(res.status()).toBe(200); // protocol-level error, not HTTP 4xx
    const env = await res.json();
    const [name, err] = env.methodResponses[0];
    expect(name).toBe('error');
    expect(err.type).toBe('unknownCapability');
  });

  test('accountId must be the main-account id "0", not the user email', async ({ request }) => {
    const res = await request.post(`${JMAP_BASE}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: REMOTE_CREDENTIALS.user.email,
        methodCalls: [['Mailbox/get', { ids: null }, '0']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, err] = env.methodResponses[0];
    expect(name).toBe('error');
    expect(err.description ?? '').toContain('External Account');
  });

  test('JMAP is no longer reachable under the admin API (moved to the user API)', async ({ request }) => {
    const res = await request.get(`${REMOTE_BASE}/api/admin/v1/jmap/session`);
    const body = await res.json().catch(() => ({}));
    const is4xx = [401, 403, 404].includes(res.status());
    const notASession = body.capabilities == null;
    expect(is4xx || notASession).toBe(true);
  });
});
