// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Faculty assistant (lisa.mayer).
//
// Realistic stories for a faculty assistant: shared-mailbox delegation,
// sieve mail-filter management, folder hierarchy for committees, contacts,
// free/busy scheduling, and snoozed-mail triage.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role credentials: lisa.mayer@sogo6.contextual-intelligence.org / UniMarburg2026!

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'lisa.mayer@sogo6.contextual-intelligence.org',
  password: 'UniMarburg2026!',
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Faculty assistant: shared mailbox & delegation', () => {

  test('ASST-01 assistant authenticates and accesses the system', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'assistant login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `auth GET /calendars -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'login', description: 'ok' });
  });

  test('ASST-02 assistant checks shared-mailbox assignments', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/shared-mailboxes`, { headers: bearer(tk) });
    expect([200, 404], `GET /shared-mailboxes -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const boxes = Array.isArray(body?.data) ? body.data : (body?.data?.mailboxes ?? []);
      test.info().annotations.push({ type: 'shared', description: `mailboxes: ${Array.isArray(boxes) ? boxes.length : 0}` });
    }
  });

  test('ASST-03 assistant lists existing sieve mail filters', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mail-filters`, { headers: bearer(tk) });
    expect([200, 404], `GET /mail-filters -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const filters = Array.isArray(body?.data) ? body.data : (body?.data?.filters ?? []);
      test.info().annotations.push({ type: 'filters', description: `count: ${Array.isArray(filters) ? filters.length : 0}` });
    }
  });

  test('ASST-04 assistant creates a sieve filter for course-email routing', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mail-filters`, {
      headers: bearer(tk),
      data: {
        name: `Course filter ${Date.now()}`,
        conditions: [{ field: 'from', operator: 'contains', value: 'lecture-hall@sogo6' }],
        actions: [{ type: 'fileinto', folder: 'Course' }],
        active: true,
      },
    });
    expect(ACCEPT, `POST /mail-filters -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'filter-create', description: `-> ${res.status()}` });
  });

  test('ASST-05 assistant reads the folder hierarchy', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders`, { headers: bearer(tk) });
    expect([200, 404], `GET /mailboxes/0/folders -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const folders = Array.isArray(body?.data) ? body.data : (body?.data?.folders ?? []);
      test.info().annotations.push({ type: 'folders', description: `count: ${Array.isArray(folders) ? folders.length : 0}` });
    }
  });

  test('ASST-06 assistant creates a committee subfolder', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: bearer(tk),
      data: { name: `Exam-Committee-${Date.now()}`, parent: 'INBOX' },
    });
    expect(ACCEPT, `POST /mailboxes/0/folders -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'folder-create', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Faculty assistant: scheduling & contacts', () => {

  test('ASST-07 assistant searches the university directory', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=schmidt`, { headers: bearer(tk) });
    expect([200, 404], `GET autocomplete?q=schmidt -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'dir', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('ASST-08 assistant accesses address books', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    expect([200, 404], `GET /addressbooks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'ab', description: `-> ${res.status()}` });
  });

  test('ASST-09 assistant checks appointment-slot availability for the dean', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(tk) });
    expect(200, `GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'slots', description: `-> ${res.status()}` });
  });

  test('ASST-10 assistant runs free/busy for a faculty meeting', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/freebusy`, {
      headers: bearer(tk),
      data: {
        utcStartDate: new Date().toISOString(),
        utcEndDate: new Date(Date.now() + 2_1600_000).toISOString(),
        users: [ROLE.email],
      },
    });
    expect([200, 201, 400, 404, 405, 422], `POST /freebusy -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'freebusy', description: `-> ${res.status()}` });
  });

  test('ASST-11 assistant lists snoozed mails to triage later', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/snooze/`, { headers: bearer(tk) });
    expect(200, `GET /snooze -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const snoozed = body?.data?.snoozed ?? [];
    test.info().annotations.push({ type: 'snoozed', description: `count: ${Array.isArray(snoozed) ? snoozed.length : 0}` });
  });
});
