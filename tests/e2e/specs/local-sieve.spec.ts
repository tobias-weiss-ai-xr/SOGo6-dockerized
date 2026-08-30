// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local REST sieve-filter surface (@local).
//
// Exercises the full ManageSieve-backed lifecycle against the LOCAL stack:
// list/create/read/update/reorder/delete, templates, validate, preview,
// vacation, forward, and the idempotent /filters/push regression.
// The behavioural test sends a real mail through the Stalwart SMTP pipeline
// and asserts the sieve "fileinto" fired on delivery (needs the sieve server
// connection to work — see SOGO_D_SIEVE_ENCRYPTION=StartTLS +
// SOGO_D_SIEVE_VERIFY_CERT=false in the local seed).
//
//   npx playwright test local-sieve.spec.ts

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
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

// registered names so we can clean up after ourselves
let createdFilter: string | null = null;

async function listFilters(request: any): Promise<any[]> {
  const res = await request.get(`${LOCAL_API}/mailboxes/0/filters`, { headers: auth() });
  expect(res.status(), `GET /filters -> ${res.status()}`).toBe(200);
  const body = await res.json();
  return body?.data?.filters ?? [];
}

test.afterAll(async ({ request }) => {
  // Restore a clean filter state (empty list) for subsequent runs.
  await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
    headers: json(),
    data: { filters: [] },
  });
  await cleanupLocalMail();
});

