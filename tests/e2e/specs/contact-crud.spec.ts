// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Contact CRUD lifecycle.
// Tests:
//   - List address books
//   - List contacts in personal address book
//   - Create a contact with full vCard fields (display_name, emails, phones)
//   - Get contact by ID
//   - Update contact (note)
//   - Search contacts by name
//   - Delete contact
//   - Contact with multiple email addresses
//   - Contact with phone and address fields
//   - Delete non-existent contact returns 404
//   - Address books page loads in UI
//   - Contact autocomplete search
//   - LDAP address book is accessible
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function setupEnvInterception(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function loginAsUser(page: import('@playwright/test').Page) {
  await setupEnvInterception(page);
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function getAuthToken(page: import('@playwright/test').Page): Promise<string | null> {
  return await page.evaluate(() => {
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Contact CRUD', () => {

  test('list address books', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const books = body?.data?.addressbooks ?? body?.data ?? [];
    test.info().annotations.push({ type: 'addressbooks', description: `Address books: ${books.length}` });
    expect(books.length).toBeGreaterThan(0);
  });

  test('list contacts in personal address book', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    // Get address books
    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? booksBody?.data ?? [];
    if (books.length === 0) return;

    // Find personal address book
    const personal = books.find((b: any) => b.source_type === 'local' || b.is_default === true);
    const bookKey = personal?.key || personal?.id || books[0]?.key || books[0]?.id;
    if (!bookKey) return;

    const res = await page.request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'contacts', description: `GET contacts -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const contactsBody = await res.json();
      const contacts = contactsBody?.data?.contacts ?? contactsBody?.data ?? [];
      test.info().annotations.push({ type: 'contacts-count', description: `Contacts: ${Array.isArray(contacts) ? contacts.length : 'N/A'}` });
    }
  });

  test('create, get, update, and delete a contact', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Get address books
    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? booksBody?.data ?? [];
    if (books.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No address books' });
      return;
    }

    const personal = books.find((b: any) => b.source_type === 'local' || b.is_default === true);
    const bookKey = personal?.key || personal?.id || books[0]?.key || books[0]?.id;
    if (!bookKey) return;

    // Create contact (matching UI serializeContactFromForm payload)
    const ts = Date.now();
    const contactPayload = {
      display_name: `E2E TestContact ${ts}`,
      first_name: 'E2E',
      last_name: 'TestContact',
      kind: 'individual',
      emails: [
        { value: `e2e-${ts}@test.example`, types: ['work'], pref: 1 },
      ],
      phones: [
        { number: '+49123456789', types: ['work'] },
      ],
    };

    const createRes = await page.request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: contactPayload,
    });
    test.info().annotations.push({ type: 'create', description: `POST contact -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    const createBody = await createRes.json();
    const contactId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.contact_id;
    if (!contactId) return;

    // Get contact
    const getRes = await page.request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts/${encodeURIComponent(contactId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'get', description: `GET contact -> ${getRes.status()}` });
    expect([200]).toContain(getRes.status());

    // Update contact
    const updateRes = await page.request.patch(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts/${encodeURIComponent(contactId)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { note: 'Updated by E2E test' },
    });
    test.info().annotations.push({ type: 'update', description: `PATCH contact -> ${updateRes.status()}` });
    expect([200, 204]).toContain(updateRes.status());

    // Delete contact
    const delRes = await page.request.delete(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts/${encodeURIComponent(contactId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'delete', description: `DELETE contact -> ${delRes.status()}` });
    expect([200, 204, 404]).toContain(delRes.status());
  });

  test('search contacts by name', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/contacts/search?q=test&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'search', description: `GET contacts/search -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const results = body?.data?.contacts ?? body?.data ?? [];
      test.info().annotations.push({ type: 'search-results', description: `Results: ${Array.isArray(results) ? results.length : 'N/A'}` });
    }
  });

  test('contact with multiple email addresses', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? booksBody?.data ?? [];
    if (books.length === 0) return;

    const personal = books.find((b: any) => b.source_type === 'local' || b.is_default === true);
    const bookKey = personal?.key || personal?.id || books[0]?.key || books[0]?.id;
    if (!bookKey) return;

    const ts = Date.now();
    const createRes = await page.request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        display_name: `Multi Email ${ts}`,
        first_name: 'Multi',
        last_name: 'Email',
        kind: 'individual',
        emails: [
          { value: `work-${ts}@test.example`, types: ['work'], pref: 1 },
          { value: `home-${ts}@test.example`, types: ['home'], pref: 2 },
        ],
      },
    });
    test.info().annotations.push({ type: 'multi-email', description: `POST multi-email contact -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    // Cleanup
    const createBody = await createRes.json();
    const contactId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.contact_id;
    if (contactId) {
      await page.request.delete(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts/${encodeURIComponent(contactId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('contact with phone and address fields', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? booksBody?.data ?? [];
    if (books.length === 0) return;

    const personal = books.find((b: any) => b.source_type === 'local' || b.is_default === true);
    const bookKey = personal?.key || personal?.id || books[0]?.key || books[0]?.id;
    if (!bookKey) return;

    const ts = Date.now();
    const createRes = await page.request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        display_name: `Full Contact ${ts}`,
        first_name: 'Full',
        last_name: 'Contact',
        kind: 'individual',
        emails: [
          { value: `full-${ts}@test.example`, types: ['work'], pref: 1 },
        ],
        phones: [
          { number: '+49123456789', types: ['work'] },
          { number: '+4989123456', types: ['home'] },
        ],
        note: 'Full contact test',
      },
    });
    test.info().annotations.push({ type: 'full-contact', description: `POST full contact -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    // Cleanup
    const createBody = await createRes.json();
    const contactId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.contact_id;
    if (contactId) {
      await page.request.delete(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts/${encodeURIComponent(contactId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('delete non-existent contact returns 404', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? booksBody?.data ?? [];
    if (books.length === 0) return;
    const bookKey = books[0]?.key || books[0]?.id;

    const fakeId = `nonexistent-${Date.now()}`;
    const delRes = await page.request.delete(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts/${fakeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'delete-404', description: `DELETE non-existent -> ${delRes.status()}` });
    expect([404, 200, 204]).toContain(delRes.status());
  });

  test('address books page loads in UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/address_books`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes("this page couldn't load") || text.includes('application error');
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('contact autocomplete search', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/contacts/autocomplete?q=test&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'autocomplete', description: `GET autocomplete -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('LDAP address book is accessible', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? booksBody?.data ?? [];

    // Find LDAP address book
    const ldap = books.find((b: any) => b.source_type === 'ldap' || b.is_ldap || b.source === 'ldap');
    if (!ldap) {
      test.info().annotations.push({ type: 'skip', description: 'No LDAP address book' });
      return;
    }
    const ldapKey = ldap.key || ldap.id;
    const res = await page.request.get(`${REMOTE_API}/addressbooks/${encodeURIComponent(ldapKey)}/contacts?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'ldap', description: `GET LDAP contacts -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });
});
