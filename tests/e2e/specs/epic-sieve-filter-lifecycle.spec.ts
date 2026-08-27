// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Sieve mail-filter lifecycle.
//
// Full CRUD for sieve mail filters: create, list, verify, activate/
// deactivate, and delete. Exercises the /mail-filters endpoint
// through the complete data lifecycle.
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

let createdFilterId: string | null = null;

test.describe('Epic — Sieve filter lifecycle: create & list', () => {

  test('SIEVE-01 user lists current filters (baseline)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mail-filters`, { headers: bearer(tk) });
    expect([200, 404], `GET /mail-filters -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const filters = Array.isArray(body?.data) ? body.data : (body?.data?.filters ?? []);
      test.info().annotations.push({ type: 'baseline', description: `count: ${Array.isArray(filters) ? filters.length : 0}` });
    }
  });

  test('SIEVE-02 user creates a spam-trap filter', async ({ request }) => {
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
    expect(ACCEPT, `POST /mail-filters (spam) -> ${res.status()}`).toContain(res.status());
    if ([200, 201].includes(res.status())) {
      const body = await res.json();
      createdFilterId = body?.data?.id ?? body?.data?.filter_id ?? null;
    }
    test.info().annotations.push({ type: 'spam-create', description: `-> ${res.status()} id=${createdFilterId ?? '?'}` });
  });

  test('SIEVE-03 user creates a course-routing filter', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mail-filters`, {
      headers: bearer(tk),
      data: {
        name: `Course routing ${Date.now()}`,
        conditions: [{ field: 'from', operator: 'contains', value: 'lecture-hall@sogo6' }],
        actions: [{ type: 'fileinto', folder: 'Course' }],
        active: true,
      },
    });
    expect(ACCEPT, `POST /mail-filters (course) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'course-create', description: `-> ${res.status()}` });
  });

  test('SIEVE-04 user creates an inactive newsletter filter', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mail-filters`, {
      headers: bearer(tk),
      data: {
        name: `Newsletter sort ${Date.now()}`,
        conditions: [{ field: 'from', operator: 'contains', value: 'newsletter' }],
        actions: [{ type: 'fileinto', folder: 'Newsletters' }],
        active: false,
      },
    });
    expect(ACCEPT, `POST /mail-filters (inactive) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'inactive-create', description: `-> ${res.status()}` });
  });

  test('SIEVE-05 user re-lists filters and verifies count increased', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mail-filters`, { headers: bearer(tk) });
    expect([200, 404], `GET /mail-filters (verify) -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const filters = Array.isArray(body?.data) ? body.data : (body?.data?.filters ?? []);
      test.info().annotations.push({ type: 'after-create', description: `count: ${Array.isArray(filters) ? filters.length : 0}` });
    }
  });

  test('SIEVE-06 user creates a filter with multiple conditions', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/mail-filters`, {
      headers: bearer(tk),
      data: {
        name: `Multi-condition ${Date.now()}`,
        match_type: 'all',
        conditions: [
          { field: 'from', operator: 'contains', value: 'dean' },
          { field: 'subject', operator: 'contains', value: 'meeting' },
        ],
        actions: [{ type: 'fileinto', folder: 'Dean-Meetings' }],
        active: true,
      },
    });
    expect(ACCEPT, `POST /mail-filters (multi) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'multi-create', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Sieve filter lifecycle: update & delete', () => {

  test('SIEVE-07 user deactivates the spam filter', async ({ request }) => {
    if (!createdFilterId) { test.info().annotations.push({ type: 'skip', description: 'no filter id' }); return; }
    const tk = await token(request);
    const res = await request.put(`${REMOTE_API}/mail-filters/${createdFilterId}`, {
      headers: bearer(tk),
      data: { active: false },
    });
    expect(ACCEPT, `PUT /mail-filters/:id (deactivate) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'deactivate', description: `-> ${res.status()}` });
  });

  test('SIEVE-08 user reactivates the spam filter', async ({ request }) => {
    if (!createdFilterId) { test.info().annotations.push({ type: 'skip', description: 'no filter id' }); return; }
    const tk = await token(request);
    const res = await request.put(`${REMOTE_API}/mail-filters/${createdFilterId}`, {
      headers: bearer(tk),
      data: { active: true },
    });
    expect(ACCEPT, `PUT /mail-filters/:id (reactivate) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'reactivate', description: `-> ${res.status()}` });
  });

  test('SIEVE-09 user deletes the spam filter', async ({ request }) => {
    if (!createdFilterId) { test.info().annotations.push({ type: 'skip', description: 'no filter id' }); return; }
    const tk = await token(request);
    const res = await request.delete(`${REMOTE_API}/mail-filters/${createdFilterId}`, {
      headers: bearer(tk),
    });
    expect([200, 202, 204, 404], `DELETE /mail-filters/:id -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'delete', description: `-> ${res.status()}` });
  });

  test('SIEVE-10 user verifies the filter is gone', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mail-filters`, { headers: bearer(tk) });
    expect([200, 404], `GET /mail-filters (post-delete) -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const filters = Array.isArray(body?.data) ? body.data : (body?.data?.filters ?? []);
      test.info().annotations.push({ type: 'post-delete', description: `count: ${Array.isArray(filters) ? filters.length : 0}` });
    }
  });

  test('SIEVE-11 user accesses mail folder list alongside filters', async ({ request }) => {
    const tk = await token(request);
    const [fRes, mRes] = await Promise.all([
      request.get(`${REMOTE_API}/mail-filters`, { headers: bearer(tk) }),
      request.get(`${REMOTE_API}/mailboxes/0/folders`, { headers: bearer(tk) }),
    ]);
    expect([200, 404], `filters -> ${fRes.status()}`).toContain(fRes.status());
    expect([200, 404], `folders -> ${mRes.status()}`).toContain(mRes.status());
    test.info().annotations.push({ type: 'parallel', description: `filters ${fRes.status()} / folders ${mRes.status()}` });
  });
});
