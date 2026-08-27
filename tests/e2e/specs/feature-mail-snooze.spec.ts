// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for mail snooze on the live SOGo6 demo site.
 * All request-based (runs even with local UI down).
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

test.describe('Feature: Mail Snooze', () => {
  test('GET /snooze/ returns snoozed messages with schedule metadata', async ({ request }) => {
    const t = await getToken(request);
    expect(t).toBeTruthy();

    const res = await request.get(`${API}/snooze/`, { headers: bearer(t) });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.error_code).toBe('S000000');
    expect(Array.isArray(body.data.snoozed)).toBe(true);

    for (const item of body.data.snoozed) {
      expect(typeof item.id).toBe('number');
      expect(typeof item.mail_uid).toBe('string');
      expect(typeof item.folder).toBe('string');
      expect(item).toHaveProperty('snooze_until');
      expect(item).toHaveProperty('original_folder');
      expect(item).toHaveProperty('account_id');
    }
  });

  test('GET /snooze/999999 (unknown) does not 5xx', async ({ request }) => {
    const t = await getToken(request);
    expect(t).toBeTruthy();

    const res = await request.get(`${API}/snooze/999999`, { headers: bearer(t) });
    expect(res.status()).toBeLessThan(500);
  });

  test('unauthenticated /snooze/ is rejected (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API}/snooze/`);
    expect([401, 403]).toContain(res.status());
  });
});
