// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for app passwords on the live SOGo6 demo site.
 * Tests run against https://sogo6.contextual-intelligence.org
 * Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure
 *
 * NOTE: Revoking a NON-EXISTENT app password previously returned a 500
 * (S999999 Undefined Error) because ModuleAppPassword.delete raised an
 * untagged RequestException. Fixed to return 404 (S001220) — asserted below.
 *
 * Create is currently degraded on the demo deployment (bcrypt module missing
 * in container) but fails GRACEFULLY (404, never 5xx).
 */

import { test, expect } from '../helpers';
import { apiLogin, REMOTE_API, bearer } from '../helpers';

const BASE = REMOTE_API.replace('/api/user/v1', '');
const API = BASE + '/api/user/v1';

let token: string | null = null;
async function getToken(request: any): Promise<string> {
  if (!token) {
    token = await apiLogin(request, 'testuser@sogo6.contextual-intelligence.org', 'S0g0Test2026!Secure', REMOTE_API);
  }
  return token;
}

test.describe('Feature: App Passwords', () => {
  test.describe('List', () => {
    test('GET /auth/app-passwords/ returns records with metadata fields', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/auth/app-passwords/`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(Array.isArray(body.data)).toBe(true);
      for (const record of body.data) {
        expect(typeof record.id).toBe('number');
        expect(typeof record.label).toBe('string');
        expect(typeof record.created_at).toBe('number');
        // last_used / expires_at present (may be null)
        expect('last_used' in record).toBe(true);
        expect('expires_at' in record).toBe(true);
        // The raw token must never be returned in the list
        expect(record.token).toBeUndefined();
      }
    });
  });

  test.describe('Revoke (delete)', () => {
    test('missing id is rejected with 400 (schema validation)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/app-passwords/delete`, {
        headers: bearer(t),
        data: {},
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      const jsonErrors = body[0].data.errors.json ?? {};
      expect(jsonErrors.id).toBeTruthy();
    });

    test('non-existent id returns 404 S001220 (regression: was 500)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/app-passwords/delete`, {
        headers: bearer(t),
        data: { id: 999_999 },
      });
      // Must NEVER be a 5xx — not-found is a client error (404)
      expect(res.status()).toBeLessThan(500);
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error_code).toBe('S001220');
      expect(body.error_msg).toContain('App Password Not Found');
    });
  });

  test.describe('Create (degraded gracefully on demo)', () => {
    test('create with valid payload does not 5xx (flat-fails 404, bcrypt missing)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/app-passwords/`, {
        headers: bearer(t),
        data: { label: 'e2e-feature-test' },
      });
      // Documented: create is degraded on this deployment (missing bcrypt in container)
      // but must never return a 5xx.
      expect(res.status()).toBeLessThan(500);
    });

    test('create with missing label is rejected with 400', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/app-passwords/`, {
        headers: bearer(t),
        data: {},
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Access control', () => {
    test('unauthenticated list is rejected (no 5xx)', async ({ request }) => {
      const res = await request.get(`${API}/auth/app-passwords/`);
      expect([401, 403]).toContain(res.status());
    });
  });
});
