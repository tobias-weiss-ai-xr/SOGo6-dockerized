// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local-stack mail DATA plane: real messages seeded into the local Stalwart
// (via its own network namespace — it refuses foreign TLS connections), then
// read + written through the same surfaces the UI and mail clients use.
//
//   - REST: list / detail / raw / edit / reply / delete on INBOX messages
//   - JMAP: Email/query (inMailboxes), Email/get (flag mapping), Email/set
//     destroy + move
//
// Seeding is idempotent: beforeAll cleans previous marker-prefixed seeds then
// appends a deterministic set; afterAll clears them again.
//
//   npx playwright test local-mail-data.spec.ts

import { test, expect } from '../helpers';
import { seedLocalMailBatch, cleanupLocalMail, LOCAL_MAIL_MARKER } from '../helpers';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };

const KINDS = ['read', 'flagged', 'edit', 'reply', 'destroy', 'delete', 'move'] as const;
type Kind = (typeof KINDS)[number];
const SEED_NAMES: Record<Kind, string> = {
  read: 'read-seed',
  flagged: 'unread-flagged-seed',
  edit: 'edit-seed',
  reply: 'reply-seed',
  destroy: 'destroy-seed',
  delete: 'delete-seed',
  move: 'move-seed',
};
const seedSubject = (k: Kind) => `${LOCAL_MAIL_MARKER}${SEED_NAMES[k]}`;
// JMAP Email id = base64url("<folder>\0<uid>"); Mailbox id = base64url("mailbox:<path>")
const emailId = (uid: string, folder = 'INBOX') =>
  Buffer.from(`${folder}\u0000${uid}`, 'utf8').toString('base64url');
const mailboxId = (path: string) => Buffer.from(`mailbox:${path}`, 'utf8').toString('base64url');

let token = '';

test.beforeAll(async () => {
  const cleanup = cleanupLocalMail();
  expect(cleanup.ok, `seed cleanup: ${cleanup.out.slice(0, 120)}`).toBeTruthy();
  // One IMAP session for all seeds (see helpers.seedLocalMailBatch).
  const entries = KINDS.map((k) => {
    const opts: { seen?: boolean; flagged?: boolean } = {};
    if (k === 'read') opts.seen = true;
    if (k === 'flagged') opts.flagged = true;
    return { name: SEED_NAMES[k], ...opts };
  });
  const r = seedLocalMailBatch(entries);
  expect(r.ok, `batch seed: ${r.out.slice(0, 160)}`).toBeTruthy();
});

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/user/v1/auth/login`, {
    data: { username: USER.email, password: USER.password },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();

  // Stalwart can serve stale SELECT counts to fresh connections immediately
  // after external-session appends (esp. under re-expunge load). Gate the
  // suite on the seeds being stably visible via JMAP (two consecutive equal
  // reads), so the subsequent tests never race the store.
  const boxIn = mailboxId('INBOX');
  let prev = -1;
  let stableFor = 0;
  let visible = 0;
  for (let i = 0; i < 30; i++) {
    const env = await jmap(request, [
      ['Email/query', { filter: { inMailboxes: [boxIn] } }, 'q0'],
    ]);
    const q = env.methodResponses?.[0]?.[1];
    visible = q?.ids?.length ?? 0;
    if (visible >= KINDS.length && visible === prev) {
      stableFor++;
      if (stableFor >= 2) break;
    } else {
      stableFor = 0;
    }
    prev = visible;
    await new Promise((r) => setTimeout(r, 1500));
  }
  expect(visible, 'seeds stably visible via JMAP before tests start').toBeGreaterThanOrEqual(KINDS.length);
});

test.afterAll(async () => {
  cleanupLocalMail(); // best-effort; explicit deletes below already removed most
});

const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

async function inboxMails(request: any): Promise<any[]> {
  const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/INBOX/mails`, { headers: auth() });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.error_code).toBe('S000000');
  return body.data ?? [];
}

async function findSeed(request: any, k: Kind): Promise<any> {
  const items = await inboxMails(request);
  const it = items.find((m) => m.subject === seedSubject(k));
  expect(it, `seeded '${SEED_NAMES[k]}' is present in INBOX`).toBeTruthy();
  return it!;
}

