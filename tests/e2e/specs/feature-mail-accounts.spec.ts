// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for mail account / folder / search endpoints on the live
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

test.describe('Feature: Mail Accounts & Folders', () => {
  test.describe('Mail accounts', () => {
    test('GET /mailboxes returns account with identity + quota', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/mailboxes`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      const account = body.data[0];
      expect(typeof account.id).toBe('string');
      expect(account.identities).toBeInstanceOf(Array);
      const defaultIdentity = account.identities.find((i: any) => i.isDefault) ?? account.identities[0];
      expect(defaultIdentity).toBeDefined();
      expect(defaultIdentity.mail).toContain('@');
      // quota shape
      expect(account.quota).toHaveProperty('soft_quota_value');
      expect(account.quota).toHaveProperty('storage_used');
    });

    test('GET /mailboxes/0 returns the same account detail (no 5xx)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/mailboxes/0`, { headers: bearer(t) });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(body.data.identities?.[0]?.mail ?? '').toContain('@');
    });

    test('unauthenticated /mailboxes is rejected (no 5xx)', async ({ request }) => {
      const res = await request.get(`${API}/mailboxes`);
      expect([401, 403]).toContain(res.status());
    });
  });

  test.describe('Mail folders', () => {
    test('GET /mailboxes/0/folders returns structured folder list', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/mailboxes/0/folders`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(Array.isArray(body.data)).toBe(true);

      // Assert structural shape of every folder
      for (const folder of body.data) {
        expect(typeof folder.name).toBe('string');
        expect(typeof folder.path).toBe('string');
        expect(folder).toHaveProperty('message_count');
        expect(folder).toHaveProperty('unseen_count');
        expect(folder).toHaveProperty('selectable');
        expect(typeof folder.type).toBe('string');
      }

      // INBOX is the canonical folder
      const inbox = body.data.find((f: any) => f.path === 'INBOX' || f.name === 'INBOX');
      expect(inbox).toBeTruthy();
    });
  });

  test.describe('Mail search', () => {
    test('GET /mailboxes/0/search?query=... returns mail results', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/mailboxes/0/search?query=test`, { headers: bearer(t) });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      for (const mail of body.data) {
        expect(typeof mail.folder).toBe('string');
        expect(mail).toHaveProperty('subject');
        expect(mail).toHaveProperty('from');
        expect(mail).toHaveProperty('date');
      }
    });
  });
});
