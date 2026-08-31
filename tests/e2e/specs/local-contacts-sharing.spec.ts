// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local contacts: addressbook sharing, vCard export/import, contact lists (@local).
//
// testuser shares their default address book with testuser2 (view), who can
// then READ it; a contact is exported as vCard via an agent job and imported
// back (upsert by uid); a contact list (group) round-trips.
//
// API facts pinned 2026-08-31:
//   - share body is {user_uid, share_level: "view"|"modify"} (NOT "role";
//     an unknown field is a 422).
//   - export: GET /addressbooks/<key>/export with Accept: text/vcard → 202
//     {job_id}; result served via GET /jobs/<id>/result as text/vcard.
//   - import: POST /addressbooks/<key>/contacts/import?format=vcard3 with
//     multipart file upload → 202 {job_id}; result counters:
//     {contacts_inserted, contacts_updated, lists_inserted, lists_updated,
//     skipped}.
//   - contact list create: {name, members: [contact-key, ...]} (member uid
//     strings, not objects; `c_name` is unknown → 422).
//
//   npx playwright test local-contacts-sharing.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const MARKER = '[local-e2e] ';
const USER1 = { email: 'testuser@example.org', password: 'password123' };
const USER2 = { email: 'testuser2@example.org', password: 'password123' };

let tok1 = '';
let tok2 = '';
let abKey = '';
let probeContactKey = '';
let importedContactKey = '';
let probeContactName = '';
let importUid = '';
let listKey = '';

const auth1 = () => ({ Authorization: `Bearer ${tok1}` });
const auth2 = () => ({ Authorization: `Bearer ${tok2}` });
const json1 = () => ({ ...auth1(), 'Content-Type': 'application/json' });

/** Poll GET /jobs/<id> until success/failure (deadline 60s). */
async function pollJob(request: any, jobId: string, auth: () => any): Promise<string> {
  let status = '';
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, Math.min(1500 * i, 4000)));
    const poll = await request.get(`${LOCAL_API}/jobs/${jobId}`, { headers: auth() });
    status = ((await poll.json()).data ?? {}).status ?? '';
    if (status === 'success' || status === 'failure') break;
  }
  return status;
}

test.beforeAll(async ({ request }) => {
  tok1 = (await apiLogin(request, USER1.email, USER1.password, LOCAL_API))!;
  tok2 = (await apiLogin(request, USER2.email, USER2.password, LOCAL_API))!;
  expect(tok1).toBeTruthy();
  expect(tok2).toBeTruthy();

  const res = await request.get(`${LOCAL_API}/addressbooks`, { headers: auth1() });
  const books = ((await res.json()).data ?? {}).addressbooks ?? [];
  const def = books.find((b: any) => b.is_default && b.source_type === 'local');
  expect(def, 'user1 has a default local address book').toBeTruthy();
  abKey = def.key;

  // drop stale shares from earlier crashed runs so the create test is
  // deterministic (duplicate share → 409 S000709)
  await request
    .delete(`${LOCAL_API}/addressbooks/${abKey}/shares/${USER2.email}`, { headers: auth1() })
    .catch(() => {});

  probeContactName = `${MARKER}share-probe ${Date.now()}`;
  const created = await request.post(`${LOCAL_API}/addressbooks/${abKey}/contacts`, {
    headers: json1(),
    data: {
      display_name: probeContactName,
      first_name: 'Share',
      last_name: 'Probe',
      emails: [{ value: `share.probe.${Date.now()}@example.org` }],
    },
  });
  expect(created.status(), `probe contact -> ${created.status()} ${await created.text()}`).toBe(201);
  probeContactKey = (await created.json()).data.key;
  expect(probeContactKey).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  // remove the share and probe artifacts; keep user2's world unchanged
  await request
    .delete(`${LOCAL_API}/addressbooks/${abKey}/shares/${USER2.email}`, { headers: auth1() })
    .catch(() => {});
  if (listKey) {
    await request
      .delete(`${LOCAL_API}/addressbooks/${abKey}/lists/${listKey}`, { headers: auth1() })
      .catch(() => {});
  }
  if (importedContactKey) {
    await request
      .delete(`${LOCAL_API}/addressbooks/${abKey}/contacts/${importedContactKey}`, { headers: auth1() })
      .catch(() => {});
  }
  if (probeContactKey) {
    await request
      .delete(`${LOCAL_API}/addressbooks/${abKey}/contacts/${probeContactKey}`, { headers: auth1() })
      .catch(() => {});
  }
});