test.describe('local sieve filter lifecycle @local @mail', () => {
  test('SIEVE-01 list filters returns 200 with a filters array', async ({ request }) => {
    const filters = await listFilters(request);
    expect(Array.isArray(filters)).toBe(true);
  });

  test('SIEVE-02 create a filter (fileinto subject match) and read it back', async ({ request }) => {
    const name = `${MARKER}sieve-create-${Date.now()}`.trim();
    createdFilter = name;
    const rules = { field: 'subject', operator: 'contains', value: '[e2e-spam]' };
    const actions = [{ method: 'fileinto', arguments: { folders: ['Junk Mail'] } }];
    const res = await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
      headers: json(),
      data: { filters: [{ name, enabled: true, rules, actions }] },
    });
    expect(res.status(), `POST /filters -> ${res.status()}`).toBe(200);
    expect((await res.json()).error_code).toBe('S000000');

    const filters = await listFilters(request);
    const created = filters.find((f: any) => f.name === name);
    expect(created).toBeTruthy();
    expect(created.rules.field).toBe('subject');
    expect(created.actions[0].method).toBe('fileinto');
  });

  test('SIEVE-03 get a single filter by name', async ({ request }) => {
    const name = createdFilter ?? `${MARKER}sieve-single-${Date.now()}`.trim();
    if (!createdFilter) {
      await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
        headers: json(),
        data: { filters: [{ name, enabled: true, rules: { field: 'subject', operator: 'contains', value: 'x' }, actions: [{ method: 'keep' }] }] },
      });
      createdFilter = name;
    }
    const res = await request.get(`${LOCAL_API}/mailboxes/0/filters/${encodeURIComponent(name)}`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.filter.name).toBe(name);
  });

  test('SIEVE-04 update (PUT) deactivates a filter', async ({ request }) => {
    const name = createdFilter!;
    const res = await request.put(`${LOCAL_API}/mailboxes/0/filters/${encodeURIComponent(name)}`, {
      headers: json(),
      data: { name, enabled: false, rules: { field: 'subject', operator: 'contains', value: '[e2e-spam]' }, actions: [{ method: 'fileinto', arguments: { folders: ['Junk Mail'] } }] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const updated = (body.data.filters ?? []).find((f: any) => f.name === name);
    expect(updated.enabled).toBe(false);
  });

  test('SIEVE-05 reorder requires existing names (404 on unknown)', async ({ request }) => {
    const res = await request.patch(`${LOCAL_API}/mailboxes/0/filters/reorder`, {
      headers: json(),
      data: { order: ['does-not-exist-anywhere'] },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error_code).toBeTruthy();
  });

  test('SIEVE-06 reorder (PATCH) with real names returns 200', async ({ request }) => {
    const a = `${MARKER}sieve-reorder-a-${Date.now()}`;
    const b = `${MARKER}sieve-reorder-b-${Date.now()}`;
    await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
      headers: json(),
      data: { filters: [
        { name: a, enabled: true, rules: { field: 'subject', operator: 'contains', value: 'a' }, actions: [{ method: 'keep' }] },
        { name: b, enabled: true, rules: { field: 'subject', operator: 'contains', value: 'b' }, actions: [{ method: 'keep' }] },
      ] },
    });
    const res = await request.patch(`${LOCAL_API}/mailboxes/0/filters/reorder`, {
      headers: json(),
      data: { order: [b, a] },
    });
    expect(res.status(), `PATCH /filters/reorder -> ${res.status()}`).toBe(200);
    const filters = await listFilters(request);
    const names = filters.map((f: any) => f.name);
    expect(names.indexOf(b)).toBeLessThan(names.indexOf(a));
    createdFilter = null;
  });

  test('SIEVE-07 validate accepts a well-formed filter and rejects over/under misuse', async ({ request }) => {
    const good = {
      name: 'ok',
      enabled: true,
      rules: { field: 'subject', operator: 'contains', value: 'x' },
      actions: [{ method: 'fileinto', arguments: { folders: ['INBOX'] } }],
    };
    const res = await request.post(`${LOCAL_API}/mailboxes/0/filters/validate`, {
      headers: json(),
      data: good,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.valid).toBe(true);

    const bad = {
      name: 'bad',
      enabled: true,
      rules: { field: 'subject', operator: 'over', value: '3' },
      actions: [{ method: 'keep' }],
    };
    const badRes = await request.post(`${LOCAL_API}/mailboxes/0/filters/validate`, {
      headers: json(),
      data: bad,
    });
    // "over" is only valid with field=size -> schema-level 400.
    expect(badRes.status()).toBe(400);
  });

  test('SIEVE-08 preview matches a sample header and reports the action', async ({ request }) => {
    const filter = {
      name: 'preview',
      rules: { field: 'subject', operator: 'contains', value: '[e2e-spam]' },
      actions: [{ method: 'fileinto', arguments: { folders: ['Junk Mail'] } }],
    };
    const match = await request.post(`${LOCAL_API}/mailboxes/0/filters/preview`, {
      headers: json(),
      data: { filter, headers: { subject: 'Buy now [e2e-spam] cheap!' } },
    });
    expect(match.status()).toBe(200);
    expect((await match.json()).data.matched).toBe(true);
    expect((await match.json()).data.action.method).toBe('fileinto');

    const noMatch = await request.post(`${LOCAL_API}/mailboxes/0/filters/preview`, {
      headers: json(),
      data: { filter, headers: { subject: 'totally unrelated' } },
    });
    expect(noMatch.status()).toBe(200);
    expect((await noMatch.json()).data.matched).toBe(false);
  });

  test('SIEVE-09 templates are served', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/mailboxes/0/filters/templates`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('SIEVE-10 push is idempotent (regression: no-op UPDATE must not 500)', async ({ request }) => {
    if (!createdFilter) {
      createdFilter = `${MARKER}sieve-push-${Date.now()}`;
      await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
        headers: json(),
        data: { filters: [{ name: createdFilter, enabled: true, rules: { field: 'subject', operator: 'contains', value: 'x' }, actions: [{ method: 'keep' }] }] },
      });
    }
    const first = await request.post(`${LOCAL_API}/mailboxes/0/filters/push`, {
      headers: json(),
      data: {},
    });
    expect(first.status(), `push #1 -> ${first.status()}`).toBe(200);
    // Second push re-persists identical content (MySQL: 0 affected rows).
    const second = await request.post(`${LOCAL_API}/mailboxes/0/filters/push`, {
      headers: json(),
      data: {},
    });
    expect(second.status(), `push #2 (idempotent) -> ${second.status()}`).toBe(200);
  });

  test('SIEVE-11 vacation round-trip', async ({ request }) => {
    const subject = `${MARKER}sieve-vacation`;
    const res = await request.post(`${LOCAL_API}/mailboxes/0/vacation`, {
      headers: json(),
      data: { Vacation: { enabled: true, auto_reply_text: 'away on e2e', custom_subject: subject, custom_subject_enabled: true } },
    });
    expect(res.status(), `POST /vacation -> ${res.status()}`).toBe(200);
    expect((await res.json()).error_code).toBe('S000000');

    const get = await request.get(`${LOCAL_API}/mailboxes/0/vacation`, { headers: auth() });
    expect(get.status()).toBe(200);
    const vac = (await get.json()).data.vacation;
    expect(vac.enabled).toBe(true);
    expect(vac.auto_reply_text).toBe('away on e2e');
  });

  test('SIEVE-12 forward round-trip', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/mailboxes/0/forward`, {
      headers: json(),
      data: { Forward: { enabled: true, forward_address: ['elsewhere@example.org'], keep_copy: true } },
    });
    expect(res.status(), `POST /forward -> ${res.status()}`).toBe(200);
    expect((await res.json()).error_code).toBe('S000000');

    const get = await request.get(`${LOCAL_API}/mailboxes/0/forward`, { headers: auth() });
    expect(get.status()).toBe(200);
    const fwd = (await get.json()).data.forward;
    expect(fwd.enabled).toBe(true);
    expect(fwd.forward_address).toContain('elsewhere@example.org');
  });

  test('SIEVE-13 delete a filter and confirm it disappears', async ({ request }) => {
    const name = `${MARKER}sieve-delete-${Date.now()}`;
    await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
      headers: json(),
      data: { filters: [{ name, enabled: true, rules: { field: 'subject', operator: 'contains', value: 'x' }, actions: [{ method: 'keep' }] }] },
    });
    const del = await request.delete(`${LOCAL_API}/mailboxes/0/filters/${encodeURIComponent(name)}`, {
      headers: auth(),
    });
    expect(del.status(), `DELETE /filters/:id -> ${del.status()}`).toBe(200);
    const filters = await listFilters(request);
    expect(filters.find((f: any) => f.name === name)).toBeUndefined();
  });
});

test.describe('local sieve behaviour @local @mail', () => {
  test('SIEVE-14 a delivered mail matching a fileinto filter lands in the target folder', async ({ request }) => {
    const ts = Date.now();
    const folder = `e2e-sieve-trap-${ts}`;
    const marker = `[e2e-sieve-${ts}]`;
    const subject = `${MARKER}behaviour ${marker}`;

    // 1) Create a unique filter: subject contains marker -> fileinto folder.
    const setRes = await request.post(`${LOCAL_API}/mailboxes/0/filters`, {
      headers: json(),
      data: { filters: [{ name: 'zze2e-behaviour', enabled: true, rules: { field: 'subject', operator: 'contains', value: marker }, actions: [{ method: 'fileinto', arguments: { folders: [folder], create_if_no_exist: true } }] }] },
    });
    expect(setRes.status()).toBe(200);

    // 2) Send a real mail through the Stalwart SMTP pipeline (self-send).
    const sendRes = await request.post(`${LOCAL_API}/mailboxes/0/mail/send`, {
      headers: json(),
      data: { from: 'testuser@example.org', to: ['testuser@example.org'], subject, body: 'sieve behavioural probe' },
    });
    expect(sendRes.status(), `send -> ${sendRes.status()} ${await sendRes.text()}`).toBe(200);

    // 3) Poll the target folder over the REST API until the mail appears.
    let found = false;
    for (let i = 0; i < 20; i += 1) {
      const res = await request.get(`${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails`, {
        headers: auth(),
      });
      if (res.status() === 200) {
        const mails = (await res.json()).data ?? [];
        if (mails.some((m: any) => m.subject === subject)) {
          found = true;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(found, `mail matching sieve filter must be filed into ${folder}`).toBe(true);

    // 4) Cleanup: delete the trap folder + restore empty filters.
    await request.delete(`${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}`, {
      headers: auth(),
    });
    await request.post(`${LOCAL_API}/mailboxes/0/filters`, { headers: json(), data: { filters: [] } });
  });
});