async function jmap(request: any, methodCalls: any[]): Promise<any> {
  const res = await request.post(`${API}/api/user/v1/jmap`, {
    headers: auth(),
    data: {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      accountId: '0',
      methodCalls,
    },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('local mail data plane @local @mail', () => {
  test('REST INBOX list returns the seeded messages with correct seen/flagged', async ({ request }) => {
    const items = await inboxMails(request);
    const read = items.find((m) => m.subject === seedSubject('read'));
    const flagged = items.find((m) => m.subject === seedSubject('flagged'));
    expect(read).toBeTruthy();
    expect(flagged).toBeTruthy();
    expect(read.seen).toBe(true); // seeded with \Seen
    expect(read.flagged).toBe(false);
    expect(flagged.seen).toBe(false); // seeded with \Flagged only
    expect(flagged.flagged).toBe(true);
    for (const it of [read, flagged]) {
      expect(it.uid).toBeTruthy();
      expect(it.from?.email).toBe(USER.email);
      expect(typeof it.size).toBe('number');
      expect(Array.isArray(it.contents)).toBe(true);
    }
  });

  test('REST mail detail resolves body contents for a seeded message', async ({ request }) => {
    const it = await findSeed(request, 'read');
    const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/INBOX/mails/${it.uid}`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.error_code).toBe('S000000');
    expect(body.data.subject).toBe(seedSubject('read'));
    const plain = body.data.contents?.find((c: any) => c.contentType === 'text/plain');
    expect(plain).toBeTruthy();
    expect(plain.content).toContain(seedSubject('read'));
  });

  test('REST raw returns the RFC 822 source of a seeded message', async ({ request }) => {
    const it = await findSeed(request, 'read');
    const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/INBOX/mails/${it.uid}/raw`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const raw: string = body.data?.raw ?? '';
    expect(raw).toContain(`Subject: ${seedSubject('read')}`);
    expect(raw).toContain(`Body marker: ${seedSubject('read')}`);
  });

  test('REST edit returns an editable message (UI compose path)', async ({ request }) => {
    // NOTE: open_mail_for_edit REPLACES the source mail with a draft copy
    // (ModuleMail.open_mail_for_edit deletes the original from its folder), so
    // it gets its own dedicated seed and never consumes the 'read' seed that
    // the later JMAP flag tests depend on.
    const it = await findSeed(request, 'edit');
    const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/INBOX/mails/${it.uid}/edit`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.error_code).toBe('S000000');
    expect(body.data.subject).toBe(seedSubject('edit'));
    expect(Array.isArray(body.data.contents)).toBe(true);
  });

  test('REST reply prepares a threaded draft and grows the Drafts folder', async ({ request }) => {
    const folders = async () => {
      const r = await request.get(`${API}/api/user/v1/mailboxes/0/folders`, { headers: auth() });
      return (await r.json()).data ?? [];
    };
    const before = (await folders()).find((f: any) => f.name === 'Drafts')?.message_count ?? 0;

    const it = await findSeed(request, 'reply');
    const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/INBOX/mails/${it.uid}/reply`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.error_code).toBe('S000000');
    expect(body.data.key, 'reply returns a tmp_draft key').toBeTruthy();
    // Reply targets the original sender.
    const to = body.data.to ?? [];
    expect(to.some((t: any) => t.email === USER.email)).toBe(true);

    const after = (await folders()).find((f: any) => f.name === 'Drafts')?.message_count ?? 0;
    expect(after, 'reply creates a new draft').toBeGreaterThan(before);
  });

  test('JMAP Email/query with inMailboxes finds the seeded messages', async ({ request }) => {
    const env = await jmap(request, [
      ['Email/query', { filter: { inMailboxes: [mailboxId('INBOX')] } }, 'q0'],
    ]);
    const [qname, qres] = env.methodResponses[0];
    expect(qname).toBe('Email/query');
    expect(qres.total).toBeGreaterThanOrEqual(KINDS.length);

    // Fetch the queried ids explicitly (result back-references like "#q0/ids"
    // are not resolved by this server — see GAP-ANALYSIS); map subjects.
    const g = await jmap(request, [
      ['Email/get', { ids: qres.ids, properties: ['subject'] }, 'g0'],
    ]);
    const [, gres] = g.methodResponses[0];
    expect(gres.notFound).toEqual([]);
    const subjects = gres.list.map((e: any) => e.subject);
    // 'edit' is consumed by the /edit test (open_mail_for_edit replaces the
    // source with a draft copy) which runs BEFORE this query — assert the
    // seeds that must still be present instead.
    const expected = KINDS.filter((k) => k !== 'edit');
    for (const k of expected) {
      expect(subjects).toContain(seedSubject(k));
    }
  });

  test('JMAP Email/get maps real IMAP flags to $seen/$flagged', async ({ request }) => {
    const read = await findSeed(request, 'read');
    const flagged = await findSeed(request, 'flagged');
    const env = await jmap(request, [
      [
        'Email/get',
        { ids: [emailId(read.uid), emailId(flagged.uid)], properties: ['subject', 'keywords', 'size'] },
        'g0',
      ],
    ]);
    const [name, res] = env.methodResponses[0];
    expect(name).toBe('Email/get');
    expect(res.notFound).toEqual([]);
    const readM = res.list.find((e: any) => e.subject === seedSubject('read'));
    const flagM = res.list.find((e: any) => e.subject === seedSubject('flagged'));
    expect(readM).toBeTruthy();
    expect(flagM).toBeTruthy();
    expect(readM.keywords.$seen).toBe(true); // \Seen seed
    expect(readM.keywords.$flagged).toBe(false);
    expect(flagM.keywords.$seen).toBe(false);
    expect(flagM.keywords.$flagged).toBe(true); // \Flagged seed
    expect(typeof readM.size).toBe('number');
    // This test doubles as the local regression lock for the 3368e93 fix
    // (serverFail on list-typed flags).
    test.info().annotations.push({
      type: 'issue',
      description:
        'Regression lock (sogo6-server 3368e93): Email/get must map a list-typed flags field without serverFail.',
    });
  });

  test('JMAP Email/set destroy removes a seeded message', async ({ request }) => {
    const it = await findSeed(request, 'destroy');
    const env = await jmap(request, [['Email/set', { destroy: [emailId(it.uid)] }, 's0']]);
    const [, res] = env.methodResponses[0];
    expect(res.destroyed).toEqual([emailId(it.uid)]);
    expect(res.notDestroyed).toEqual({});
    // Gone from the REST INBOX view too.
    const items = await inboxMails(request);
    expect(items.some((m: any) => m.subject === seedSubject('destroy'))).toBe(false);
  });

  test('JMAP Email/set update moves a message between folders and back', async ({ request }) => {
    const it = await findSeed(request, 'move');
    const id = emailId(it.uid);
    const [boxJunk, boxInbox] = [mailboxId('Junk Mail'), mailboxId('INBOX')];

    const move = await jmap(request, [
      ['Email/set', { update: { [id]: { mailboxIds: { [boxJunk]: true } } } }, 's0'],
    ]);
    expect(move.methodResponses[0][0]).toBe('Email/set');
    const mres = move.methodResponses[0][1];
    // JMAP Email/set `updated` is an object {id: null} (RFC 8621).
    expect(mres.updated).toMatchObject({ [id]: null });
    expect(mres.notUpdated).toEqual({});

    // Gone from INBOX (now under Junk Mail).
    let items = await inboxMails(request);
    expect(items.some((m: any) => m.subject === seedSubject('move'))).toBe(false);

    // The copy may be renumbered in the destination, so re-resolve the seed
    // under Junk Mail before moving it back (realistic client behaviour).
    const junkRes = await request.get(`${API}/api/user/v1/mailboxes/0/folders/Junk%20Mail/mails`, {
      headers: auth(),
    });
    const junkItems: any[] = (await junkRes.json()).data ?? [];
    const inJunk = junkItems.find((m: any) => m.subject === seedSubject('move'));
    expect(inJunk, 'move-seed re-resolved under Junk Mail').toBeTruthy();
    // The back-move id MUST encode the Junk Mail folder — a wrong-folder id
    // would resolve to an unrelated (or missing) INBOX uid.
    const id2 = emailId(inJunk!.uid, 'Junk Mail');

    // Move it back — self-cleaning.
    const back = await jmap(request, [
      ['Email/set', { update: { [id2]: { mailboxIds: { [boxInbox]: true } } } }, 's1'],
    ]);
    const bres = back.methodResponses[0][1];
    expect(bres.updated).toMatchObject({ [id2]: null });
    expect(bres.notUpdated).toEqual({});
    items = await inboxMails(request);
    expect(items.some((m: any) => m.subject === seedSubject('move'))).toBe(true);
  });

  test('REST DELETE removes a seeded message', async ({ request }) => {
    const it = await findSeed(request, 'delete');
    const res = await request.delete(`${API}/api/user/v1/mailboxes/0/folders/INBOX/mails/${it.uid}`, {
      headers: auth(),
    });
    // DELETE succeeds with 204 No Content (mail moved to Deleted Items).
    expect(res.status()).toBe(204);
    const items = await inboxMails(request);
    expect(items.some((m: any) => m.subject === seedSubject('delete'))).toBe(false);
  });
});
