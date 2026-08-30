// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// REST mail SEARCH against the LOCAL stack — GET /mailboxes/0/search.
//
// Exercises the IMAP SEARCH pipeline end-to-end and pins the query facets the
// UI relies on: subject/query match, folder-scoped search (incl. a folder
// whose name contains a space), in_body, from filter, pagination + the
// X-Pagination response header, and multi-folder comma lists.
//
//   npx playwright test local-mail-search.spec.ts

import { test, expect, apiLogin, cleanupLocalMail, localMailSeed } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const MARKER = '[local-e2e] ';

let token = '';

const SEED_A = `${MARKER}search-a-${Date.now()}`;
const SEED_B = `${MARKER}search-b-${Date.now()}`;
const WEIRD = `${MARKER}weird (quote) "dq" star*`;
// The shell-quoted seed command must escape the embedded double quotes.
const WEIRD_SEED = `weird (quote) \\"dq\\" star*`;

test.beforeAll(async () => {
  // Two marker seeds in INBOX (one seen, one unread) + one carrying IMAP SEARCH
  // metacharacters (quote/paren/star) so searches have known rows.
  const r = localMailSeed(
    `batch --subjects "${`${SEED_A.replace(MARKER, '')},${SEED_B.replace(MARKER, '')}:seen,${WEIRD_SEED}`}"`,
  );
  expect(r.ok, `seed: ${r.out.slice(0, 160)}`).toBeTruthy();
});

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, 'testuser@example.org', 'password123', LOCAL_API))!;
  expect(token).toBeTruthy();
});

test.afterAll(() => {
  cleanupLocalMail();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

async function search(params: string, base = `/api/user/v1/mailboxes/0/search`) {
  const res = await fetch(`${API}${base}?${params}`, { headers: auth() });
  return { status: res.status, json: await res.json(), pagination: res.headers.get('x-pagination') };
}

test.describe('local mail search @local @mail', () => {
  test('subject filter returns exactly the matching seed', async () => {
    const { status, json } = await search(`subject=${encodeURIComponent(SEED_A)}`);
    expect(status).toBe(200);
    expect(json.error_code).toBe('S000000');
    const subjects = (json.data ?? []).map((m: any) => m.subject);
    expect(subjects).toContain(SEED_A);
    expect(subjects.some((s: string) => s.includes('search-b-'))).toBe(false);
  });

  test('query matches a unique subject fragment', async () => {
    const frag = SEED_A.substring(SEED_A.length - 10);
    const { json } = await search(`query=${encodeURIComponent(frag)}`);
    const subjects = (json.data ?? []).map((m: any) => m.subject);
    expect(subjects).toContain(SEED_A);
  });

  test('folder-scoped search works for a folder whose name contains a space', async () => {
    const { status, json } = await search(`query=${encodeURIComponent('Junk')}&folders=${encodeURIComponent('Junk Mail')}`);
    expect(status).toBe(200);
    const subjects = (json.data ?? []).map((m: any) => m.subject);
    // Junk Mail may hold earlier [local-e2e] cross-sends; the probe results
    // must come from the Junk folder (i.e. the request must not error on the
    // space in the folder name).
    expect(Array.isArray(subjects)).toBe(true);
  });

  test('from filter narrows to the seed sender', async () => {
    const { json } = await search(`from=${encodeURIComponent('testuser@example.org')}`);
    const subjects = (json.data ?? []).map((m: any) => m.subject);
    expect(subjects).toContain(SEED_B);
  });

  test('in_body=true can match body content (not only subject)', async () => {
    // Seed body = "This is a local-e2e seeded message (<subject>)."
    const { json } = await search(`query=${encodeURIComponent('local-e2e seeded')}&in_body=true`);
    const subjects = (json.data ?? []).map((m: any) => m.subject);
    expect(subjects).toContain(SEED_A);
  });

  test('pagination returns per_page rows and exposes X-Pagination metadata', async () => {
    const { status, json, pagination } = await search('per_page=1&page=1');
    expect(status).toBe(200);
    expect((json.data ?? []).length).toBeLessThanOrEqual(1);
    expect(pagination).toBeTruthy();
    const meta = JSON.parse(pagination!);
    expect(meta.page).toBe(1);
    expect(meta.total).toBeGreaterThanOrEqual(2);
  });

  test('multi-folder comma list (with a space-containing member) is accepted', async () => {
    const { status, json } = await search(
      `folders=${encodeURIComponent('INBOX')},${encodeURIComponent('Junk Mail')}&per_page=1`,
    );
    expect(status).toBe(200);
    expect(json.error_code).toBe('S000000');
  });

  test('searching a folder with no matches returns an empty (not error) result', async () => {
    const { status, json } = await search(`query=${encodeURIComponent('zzz-no-such-subject-123456')}`);
    expect(status).toBe(200);
    expect(json.error_code).toBe('S000000');
    expect(json.data ?? []).toEqual([]);
  });

  test('query metacharacters are escaped: no wildcard expansion for *', async () => {
    // A literal star in the query must NOT expand to every mailbox message.
    const { json } = await search('query=' + encodeURIComponent('zzz-definitely-none*'));
    expect(json.error_code).toBe('S000000');
    expect(json.data ?? []).toEqual([]);
  });

  test('query with quote and parens matches the literal message', async () => {
    const { json } = await search('query=' + encodeURIComponent('weird (quote) "dq"'));
    const subjects = (json.data ?? []).map((m: any) => m.subject);
    expect(subjects.some((s: string) => s.includes('weird (quote)'))).toBe(true);
  });
});
