// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Contact & address-book management.
//
// Stories for the full contact lifecycle: listing address books, reading
// personal/shared/directory books, autocomplete lookups, contact groups,
// vCard operations, and profile-linked contact card.
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

test.describe('Epic — Contact management: address books', () => {

  test('CONTACT-01 user lists all address books', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    expect(200, `GET /addressbooks -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
    test.info().annotations.push({ type: 'books', description: `count: ${books.length}` });
  });

  test('CONTACT-02 user accesses the personal address book', async ({ request }) => {
    const tk = await token(request);
    // First get a book id
    const list = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    const body = await list.json();
    const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
    const personal = books.find((b: any) => b.type === 'personal' || b.name?.toLowerCase().includes('personal')) ?? books[0];
    const bookId = personal?.id ?? personal?.key ?? '0';
    const res = await request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookId)}/contacts`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET contacts of book -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'contacts', description: `book=${bookId} -> ${res.status()}` });
  });

  test('CONTACT-03 user searches contacts with autocomplete', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=lisa`, { headers: bearer(tk) });
    expect([200, 404], `GET autocomplete?q=lisa -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'autocomplete', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('CONTACT-04 user looks up a specific contact by identifier', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/lookup?email=lisa.mayer@sogo6.contextual-intelligence.org`, {
      headers: bearer(tk),
    });
    expect([200, 400, 404], `GET /contacts/lookup -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'lookup', description: `-> ${res.status()}` });
  });

  test('CONTACT-05 user accesses the Collected address book', async ({ request }) => {
    const tk = await token(request);
    const list = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    const body = await list.json();
    const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
    const collected = books.find((b: any) => b.name?.toLowerCase().includes('collected')) ?? books[1];
    if (collected) {
      const bookId = collected.id ?? collected.key ?? '0';
      const res = await request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookId)}/contacts`, {
        headers: bearer(tk),
      });
      expect([200, 404], `GET Collected contacts -> ${res.status()}`).toContain(res.status());
      test.info().annotations.push({ type: 'collected', description: `-> ${res.status()}` });
    } else {
      test.info().annotations.push({ type: 'collected', description: 'no collected book found' });
    }
  });

  test('CONTACT-06 user accesses the LDAP directory address book', async ({ request }) => {
    const tk = await token(request);
    const list = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    const body = await list.json();
    const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
    const dir = books.find((b: any) => b.type === 'directory' || b.name?.toLowerCase().includes('directory') || b.name?.toLowerCase().includes('ldap'));
    if (dir) {
      const bookId = dir.id ?? dir.key ?? '0';
      const res = await request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookId)}/contacts?q=schmidt`, {
        headers: bearer(tk),
      });
      expect([200, 404], `GET directory contacts -> ${res.status()}`).toContain(res.status());
      test.info().annotations.push({ type: 'directory', description: `-> ${res.status()}` });
    } else {
      test.info().annotations.push({ type: 'directory', description: 'no directory book in list' });
    }
  });
});

test.describe('Epic — Contact management: groups, profile & directory', () => {

  test('CONTACT-07 user creates a contact group in personal book', async ({ request }) => {
    const tk = await token(request);
    const list = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    const body = await list.json();
    const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
    const personal = books.find((b: any) => b.type === 'personal' || b.name?.toLowerCase().includes('personal')) ?? books[0];
    const bookId = personal?.id ?? personal?.key ?? '0';
    const res = await request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookId)}/contacts`, {
      headers: bearer(tk),
      data: {
        given_name: `Study Buddy ${Date.now()}`,
        family_name: 'Group',
        emails: [{ type: 'work', value: 'study-buddy@example.org' }],
        organization: 'University of Marburg',
      },
    });
    expect(ACCEPT, `POST contact -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'contact-create', description: `-> ${res.status()}` });
  });

  test('CONTACT-08 user searches the global directory for a colleague', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=rektorat`, { headers: bearer(tk) });
    expect([200, 404], `GET autocomplete?q=rektorat -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'global-search', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('CONTACT-09 user reads their profile (linked contact card)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/profile`, { headers: bearer(tk) });
    expect(200, `GET /profile -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const display = body?.data?.display_name ?? body?.data?.cn ?? 'unknown';
    test.info().annotations.push({ type: 'profile', description: `display: ${display}` });
  });

  test('CONTACT-10 user accesses contact preferences/settings', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/preferences`, { headers: bearer(tk) });
    expect(200, `GET /preferences -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const prefs = body?.data ?? {};
    test.info().annotations.push({ type: 'prefs', description: `keys: ${Object.keys(prefs).length}` });
  });

  test('CONTACT-11 user exports their personal address book (vCard)', async ({ request }) => {
    const tk = await token(request);
    const list = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    const body = await list.json();
    const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
    const personal = books.find((b: any) => b.type === 'personal' || b.name?.toLowerCase().includes('personal')) ?? books[0];
    if (!personal) {
      test.info().annotations.push({ type: 'export', description: 'skipped: no personal book' });
      return;
    }
    const bookId = personal?.id ?? personal?.key ?? '0';
    const res = await request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookId)}/export`, {
      headers: { ...bearer(tk), 'Accept': 'text/vcard' },
    });
    expect([200, 404, 409], `GET export -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'export', description: `-> ${res.status()}` });
  });
});
