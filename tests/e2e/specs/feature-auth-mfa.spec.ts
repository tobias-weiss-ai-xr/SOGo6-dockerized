// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for MFA / TOTP on the live SOGo6 demo site.
 * Tests run against https://sogo6.contextual-intelligence.org
 * Credentials: see tests/e2e/.env (gitignored)
 *
 * All tests exercise only discovery / validation / failure paths — MFA is
 * never actually enabled for the live account.
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

test.describe('Feature: MFA / TOTP', () => {
  test.describe('MFA setup', () => {
    test('GET /auth/mfa/setup returns TOTP secret + provisioning URI', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.get(`${API}/auth/mfa/setup`, { headers: bearer(t) });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.secret).toBeTruthy();
      // Standard base32 secret alphabet
      expect(body.secret).toMatch(/^[A-Z2-7]{16,}$/);

      // provisioning URI must be an otpauth:// URI with the secret embedded
      expect(body.provisioning_uri).toContain('otpauth://totp/');
      expect(body.provisioning_uri).toContain(`secret=${body.secret}`);
      expect(body.provisioning_uri).toContain('issuer=');

      // qr_svg may be empty if qrcode lib unavailable, but must be a string
      expect(typeof body.qr_svg).toBe('string');
    });
  });

  test.describe('MFA enable', () => {
    test('missing code is rejected with 400 (schema validation)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/mfa/enable`, {
        headers: bearer(t),
        data: {},
      });
      expect([400, 422]).toContain(res.status());
    });

    test('invalid TOTP code is rejected with 401 (S001233)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/mfa/enable`, {
        headers: bearer(t),
        data: { code: '000000' },
      });
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error_code).toBe('S001233');
      expect(body.error_msg).toContain('TOTP');
    });
  });

  test.describe('MFA disable', () => {
    test('missing password is rejected with 400 (schema validation)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/mfa/disable`, {
        headers: bearer(t),
        data: {},
      });
      expect([400, 422]).toContain(res.status());
    });

    test('wrong password cannot disable MFA (re-auth fails, 401 S000208)', async ({ request }) => {
      const t = await getToken(request);
      expect(t).toBeTruthy();

      const res = await request.post(`${API}/auth/mfa/disable`, {
        headers: bearer(t),
        data: { password: 'definitely-wrong-pass' },
      });
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error_code).toBe('S000208');
      expect(body.error_msg).toContain('Login Failed');
    });
  });

  test.describe('Access control', () => {
    test('unauthenticated setup is rejected (no 5xx)', async ({ request }) => {
      const res = await request.get(`${API}/auth/mfa/setup`);
      expect([401, 403]).toContain(res.status());
    });
  });
});
