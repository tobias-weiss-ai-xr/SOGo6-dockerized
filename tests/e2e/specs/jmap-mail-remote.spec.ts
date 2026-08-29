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
//     returned 5).
//   - Email/get previously returned a `serverFail` method error for real
//     message ids; FIXED in sogo6-server 3368e93 (flags list vs dict mapping)
//     and now asserted (see the Email/get test below).
//   - Email/query with `inMailboxes` returned total 0 for UNPADDED base64url
//     mailbox ids (exactly what JS clients emit); FIXED in sogo6-server
//     a873f33 (RFC 4648 §5-tolerant decoding) — both padded and unpadded ids
//     are now asserted to resolve.
//   - Email/set move previously hard-failed (`command COPY illegal in state
//     AUTH` — the connection never SELECTed a folder before COPY) and, once
//     that cleared, left a \Deleted ghost in the source; both FIXED on the
//     demo (and upstream in a873f33 via source-folder select + UID EXPUNGE)
//     and now asserted by the self-cleaning move round-trip below.
//
// Read-only except for the explicitly self-cleaning move test.
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

  test('Email/get returns the real message (list-flag mapping regression)', async ({ request }) => {
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
    expect(name).toBe('Email/get');
    expect(result.notFound).toEqual([]);
    expect(result.list.length).toBe(1);
    const email = result.list[0];
    // The message resolves and its flags map from the store's IMAP flag list
    // (regression: pre-3368e93 this was a serverFail AttributeError).
    expect(email.id).toBeTruthy();
    expect(typeof email.size).toBe('number');
    expect(email.keywords).toMatchObject({ $seen: expect.any(Boolean), $flagged: expect.any(Boolean) });
    test.info().annotations.push({
      type: 'issue',
      description:
        'FIXED 2026-08-29 in sogo6-server 3368e93: _mail_to_jmap now tolerates the store flags LIST (IMAP flags) instead of assuming a dict — Email/get on real message ids no longer serverFails. This test previously asserted the serverFail behavior.',
    });
  });

  test('Email/query inMailboxes accepts UNPADDED base64url mailbox ids (RFC 4648 §5)', async ({ request }) => {
    // JS clients (Buffer.toString('base64url')) strip the '=' padding; pre-a873f33
    // the server urlsafe_b64decode rejected that and inMailboxes silently
    // matched nothing (total 0) while the same request with padded ids worked.
    const jmap = async (mailboxId: string) => {
      const res = await request.post(`${JMAP}`, {
        headers: { ...auth(), 'Content-Type': 'application/json' },
        data: {
          using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
          accountId: '0',
          methodCalls: [['Email/query', { filter: { inMailboxes: [mailboxId] }, limit: 1 }, 'q0']],
        },
      });
      expect(res.status()).toBe(200);
      return (await res.json()).methodResponses[0][1];
    };
    const padded = Buffer.from('mailbox:INBOX').toString('base64');
    const unpadded = padded.replace(/=+$/, '');
    const [pRes, uRes] = [await jmap(padded), await jmap(unpadded)];
    expect(pRes.total).toBeGreaterThan(0);
    expect(uRes.total).toBe(pRes.total); // unpadded must agree with padded, not 0
  });

  test('Email/set moves a message folder-to-folder with no ghost (self-cleaning round-trip)', async ({ request }) => {
    // Regression pin for TWO demo-discovered bugs fixed in a873f33 + demo
    // deploy: (1) uid_copy ran in state AUTH (COPY illegal) because no folder
    // was SELECTed first; (2) the source copy was never expunged, so the moved
    // message still appeared in the old folder. Both made the UI's
    // move-to-folder silently fail / ghost on the demo.
    const jmap = async (methodCalls: unknown[]) => {
      const res = await request.post(`${JMAP}`, {
        headers: { ...auth(), 'Content-Type': 'application/json' },
        data: {
          using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
          accountId: '0',
          methodCalls,
        },
      });
      expect(res.status()).toBe(200);
      return (await res.json()).methodResponses;
    };
    const boxId = (name: string) => Buffer.from(`mailbox:${name}`).toString('base64url'); // UNPADDED on purpose
    const queryIds = async (folder: string): Promise<string[]> => {
      const [[, r]] = await jmap([['Email/query', { filter: { inMailboxes: [boxId(folder)] }, limit: 500 }, 'q']]);
      return r?.ids ?? [];
    };

    const scratch = `ZZ-e2e-move-${Date.now()}`;
    try {
      // Ensure a scratch destination exists (create if a prior failed run left it destroyed).
      const [[, mb]] = await jmap([['Mailbox/get', { ids: [boxId(scratch)] }, 'm0']]);
      if (!(mb?.list ?? []).length) {
        await jmap([['Mailbox/set', { create: { [scratch]: { name: scratch } } }, 'm1']]);
      }

      const inboxBefore = await queryIds('INBOX');
      expect(inboxBefore.length).toBeGreaterThan(0);
      const subject = inboxBefore[inboxBefore.length - 1]; // oldest present message

      // Move INTO scratch.
      const [[, upd]] = await jmap([['Email/set', { update: { [subject]: { mailboxIds: { [boxId(scratch)]: true } } } }, 's0']]);
      expect(upd.updated).toMatchObject({ [subject]: null });
      expect(upd.notUpdated).toEqual({}); // empty-object when nothing failed

      const inboxAfter = await queryIds('INBOX');
      const scratchIds = await queryIds(scratch);
      expect(inboxAfter).not.toContain(subject); // no ghost in source (expunge works)
      expect(scratchIds.length).toBeGreaterThan(0); // landed in destination

      // Move BACK (use the destination's own ids — JMAP email ids encode the folder).
      const moved = scratchIds[scratchIds.length - 1];
      const [[, back]] = await jmap([
        ['Email/set', { update: { [moved]: { mailboxIds: { [boxId('INBOX')]: true, [boxId(scratch)]: false } } } }, 's2'],
      ]);
      expect(back.updated).toMatchObject({ [moved]: null });
      // Ids are folder-scoped, so the restored message has a new id. Compare counts.
      const inboxFinal = await queryIds('INBOX');
      expect(inboxFinal.length).toBeGreaterThanOrEqual(inboxBefore.length - 1);
    } finally {
      // Clean up the scratch folder unconditionally so repeated runs are idempotent.
      const [[, del]] = await jmap([['Mailbox/set', { destroy: [boxId(scratch)] }, 'm4']]);
      const failed = (del?.notDestroyed ?? {}) as Record<string, unknown>;
      expect(Object.keys(failed)).toEqual([]);
    }
  });
});