test.describe('local contacts sharing + vCard @local @contacts', () => {
  test('AB-SHARE-01 share the book with another user (view) and list it back', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/addressbooks/${abKey}/shares`, {
      headers: json1(),
      data: { user_uid: USER2.email, share_level: 'view' },
    });
    expect(res.status(), `share -> ${res.status()} ${await res.text()}`).toBe(201);

    const listed = await request.get(`${LOCAL_API}/addressbooks/${abKey}/shares`, {
      headers: auth1(),
    });
    expect(listed.status()).toBe(200);
    const shares = ((await listed.json()).data ?? {}).shares ?? [];
    const mine = shares.find((s: any) => s.user_uid === USER2.email);
    expect(mine, 'share entry for user2').toBeTruthy();
    expect(mine.share_level).toBe('view');
  });

  test('AB-SHARE-02 the shared book appears in the other user addressbook list', async ({ request }) => {
    let present: any;
    for (let i = 0; i < 6 && !present; i += 1) {
      const res = await request.get(`${LOCAL_API}/addressbooks`, { headers: auth2() });
      present = (((await res.json()).data ?? {}).addressbooks ?? []).find(
        (b: any) => b.key === abKey,
      );
      if (!present) await new Promise((r) => setTimeout(r, 2000));
    }
    expect(present, 'user2 sees the shared book (matched by key)').toBeTruthy();
  });

  test('AB-SHARE-03 the other user can read contacts from the shared book', async ({ request }) => {
    let hit: any;
    for (let i = 0; i < 6 && !hit; i += 1) {
      const res = await request.get(`${LOCAL_API}/addressbooks/${abKey}/contacts`, {
        headers: auth2(),
      });
      const data = (await res.json()).data;
      const contacts = (data?.contacts ?? data ?? []) as any[];
      hit = contacts.find((c: any) => c.key === probeContactKey || c.display_name === probeContactName);
      if (!hit) await new Promise((r) => setTimeout(r, 2000));
    }
    expect(hit, 'user2 reads the probe contact through the share').toBeTruthy();
  });

  test('AB-VCARD-01 vCard export: 202 → job success → result holds the contact', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/addressbooks/${abKey}/export`, {
      headers: { ...auth1(), Accept: 'text/vcard' },
    });
    expect(res.status(), `export enqueue -> ${res.status()} ${await res.text()}`).toBe(202);
    const jobId = (await res.json()).data.job_id;
    expect(jobId).toMatch(/[0-9a-f-]{36}/);

    const status = await pollJob(request, jobId, auth1);
    expect(status, 'export job must succeed').toBe('success');

    const result = await request.get(`${LOCAL_API}/jobs/${jobId}/result`, { headers: auth1() });
    expect(result.status()).toBe(200);
    expect(result.headers()['content-type']).toContain('text/vcard');
    const vcf = await result.text();
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain(probeContactName);
  });

  test('AB-VCARD-02 vCard import round-trips a new contact by uid', async ({ request }) => {
    importUid = `e2e-import-${Date.now()}`;
    // unique email per run: repeated runs must not accumulate duplicates
    const importEmail = `import.probe.two.${Date.now()}@example.org`;
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `UID:${importUid}`,
      'FN:Import Probe Two',
      'N:Two;Import;;;',
      `EMAIL;TYPE=INTERNET:${importEmail}`,
      'END:VCARD',
      '',
    ].join('\r\n');

    const boundary = `----e2e${Date.now()}`;
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="probe.vcf"',
      'Content-Type: text/vcard',
      '',
      vcf,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await request.post(
      `${LOCAL_API}/addressbooks/${abKey}/contacts/import?format=vcard3`,
      {
        headers: { ...auth1(), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        data: body,
      },
    );
    expect(res.status(), `import enqueue -> ${res.status()} ${await res.text()}`).toBe(202);
    const jobId = (await res.json()).data.job_id;

    const status = await pollJob(request, jobId, auth1);
    expect(status, 'import job must succeed').toBe('success');

    // import counters are stored INLINE in the job state result — the
    // /jobs/<id>/result endpoint is for offloaded blobs (410 without one)
    const job = await request.get(`${LOCAL_API}/jobs/${jobId}`, { headers: auth1() });
    expect(job.status()).toBe(200);
    const result = ((await job.json()).data ?? {}).result ?? {};
    expect(result.contacts_inserted ?? 0).toBeGreaterThanOrEqual(1);

    // the imported contact is listed and its UID preserved
    const listed = await request.get(`${LOCAL_API}/addressbooks/${abKey}/contacts`, {
      headers: auth1(),
    });
    const contacts = ((await listed.json()).data ?? {}).contacts ?? [];
    const imported = contacts.find((c: any) => c.uid === importUid);
    expect(imported, 'imported contact present with its vCard uid').toBeTruthy();
    importedContactKey = imported.key;
  });

  test('AB-LIST-01 contact list (group) create, member_count, delete', async ({ request }) => {
    const name = `${MARKER}group ${Date.now()}`;
    const created = await request.post(`${LOCAL_API}/addressbooks/${abKey}/lists`, {
      headers: json1(),
      data: { name, members: [probeContactKey] },
    });
    expect(created.status(), `list create -> ${created.status()} ${await created.text()}`).toBe(201);
    const data = (await created.json()).data;
    listKey = data.key;
    expect(listKey).toBeTruthy();
    expect(data.member_count).toBe(1);

    const listed = await request.get(`${LOCAL_API}/addressbooks/${abKey}/lists`, {
      headers: auth1(),
    });
    const lists = ((await listed.json()).data ?? {}).lists ?? [];
    expect(lists.find((l: any) => l.key === listKey)?.member_count).toBe(1);

    const del = await request.delete(`${LOCAL_API}/addressbooks/${abKey}/lists/${listKey}`, {
      headers: auth1(),
    });
    expect(del.status()).toBe(200);
    const after = await request.get(`${LOCAL_API}/addressbooks/${abKey}/lists`, {
      headers: auth1(),
    });
    const listsAfter = ((await after.json()).data ?? {}).lists ?? [];
    expect(listsAfter.find((l: any) => l.key === listKey)).toBeFalsy();
    listKey = '';
  });
});
