// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// JMAP protocol suite against the LIVE SOGo6 demo
// (https://sogo6.contextual-intelligence.org).
//
// The demo currently mounts JMAP under the ADMIN API only — it predates the
// user-API move (see specs/jmap-protocol-user.spec.ts, which covers the LOCAL
// stack where JMAP lives under /api/user/v1/jmap and reads real mailboxes).
// While it remains deployed that way, this suite pins the demo's live surface:
// session/status resources, Core/echo (RFC 8620 §2.2), capability validation,
// and the documented `accountNotFound` for mail methods in the no-user admin
// context. When the server fix is deployed to the demo, re-point this suite at
// the user API (see the local spec for the expected behavior).
//
// All assertions are read-only (GET session/status + idempotent POST dispatch).
//
//   npx playwright test jmap-protocol-remote.spec.ts

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const JMAP_BASE = `${REMOTE_BASE}/api/admin/v1/jmap`;
const API = `${REMOTE_BASE}/api/admin/v1`;

let adminToken = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/auth/login`, {
    data: {
      username: REMOTE_CREDENTIALS.admin.username,
      password: REMOTE_CREDENTIALS.admin.password,
    },
  });
  const body = await res.json();
  adminToken = body?.data?.jwt_token ?? '';
  expect(adminToken, 'admin login must return a JWT').toBeTruthy();
});

test.describe('JMAP protocol on the live demo (admin context) @remote', () => {
  test('session advertises core capabilities and apiUrl', async ({ request }) => {
    const res = await request.get(`${JMAP_BASE}/session`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const session = await res.json();
    expect(session.capabilities?.['urn:ietf:params:jmap:core']).toBeDefined();
    expect(session.apiUrl).toBe('/jmap');
    expect(typeof session.username).toBe('string');
    expect(session.uploadUrl).toContain('/jmap/upload/');
    expect(session.downloadUrl).toContain('/jmap/download/');
  });

  test('status reports the protocol enabled with capabilities', async ({ request }) => {
    const res = await request.get(`${JMAP_BASE}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data?.enabled).toBe(true);
    expect(Array.isArray(body.data?.capabilities)).toBe(true);
    expect(body.data.capabilities.length).toBeGreaterThan(0);
    // The demo advertises the mail + submission extension capabilities.
    expect(body.data.capabilities).toContain('urn:ietf:params:jmap:mail');
  });

  test('Core/echo echoes arguments verbatim (RFC 8620 §2.2)', async ({ request }) => {
    const payload = { hello: 'e2e-roundtrip', n: 42, nested: { ok: true } };
    const res = await request.post(`${JMAP_BASE}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
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
      headers: { Authorization: `Bearer ${adminToken}` },
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

  test('mail methods without a real user context are a documented accountNotFound error', async ({ request }) => {
    // The demo mounts JMAP under the admin API, where no real mail account is
    // bound. The server must answer with a *method* error (HTTP 200 envelope),
    // never a 5xx — this pins that contract. The local stack resolves this by
    // serving JMAP under the user API (see jmap-protocol-user.spec.ts).
    const res = await request.post(`${JMAP_BASE}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: 'default',
        methodCalls: [['Mailbox/get', { ids: null }, 'c1']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, err] = env.methodResponses[0];
    expect(name).toBe('error');
    expect(err.type).toBe('accountNotFound');
    test.info().annotations.push({
      type: 'issue',
      description:
        'accountNotFound is expected here: admin-context JMAP has no mail account. Fixed on local stack by mounting JMAP under the user API.',
    });
  });
});
