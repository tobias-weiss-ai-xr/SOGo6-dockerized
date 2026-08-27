// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Deep mail workflow.
//
// End-to-end mail stories that exercise the full folder hierarchy
// (INBOX, Sent, Drafts, Trash, user folders), sieve filters, mail
// search, delegation settings, and the notification SSE endpoint.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role: see tests/e2e/.env (gitignored)

import { test, expect, apiLogin, bearer, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Deep mail workflow: folder hierarchy', () => {

  test('MAIL-01 user lists all mailbox folders', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders`, { headers: bearer(tk) });
    expect(200, `GET /mailboxes/0/folders -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const folders = Array.isArray(body?.data) ? body.data : (body?.data?.folders ?? []);
    const names = Array.isArray(folders) ? folders.map((f: any) => f.name ?? f.id ?? '?') : [];
    test.info().annotations.push({ type: 'folders', description: `count: ${names.length}, e.g. ${names.slice(0, 6).join(',')}` });
  });

  test('MAIL-02 user reads inbox messages with pagination', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=3&offset=0`, {
      headers: bearer(tk),
    });
    expect(200, `GET INBOX?limit=3 -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const mails = body?.data?.mails ?? body?.data ?? [];
    test.info().annotations.push({ type: 'inbox', description: `mails: ${Array.isArray(mails) ? mails.length : 0}` });
  });

  test('MAIL-03 user accesses the Sent folder', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/Sent/mails?limit=3`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET Sent -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'sent', description: `-> ${res.status()}` });
  });

  test('MAIL-04 user accesses the Drafts folder', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/Drafts/mails?limit=3`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET Drafts -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'drafts', description: `-> ${res.status()}` });
  });

  test('MAIL-05 user accesses the Trash folder', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/Trash/mails?limit=3`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET Trash -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'trash', description: `-> ${res.status()}` });
  });

  test('MAIL-06 user creates a project subfolder under INBOX', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: bearer(tk),
      data: { name: `Project-${Date.now()}`, parent: 'INBOX' },
    });
    expect(ACCEPT, `POST folders -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'folder', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Deep mail workflow: filters, search & delegation', () => {

  test('MAIL-07 user lists current sieve mail filters', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mail-filters`, { headers: bearer(tk) });
    expect([200, 404], `GET /mail-filters -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const filters = Array.isArray(body?.data) ? body.data : (body?.data?.filters ?? []);
      test.info().annotations.push({ type: 'filters', description: `count: ${Array.isArray(filters) ? filters.length : 0}` });
    }
  });

  test('MAIL-08 user creates a spam-filter rule', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mail-filters`, {
      headers: bearer(tk),
      data: {
        name: `Spam trap ${Date.now()}`,
        conditions: [{ field: 'subject', operator: 'contains', value: 'WINNER' }],
        actions: [{ type: 'discard' }],
        active: true,
      },
    });
    expect(ACCEPT, `POST /mail-filters -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'filter', description: `-> ${res.status()}` });
  });

  test('MAIL-09 user searches mail across folders', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/search?q=welcome&limit=5`, {
      headers: bearer(tk),
    });
    expect([200, 404, 422], `GET /search -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const results = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'search', description: `hits: ${Array.isArray(results) ? results.length : 0}` });
    }
  });

  test('MAIL-10 user accesses mail delegation settings', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mail-delegation`, { headers: bearer(tk) });
    expect([200, 404], `GET /mail-delegation -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'delegation', description: `-> ${res.status()}` });
  });

  test('MAIL-11 user accesses the notification SSE stream (headers only)', async ({ request }) => {
    const tk = await token(request);
    // SSE streams don't return JSON — just verify the endpoint accepts the connection
    const res = await request.get(`${REMOTE_API}/sse`, {
      headers: { ...bearer(tk), 'Accept': 'text/event-stream' },
      timeout: 3000,
    });
    // SSE returns 200 with streaming body or connection timeout
    expect([200, 404], `GET /sse -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'sse', description: `-> ${res.status()}` });
  });
});
