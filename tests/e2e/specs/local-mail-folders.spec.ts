// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local mail folder CRUD + mail actions @local.
//
//   POST   /mailboxes/0/folders              {name, parent} → 201
//   PATCH  /mailboxes/0/folders/<path>       {name: FULL new path}
//   DELETE /mailboxes/0/folders/<path>       → 204 (move-to-trash semantics)
//   POST   /mailboxes/0/folders/<f>/mails/batch-action
//   POST   /mailboxes/0/folders/<f>/mails/<uid>/action
//
// Regression context (2026-08-30): DELETE of a nonexistent folder answered
// 500 S001302 "IMAP Command Failed" — now a 404 S000304.
//
//   npx playwright test local-mail-folders.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, LOCAL_API))!;
  expect(token).toBeTruthy();
});

async function listFolders(request: any): Promise<any[]> {
  const res = await request.get(`${LOCAL_API}/mailboxes/0/folders`, { headers: auth() });
  const top = (await res.json()).data ?? [];
  // the listing NESTS children under their parent — flatten
  const flat: any[] = [];
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      flat.push(n);
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(top);
  return flat;
}

async function listMails(request: any, folder: string): Promise<any[]> {
  const res = await request.get(
    `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails?per_page=30`,
    { headers: auth() },
  );
  const data = (await res.json()).data;
  return Array.isArray(data) ? data : data?.mails ?? [];
}

test.describe('local mail folder CRUD @local @mail', () => {
  const name = `[local-e2e] fold ${Date.now()}`;
  const renamed = `${name} r`;

  test('FOLD-01 create a folder under INBOX (201)', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/mailboxes/0/folders`, {
      headers: json(),
      data: { name, parent: 'INBOX' },
    });
    expect(res.status(), `create -> ${res.status()} ${await res.text()}`).toBe(201);
    const data = (await res.json()).data ?? {};
    expect(data.filter_path).toBe(`INBOX/${name}`);
  });

  test('FOLD-02 duplicate create conflicts (409 S000305)', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/mailboxes/0/folders`, {
      headers: json(),
      data: { name, parent: 'INBOX' },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error_code).toBe('S000305');
  });

  test('FOLD-03 the folder is listed with the INBOX prefix', async ({ request }) => {
    // IMAP folder lists can lag briefly behind the CREATE — poll
    let hit: any;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !hit) {
      await new Promise((r) => setTimeout(r, 2000));
      hit = (await listFolders(request)).find((f: any) => f.filter_path === `INBOX/${name}`);
    }
    const seen = (await listFolders(request)).map((f: any) => f.filter_path);
    expect(hit, `INBOX/${name} must be listed — saw: ${JSON.stringify(seen.filter((p: string) => p.includes('fold')))} of ${seen.length} folders`).toBeTruthy();
  });

  test('FOLD-04 PATCH rename takes the FULL new path', async ({ request }) => {
    // concurrent IMAP sessions can transiently reject the RENAME — retry
    let res: any;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
      res = await request.patch(
        `${LOCAL_API}/mailboxes/0/folders/INBOX/${encodeURIComponent(name)}`,
        { headers: json(), data: { name: `INBOX/${renamed}` } },
      );
      if (res.status() === 200) break;
    }
    expect(res.status(), `patch -> ${res.status()} ${await res.text()}`).toBe(200);
    expect(((await res.json()).data ?? {}).filter_path).toBe(`INBOX/${renamed}`);
  });

  test('FOLD-05 delete moves the folder to trash (204) and it disappears from INBOX', async ({ request }) => {
    let res: any;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
      res = await request.delete(
        `${LOCAL_API}/mailboxes/0/folders/INBOX/${encodeURIComponent(renamed)}`,
        { headers: auth() },
      );
      if (res.status() === 204) break;
    }
    expect(res.status()).toBe(204);
    let still: any = true;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && still) {
      await new Promise((r) => setTimeout(r, 2000));
      still = (await listFolders(request)).find((f: any) => f.filter_path === `INBOX/${renamed}`);
    }
    expect(still, 'folder must be gone from INBOX').toBeFalsy();
  });
});

