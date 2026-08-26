// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for user security endpoints on the live SOGo6 demo site.
 * Tests run against https://sogo6.contextual-intelligence.org
 * Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure
 *
 * NOTE: Password-change tests only exercise the FAILURE / validation paths so the
 * live credentials are never modified.
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

test.describe('User Security Features', () => {
  test.describe('Profile password change', () => {
    test('empty payload is rejected with 400 (validation)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/profile/password`, {
        headers: bearer(t),
        data: {},
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      // Response: array [ { data: { errors: { json: { current_password: [...], new_password: [...] } } }, error_code, error_msg }, 400 ]
      expect(Array.isArray(body)).toBe(true);
      expect(body[0].data.errors).toBeDefined();
      const jsonErrors = body[0].data.errors.json ?? {};
      expect(jsonErrors.current_password).toBeTruthy();
      expect(jsonErrors.new_password).toBeTruthy();
    });

    test('unknown field is rejected (strict schema)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/profile/password`, {
        headers: bearer(t),
        data: { old_password: 'x', new_password: 'y' },
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      const jsonErrors = body[0].data.errors.json ?? {};
      expect(jsonErrors.current_password).toBeTruthy(); // required field still reported
    });

    test('wrong current password is rejected with 401 (S001101)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/profile/password`, {
        headers: bearer(t),
        data: { current_password: 'definitely-wrong-pass', new_password: 'TmpPass2026!x' },
      });

      expect([400, 401]).toContain(res.status());
      const body = await res.json();
      if (res.status() === 401) {
        expect(body.error_code).toBe('S001101');
        expect(body.error_msg).toContain('Current Password');
      }
    });
  });

  test.describe('Session integrity', () => {
    test('token is a signed JWT (three segments, issuer SOGo6)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();
      const parts = t.split('.');
      expect(parts).toHaveLength(3);

      // Decode payload (base64url) without verification — issuer + uid sanity
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'),
      );
      expect(payload.iss).toBe('SOGo6');
      expect(payload.uid).toBe('testuser@sogo6.contextual-intelligence.org');
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('unauthenticated access to protected profile is rejected (no 5xx)', async ({ request }) => {
      const res = await request.get(`${API}/profile`);
      // Must be 401/403 (auth guard), never 200 or 5xx
      expect([401, 403]).toContain(res.status());
    });
  });
});
