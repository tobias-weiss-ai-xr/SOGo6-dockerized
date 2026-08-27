// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for the user job API on the live SOGo6 demo site.
 * All request-based (runs even with local UI down).
 * Tests run against https://sogo6.contextual-intelligence.org
 * Credentials: see tests/e2e/.env (gitignored)
 *
 * Jobs are async tasks; on the demo no job ever exists, so the core
 * assertion is that unknown-job lookups fail GRACEFULLY with 404 (S000800)
 * — never a 5xx.
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

test.describe('Feature: Async Jobs', () => {
  test('GET /jobs/0 (unknown job) returns 404 S000800, never 5xx', async ({ request }) => {
    const t = await getToken(request);
    expect(t).toBeTruthy();

    const res = await request.get(`${API}/jobs/0`, { headers: bearer(t) });
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error_code).toBe('S000800');
    expect(body.error_msg).toContain('Job Not Found');
  });

  test('GET /jobs/0/result (unknown job) returns 404 S000800, never 5xx', async ({ request }) => {
    const t = await getToken(request);
    expect(t).toBeTruthy();

    const res = await request.get(`${API}/jobs/0/result`, { headers: bearer(t) });
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error_code).toBe('S000800');
  });

  test('cancel requires POST (GET returns 405, never 5xx)', async ({ request }) => {
    const t = await getToken(request);
    expect(t).toBeTruthy();

    const res = await request.get(`${API}/jobs/0/cancel`, { headers: bearer(t) });
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).toBe(405);
  });

  test('POST /jobs/0/cancel (unknown job) returns 404 S000800, never 5xx', async ({ request }) => {
    const t = await getToken(request);
    expect(t).toBeTruthy();

    const res = await request.post(`${API}/jobs/0/cancel`, { headers: bearer(t), data: {} });
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error_code).toBe('S000800');
  });

  test('unauthenticated job lookup is rejected (no 5xx)', async ({ request }) => {
    const res = await request.get(`${API}/jobs/0`);
    expect([401, 403]).toContain(res.status());
  });
});
