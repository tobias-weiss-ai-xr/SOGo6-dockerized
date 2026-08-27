// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for address books, contacts and autocomplete on the live
 * SOGo6 demo site. All request-based (runs even with local UI down).
 * Tests run against https://sogo6.contextual-intelligence.org
 * Credentials: see tests/e2e/.env (gitignored)
 */

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';
import { apiLogin, REMOTE_API, bearer } from '../helpers';

const BASE = REMOTE_API.replace('/api/user/v1', '');
const API = BASE + '/api/user/v1';

let token: string | null = null;
async function getToken(request: any): Promise<string> {
  if (!token) {
    token = await apiLogin(request, REMOTE_CREDENTIALS.user.email, REMOTE_CREDENTIALS.user.password, REMOTE_API);
  }
  return token;
}

test.describe('Feature: Address Books & Contacts', () => {
  test.describe('Address books', () => {
    test('GET /addressbooks returns structured address books', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/addressbooks`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(Array.isArray(body.data.addressbooks)).toBe(true);

      // At least one default local address book + directory
      for (const ab of body.data.addressbooks) {
        expect(typeof ab.key).toBe('string');
        expect(typeof ab.name).toBe('string');
        expect(typeof ab.source_type).toBe('string');
        expect(typeof ab.is_default).toBe('boolean');
        expect(typeof ab.ctag).toBe('number');
      }
      expect(body.data.addressbooks.some((ab: any) => ab.is_default)).toBe(true);
    });

    test('unauthenticated /addressbooks is rejected (no 5xx)', async ({ request }) => {
      const res = await request.get(`${API}/addressbooks`);
      expect([401, 403]).toContain(res.status());
    });
  });

  test.describe('Contacts', () => {
    test('GET /contacts returns contacts with emails + names', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/contacts`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(Array.isArray(body.data.contacts)).toBe(true);

      for (const c of body.data.contacts) {
        expect(c).toHaveProperty('display_name');
        expect(c).toHaveProperty('emails');
        expect(Array.isArray(c.emails)).toBe(true);
        expect(c).toHaveProperty('addressbook_key');
      }
    });
  });

  test.describe('Autocomplete', () => {
    test('missing q param is rejected with 422', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/contacts/autocomplete`, { headers: bearer(t) });
      expect([400, 422]).toContain(res.status());
    });

    test('GET /contacts/autocomplete?q=... returns suggestions', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/contacts/autocomplete?q=test`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.data.suggestions)).toBe(true);
      for (const s of body.data.suggestions) {
        // Each suggestion has contact identity info
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('email');
        expect(s).toHaveProperty('type');
      }
    });
  });
});
