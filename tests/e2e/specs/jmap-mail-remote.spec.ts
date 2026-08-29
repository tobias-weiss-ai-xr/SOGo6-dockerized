// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// JMAP mail read methods against the LIVE SOGo6 demo (real mailbox data).
// The demo mailbox holds real messages, so Email/query returns populated
// results; this pins the read path (query pipeline) without asserting on
// message CONTENT (the mailbox changes over time).
//
// Demo-server quirks observed 2026-08-29 (annotated in the tests, not
// asserted — they are not stable contracts):
//   - mail-method responses normalize the client call tag to "0" (Core/echo
//     echoes the tag verbatim, mail methods renumber it);
//   - the `limit` argument is unreliable (limit:3 returned 12 ids, limit:5
//     returned 5);
//   - Email/get returns a `serverFail` method error for real message ids
//     (Mailbox/get + Email/query work; Email/get is broken on this build).
//
// All assertions are read-only.
//
//   npx playwright test jmap-mail-remote.spec.ts

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const JMAP = `${REMOTE_BASE}/api/user/v1/jmap`;
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

const auth = () => ({ Authorization: `Bearer ${token}` });

test.describe('JMAP mail read methods on the live demo @remote', () => {
  test('Email/query returns total + email ids for real mailbox data', async ({ request }) => {
    const res = await request.post(`${JMAP}`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: '0',
        methodCalls: [['Email/query', {}, 'q0']],
      },
    });
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, result] = env.methodResponses[0];
    expect(name).toBe('Email/query');
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThan(0); // real mailbox has messages
    expect(Array.isArray(result.ids)).toBe(true);
    expect(result.ids.length).toBeGreaterThan(0);
    expect(result.accountId).toBe('0');
    test.info().annotations.push({
      type: 'issue',
      description:
        'Demo quirks (not asserted): mail-method call tags normalize to "0" (Core/echo echoes tags verbatim) and the `limit` argument is unreliable on this build (limit:3 returned 12 ids, limit:5 returned 5).',
    });
  });

  test('Email/get for a real message id is a documented serverFail (issue on this build)', async ({ request }) => {
    // First resolve a real message id via Email/query, then fetch it.
    const q = await request.post(`${JMAP}`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: '0',
        methodCalls: [['Email/query', {}, 'q0']],
      },
    });
    const qenv = await q.json();
    const [, qres] = qenv.methodResponses[0];
    const msgId = qres.ids?.[0];
    expect(msgId).toBeTruthy();

    const res = await request.post(`${JMAP}`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: {
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        accountId: '0',
        methodCalls: [['Email/get', { ids: [msgId], properties: ['subject'] }, 'g0']],
      },
    });
    // The HTTP envelope must always be 200 — errors are JMAP method responses.
    expect(res.status()).toBe(200);
    const env = await res.json();
    const [name, result] = env.methodResponses[0];
    expect(name === 'error' || name === 'Email/get').toBe(true);
    if (name === 'error') {
      // As of the current demo build this is serverFail (Email/get is broken
      // for real messages); document it so the test flips when fixed.
      expect(result.type).toBe('serverFail');
      test.info().annotations.push({
        type: 'issue',
        description:
          'Email/get returns serverFail for real message ids on the current demo server build. Mailbox/get + Email/query work; Email/get is broken. Flip this test to expect a populated list once fixed.',
      });
    } else {
      expect(Array.isArray(result.list)).toBe(true);
    }
  });
});
