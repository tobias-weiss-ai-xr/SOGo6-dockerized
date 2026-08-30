// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local snooze surface (@local). Covers snooze-create / list / unsnooze-delete
// against the LOCAL stack, including the regression where DELETE /snooze/:id
// returned 500 (ModuleSnooze called nonexistent delete_from_table).
//
//   npx playwright test local-snooze.spec.ts

import { test, expect, apiLogin, cleanupLocalMail } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;

let token = '';

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'testuser@example.org', 'password123', LOCAL_API))!;
  expect(token).toBeTruthy();
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.afterAll(async ({ request }) => {
  await cleanupLocalMail();
});

test.describe('local snooze @local @mail', () => {
  test('SNOOZE-01 list snoozed mails (baseline)', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/snooze/`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.snoozed)).toBe(true);
  });

  test('SNOOZE-02 snooze an existing INBOX mail, then unsnooze via DELETE (regression)', async ({ request }) => {
    // grab the first INBOX mail uid via REST
    const list = await request.get(`${LOCAL_API}/mailboxes/0/folders/INBOX/mails`, { headers: auth() });
    expect(list.status()).toBe(200);
    const mails = (await list.json()).data ?? [];
    expect(mails.length).toBeGreaterThan(0);
    const uid = String(mails[0].uid);

    // create the snooze (real DB record)
    const create = await request.post(`${LOCAL_API}/snooze/`, {
      headers: json(),
      data: { account_id: '0', mail_uids: [uid], folder: 'INBOX', preset: 'tomorrow' },
    });
    expect(create.status(), `POST /snooze/ -> ${create.status()} ${await create.text()}`).toBe(200);
    const created = (await create.json()).data.snoozed[0];
    expect(created.mail_uid).toBe(uid);
    expect(created.snooze_until).toBeTruthy();

    // the record is visible in the list
    const afterCreate = await request.get(`${LOCAL_API}/snooze/`, { headers: auth() });
    const ids = ((await afterCreate.json()).data.snoozed ?? []).map((s: any) => s.id);
    expect(ids).toContain(created.id);

    // unsnooze (DELETE) — previously 500 due to delete_from_table
    const del = await request.delete(`${LOCAL_API}/snooze/${created.id}`, { headers: auth() });
    expect(del.status(), `DELETE /snooze/:id -> ${del.status()}`).toBe(200);
    const delBody = await del.json();
    expect(delBody.data.restored.id).toBe(created.id);

    const afterDel = await request.get(`${LOCAL_API}/snooze/`, { headers: auth() });
    const remaining = ((await afterDel.json()).data.snoozed ?? []).map((s: any) => s.id);
    expect(remaining).not.toContain(created.id);
  });

  test('SNOOZE-03 delete of an unknown snooze id is a clean 404', async ({ request }) => {
    const res = await request.delete(`${LOCAL_API}/snooze/999999`, { headers: auth() });
    expect(res.status()).toBe(404);
  });

  test('SNOOZE-04 GET with unknown id does not 5xx', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/snooze/999999`, { headers: auth() });
    // route only supports DELETE on the :id path, so GET is a clean 405
    expect([404, 405, 200]).toContain(res.status());
  });

  test('SNOOZE-05 unauthenticated snooze access is rejected', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/snooze/`);
    expect([401, 403]).toContain(res.status());
  });
});