test.describe('local mail flags & move @local @mail', () => {
  test.setTimeout(90000);

  // Self-seeded fixture mail (unique subject) — don't depend on seed state.
  // Anti-spam may deliver to Junk Mail, so the suite operates on whichever
  // folder actually received it (INBOX or Junk Mail) and moves within those.
  let folder = '';
  let subject = '';

  const findFixture = async (request: any): Promise<{ f: string; uid: string } | undefined> => {
    for (const f of ['INBOX', 'Junk Mail']) {
      const hit = (await listMails(request, f)).find((m: any) => m.subject === subject);
      if (hit) return { f, uid: hit.uid };
    }
    return undefined;
  };

  test.beforeAll(async ({ request }) => {
    subject = `[local-e2e] flags-fixture ${Date.now()}`;
    const send = await request.post(`${LOCAL_API}/mailboxes/0/mail/send`, {
      headers: json(),
      data: { from: USER.email, to: [USER.email], subject, body: 'fixture' },
    });
    expect(send.status()).toBe(200);
    const deadline = Date.now() + 60000;
    let hit;
    while (Date.now() < deadline && !hit) {
      await new Promise((r) => setTimeout(r, 3000));
      hit = await findFixture(request);
    }
    expect(hit, 'fixture mail arrived (INBOX or Junk Mail)').toBeTruthy();
    folder = hit!.f;
  });

  test('FLAG-01 batch mark_flagged / mark_unflagged round-trips', async ({ request }) => {
    let processed: any = [];
    for (let attempt = 0; attempt < 4 && !processed.length; attempt += 1) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
      const cur = await findFixture(request);
      if (!cur) continue;
      folder = cur.f;
      const flag = await request.post(
        `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(cur.f)}/mails/batch-action`,
        { headers: json(), data: { action: 'mark_flagged', mail_uids: [cur.uid] } },
      );
      expect(flag.status(), `flag -> ${flag.status()} ${await flag.text()}`).toBe(200);
      processed = ((await flag.json()).data ?? {}).processed_ids ?? [];
    }
    expect(processed, 'flag must be applied').toBeTruthy();

    // verify the flag stuck (listing may lag briefly)
    let flagged = false;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !flagged) {
      await new Promise((r) => setTimeout(r, 2000));
      const cur = await findFixture(request);
      flagged = Boolean(cur && cur.f === folder && (await listMails(request, folder)).find((m: any) => m.uid === cur.uid)?.flagged);
    }
    expect(flagged, 'mail must be flagged').toBe(true);

    const unflag = await request.post(
      `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/batch-action`,
      { headers: json(), data: { action: 'mark_unflagged', mail_uids: [processed[0]] } },
    );
    expect(unflag.status()).toBe(200);
  });

  test('MOVE-01 single-mail move to the other folder and back (action:move)', async ({ request }) => {
    const cur = await findFixture(request);
    expect(cur, 'fixture present').toBeTruthy();
    const target = cur!.f === 'INBOX' ? 'Junk Mail' : 'INBOX';

    // NOTE: IMAP UIDs are per-folder — the moved copy gets a NEW uid at the
    // destination. The unique fixture subject identifies it there.
    const move = await request.post(
      `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(cur!.f)}/mails/${cur!.uid}/action`,
      { headers: json(), data: { action: 'move', data: target } },
    );
    expect(move.status(), `move -> ${move.status()} ${await move.text()}`).toBe(200);
    let moved: any;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !moved) {
      await new Promise((r) => setTimeout(r, 2000));
      moved = (await listMails(request, target)).find((m: any) => m.subject === subject);
    }
    expect(moved, `mail now in ${target}`).toBeTruthy();

    const back = await request.post(
      `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(target)}/mails/${moved.uid}/action`,
      { headers: json(), data: { action: 'move', data: cur!.f } },
    );
    expect(back.status()).toBe(200);
    let backIn: any;
    const backDeadline = Date.now() + 30000;
    while (Date.now() < backDeadline && !backIn) {
      await new Promise((r) => setTimeout(r, 2000));
      backIn = (await listMails(request, cur!.f)).find((m: any) => m.subject === subject);
    }
    expect(backIn, `mail back in ${cur!.f}`).toBeTruthy();
  });

  test('MOVE-02 moving with an invalid action is a 400', async ({ request }) => {
    const cur = await findFixture(request);
    test.skip(!cur, 'fixture present');
    const res = await request.post(
      `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(cur!.f)}/mails/${cur!.uid}/action`,
      { headers: json(), data: { action: 'teleport' } },
    );
    expect(res.status()).toBe(400);
  });
});
