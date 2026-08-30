// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Mail WRITE path against the LOCAL stack: save draft -> update draft ->
// send draft / direct send, attachment upload, and cross-user delivery
// through Stalwart SMTP.
//
// Note (2026-08-30): Sent-side assertions are deterministic ("Sent Items").
// Recipient-side: Stalwart's built-in anti-spam files plain local test mails
// (no DKIM/SPF, DNSBL timeout) into Junk Mail, so the cross-user test asserts
// arrival in INBOX ∪ Junk Mail (still proves end-to-end SMTP delivery).
//
//   npx playwright test local-mail-write-path.spec.ts

import { test, expect, apiLogin, cleanupLocalMail } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const MARKER = '[local-e2e] ';

let token = '';

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'testuser@example.org', 'password123', LOCAL_API))!;
  expect(token).toBeTruthy();
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const created: { keys: string[]; sentSubjects: string[] } = { keys: [], sentSubjects: [] };

async function listFolder(request: any, folder: string): Promise<any[]> {
  const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent(folder)}/mails`, {
    headers: auth(),
  });
  expect(res.status()).toBe(200);
  return (await res.json()).data ?? [];
}

async function findInFolder(request: any, folder: string, subject: string) {
  return (await listFolder(request, folder)).find((m: any) => m.subject === subject);
}

async function pollFolderFor(request: any, folder: string, subject: string, tries = 20) {
  for (let i = 0; i < tries; i += 1) {
    const m = await findInFolder(request, folder, subject);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return undefined;
}

test.describe('local mail write path @local @mail', () => {
  test('save draft creates a tmp_draft key and an IMAP draft in Drafts', async ({ request }) => {
    const subject = `${MARKER}wp-save-${Date.now()}`;
    created.sentSubjects.push(subject);
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/save`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject, body: 'draft body' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.error_code).toBe('S000000');
    expect(typeof body.data.key).toBe('string');
    expect(body.data.key.length).toBeGreaterThan(16);
    expect(typeof body.data.uid).toBe('string');
    created.keys.push(body.data.key);

    const draft = await pollFolderFor(request, 'Drafts', subject);
    expect(draft).toBeTruthy();
    expect(draft.uid).toBe(body.data.uid);
    expect(draft.subject).toBe(subject);
  });

  test('update draft replaces the Drafts copy and supports close=true', async ({ request }) => {
    const subject = `${MARKER}wp-update-${Date.now()}`;
    const updSubject = `${subject}-UPD`;
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/save`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject, body: 'v1' },
    });
    const body = await res.json();
    const key = body.data.key as string;
    created.keys.push(key);

    const upd = await request.put(`${API}/api/user/v1/mailboxes/0/mail/${key}/save?close=true`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject: updSubject, body: 'v2' },
    });
    expect(upd.status()).toBe(200);
    const updBody = await upd.json();
    expect(updBody.error_code).toBe('S000000');
    expect(updBody.data.subject).toBe(updSubject);

    const updDraft = await pollFolderFor(request, 'Drafts', updSubject);
    expect(updDraft).toBeTruthy();
    expect(await findInFolder(request, 'Drafts', subject)).toBeUndefined();
    created.sentSubjects.push(subject, updSubject);
  });

  test('delete draft removes the draft and its tmp_draft row (204)', async ({ request }) => {
    const subject = `${MARKER}wp-del-${Date.now()}`;
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/save`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject, body: 'x' },
    });
    const body = await res.json();
    const key = body.data.key as string;
    created.keys.push(key);
    created.sentSubjects.push(subject);

    const del = await request.delete(`${API}/api/user/v1/mailboxes/0/mail/${key}`, { headers: auth() });
    expect(del.status()).toBe(204);

    const re = await request.put(`${API}/api/user/v1/mailboxes/0/mail/${key}/save`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', subject: 'nope' },
    });
    const reBody = await re.json();
    expect(reBody.error_code).not.toBe('S000000');
    expect(await findInFolder(request, 'Drafts', subject)).toBeUndefined();
  });

  test('send a saved draft: key consumed and message lands in Sent Items', async ({ request }) => {
    const subject = `${MARKER}wp-senddraft-${Date.now()}`;
    created.sentSubjects.push(subject);
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/save`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject, body: 'via draft' },
    });
    const body = await res.json();
    const key = body.data.key as string;
    created.keys.push(key);

    const sn = await request.post(`${API}/api/user/v1/mailboxes/0/mail/${key}/send`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject, body: 'via draft' },
    });
    expect(sn.status()).toBe(200);
    expect((await sn.json()).error_code).toBe('S000000');

    const sent = await pollFolderFor(request, 'Sent Items', subject);
    expect(sent).toBeTruthy();

    const cur = await request.get(`${API}/api/user/v1/mailboxes/0/mail/current`, { headers: auth() });
    const curBody = await cur.json();
    expect((curBody.data ?? []).some((d: any) => d.key === key)).toBe(false);
  });

  test('direct send lands in Sent Items', async ({ request }) => {
    const subject = `${MARKER}wp-direct-${Date.now()}`;
    created.sentSubjects.push(subject);
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/send`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser@example.org'], subject, body: 'direct', priority: 3 },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).error_code).toBe('S000000');
    const sent = await pollFolderFor(request, 'Sent Items', subject);
    expect(sent).toBeTruthy();
    expect(Array.isArray(sent.to)).toBe(true);
  });

  test('cross-user send is delivered to the recipient mailbox through Stalwart SMTP', async ({ request }) => {
    const subject = `${MARKER}wp-cross-${Date.now()}`;
    created.sentSubjects.push(subject);
    const t2 = await apiLogin(request, 'testuser2@example.org', 'password123', LOCAL_API);
    expect(t2).toBeTruthy();
    const auth2 = () => ({ Authorization: `Bearer ${t2}` });
    const list2 = async (folder: string) => {
      const res = await request.get(`${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent(folder)}/mails`, {
        headers: auth2(),
      });
      return ((await res.json()).data ?? []) as any[];
    };
    const seenSubjects = new Set<string>();
    for (const m of [...(await list2('INBOX')), ...(await list2('Junk Mail'))]) seenSubjects.add(m.subject);

    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/send`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser2@example.org'], subject, body: 'cross-user' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).error_code).toBe('S000000');

    let arrived: any;
    for (let i = 0; i < 20 && !arrived; i += 1) {
      const inbox = await list2('INBOX');
      const junk = await list2('Junk Mail');
      arrived = [...inbox, ...junk].find((m) => m.subject === subject && !seenSubjects.has(m.subject));
      if (!arrived) await new Promise((r) => setTimeout(r, 1500));
    }
    expect(arrived, `message ${subject} must arrive in testuser2's INBOX or Junk Mail`).toBeTruthy();
    test.info().annotations.push({
      type: 'quirk',
      description:
        "Stalwart's built-in anti-spam files the plain local test mails (no DKIM/SPF, DNSBL timeout) into Junk Mail; arrival is asserted across INBOX ∪ Junk Mail.",
    });
  });

  test('attachment upload attaches to a draft; send via key carries it to Sent Items', async ({ request }) => {
    const subject = `${MARKER}wp-att-${Date.now()}`;
    created.sentSubjects.push(subject);
    const save = await request.post(`${API}/api/user/v1/mailboxes/0/mail/save`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser@example.org'], subject, body: 'draft for attachment' },
    });
    const saveBody = await save.json();
    expect(saveBody.error_code).toBe('S000000');
    const key = saveBody.data.key as string;
    created.keys.push(key);

    const boundary = `XB${Date.now()}`;
    const fn = `att-${Date.now()}.txt`;
    const bodyText =
      '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + fn +
      '"\r\nContent-Type: text/plain\r\n\r\nhello attachment\r\n--' + boundary + '--\r\n';
    const up = await request.post(`${API}/api/user/v1/mailboxes/0/mail/${key}/attachments`, {
      headers: { ...auth(), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      data: bodyText,
    });
    expect(up.status()).toBe(200);
    const upBody = await up.json();
    expect(upBody.error_code).toBe('S000000');
    expect(upBody.data.filename).toBe(fn);

    const cur = await request.get(`${API}/api/user/v1/mailboxes/0/mail/current`, { headers: auth() });
    const curBody = await cur.json();
    expect((curBody.data ?? []).some((d: any) => d.key === key)).toBe(true);

    // Sending via the key injects the attachment from the tmp_draft row.
    const sn = await request.post(`${API}/api/user/v1/mailboxes/0/mail/${key}/send`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { from: 'testuser@example.org', to: ['testuser@example.org'], subject, body: 'with attachment' },
    });
    expect(sn.status()).toBe(200);
    expect((await sn.json()).error_code).toBe('S000000');
    const sent = await pollFolderFor(request, 'Sent Items', subject);
    expect(sent).toBeTruthy();
    expect(sent.has_attachment).toBe(true);
    expect(Array.isArray(sent.attachments)).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    // Remove every Sent Items / Drafts message this suite created.
    const folders = ['Sent Items', 'Drafts'];
    for (const folder of folders) {
      const mails = await listFolder(request, folder).catch(() => []);
      for (const m of mails) {
        if (created.sentSubjects.includes(m.subject)) {
          await request
            .delete(`${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${m.uid}`, {
              headers: auth(),
            })
            .catch(() => {});
        }
      }
    }
    for (const key of created.keys) {
      await request.delete(`${API}/api/user/v1/mailboxes/0/mail/${key}`, { headers: auth() }).catch(() => {});
    }
    cleanupLocalMail(); // best-effort: purge marker-prefixed seeds from INBOX/Junk/Deleted
  });
});
