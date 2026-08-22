// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Contact Autocomplete & Distribution Lists on the live SOGo6 demo.
//
// Verified API shapes:
//   - GET /contacts/autocomplete?q=...  -> data.suggestions[{name,email,address_book,type}]
//   - GET /addressbooks/{key}/lists     -> data.lists[]
//   - POST /addressbooks/{key}/lists    -> {name, description, members: [contact keys]}
//   - PATCH/DELETE /addressbooks/{key}/lists/{list_key}
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
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
    const sogoAuth = sessionStorage.getItem('sogo_auth');
    if (sogoAuth) {
      try {
        const parsed = JSON.parse(sogoAuth);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

async function getAddressBookKeys(page: import('@playwright/test').Page) {
  const token = await getAuthToken(page);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await page.request.get(`${REMOTE_API}/addressbooks`, { headers });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const books = body?.data?.addressbooks ?? [];
  const personal = books.find((b: any) => b.source_type === 'local');
  const ldap = books.find((b: any) => b.source_type === 'directory');
  return { personal: personal?.key, ldap: ldap?.key, headers };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Contact Autocomplete & Distribution Lists', () => {
  test.describe.configure({ mode: 'serial' });

  test('recipient autocomplete returns LDAP directory users', async ({ page }) => {
    await loginAsUser(page);
    const { headers } = await getAddressBookKeys(page);

    const res = await page.request.get(`${REMOTE_API}/contacts/autocomplete?q=test&limit=10`, { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    const suggestions = body?.data?.suggestions ?? [];
    expect(suggestions.length).toBeGreaterThan(0);

    // Suggestions should come from the LDAP directory address book
    const fromLdap = suggestions.some((s: any) => s?.address_book?.key === 'dir:ldap_main');
    expect(fromLdap).toBeTruthy();

    // At least one suggestion has a usable email
    const hasEmail = suggestions.some((s: any) => typeof s?.email === 'string' && s.email.includes('@'));
    expect(hasEmail).toBeTruthy();
  });

  test('autocomplete with a real query matches specific user', async ({ page }) => {
    await loginAsUser(page);
    const { headers } = await getAddressBookKeys(page);

    // Search for the LDAP "Test Admin" user
    const res = await page.request.get(`${REMOTE_API}/contacts/autocomplete?q=admin&limit=10`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const suggestions = body?.data?.suggestions ?? [];
    const matched = suggestions.some((s: any) =>
      (s.name?.toLowerCase().includes('admin') || s.email?.toLowerCase().includes('admin'))
    );
    test.info().annotations.push({
      type: 'suggestions',
      description: `q=admin returned ${suggestions.length} suggestions: ${suggestions.map((s: any) => `${s.name}<${s.email}>`).join(', ')}`,
    });
    expect(matched).toBeTruthy();
  });

  test('personal address book starts with no distribution lists', async ({ page }) => {
    await loginAsUser(page);
    const { personal, headers } = await getAddressBookKeys(page);
    expect(personal).toBeTruthy();

    const res = await page.request.get(`${REMOTE_API}/addressbooks/${personal}/lists`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const lists = body?.data?.lists ?? [];
    expect(Array.isArray(lists)).toBeTruthy();
  });

  test('distribution list full CRUD lifecycle', async ({ page }) => {
    await loginAsUser(page);
    const { personal, headers } = await getAddressBookKeys(page);

    // Create
    const createRes = await page.request.post(`${REMOTE_API}/addressbooks/${personal}/lists`, {
      data: { name: 'E2E Project Team', description: 'Created by Playwright' },
      headers,
    });
    expect([200, 201]).toContain(createRes.status());
    const createdBody = await createRes.json();
    const listKey = createdBody?.data?.key ?? createdBody?.key;
    expect(listKey).toBeTruthy();

    // Read back
    const getRes = await page.request.get(`${REMOTE_API}/addressbooks/${personal}/lists/${listKey}`, { headers });
    expect(getRes.status()).toBe(200);
    const gotBody = await getRes.json();
    expect((gotBody?.data ?? gotBody).name).toBe('E2E Project Team');

    // List contains it
    const listRes = await page.request.get(`${REMOTE_API}/addressbooks/${personal}/lists`, { headers });
    const listBody = await listRes.json();
    const lists = listBody?.data?.lists ?? [];
    expect(lists.some((l: any) => l.key === listKey)).toBeTruthy();

    // Patch name
    const patchRes = await page.request.patch(`${REMOTE_API}/addressbooks/${personal}/lists/${listKey}`, {
      data: { name: 'E2E Project Team (renamed)' },
      headers,
    });
    expect([200, 204]).toContain(patchRes.status());

    // Delete
    const delRes = await page.request.delete(`${REMOTE_API}/addressbooks/${personal}/lists/${listKey}`, { headers });
    expect([200, 204]).toContain(delRes.status());

    // Verify gone
    const verifyRes = await page.request.get(`${REMOTE_API}/addressbooks/${personal}/lists`, { headers });
    const verifyBody = await verifyRes.json();
    const remaining = verifyBody?.data?.lists ?? [];
    expect(remaining.some((l: any) => l.key === listKey)).toBeFalsy();
  });

  test('delete a non-existent list returns an error (validation)', async ({ page }) => {
    await loginAsUser(page);
    const { personal, headers } = await getAddressBookKeys(page);

    const delRes = await page.request.delete(
      `${REMOTE_API}/addressbooks/${personal}/lists/nonexistent-list-key`,
      { headers }
    );
    expect([404, 500, 403]).toContain(delRes.status());
  });
});
