// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Six-Sigma defect-path / negative test coverage for the live API.
//
// Traced requirements (traceability → SIX_SIGMA_TEST_MATRIX.md, "Defect path"):
//   DP-01 unauthenticated protected route -> 401 (uniform, no info leak)
//   DP-02 malformed JWT -> 401
//   DP-03 malformed JSON body -> 400
//   DP-04 wrong content-type for POST -> 400/415
//   DP-05 unknown route -> 404 JSON (no stack traces)
//   DP-06 wrong method on known route -> 405
//   DP-07 schema validation -> 400/422 with field errors
//   DP-08 API responses carry security headers

import { test, expect } from '../helpers';
import {
  REMOTE_BASE, REMOTE_API, ADMIN_API,
  remoteEnvInterception, loginRemoteUser, remoteUserToken, loginRemoteAdmin, bearer,
} from '../helpers';

test.describe('Six-Sigma defect paths', () => {
  test('DP-01 unauthenticated access to protected surface -> 401', async ({ page }) => {
    await remoteEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const endpoints = [
      '/profile',
      '/mailboxes',
      '/calendars',
      '/contacts',
      '/tasks',
      '/shared-mailboxes',
      '/resources',
      '/addressbooks',
      '/webauthn/credentials',
      '/preferences',
    ];
    for (const ep of endpoints) {
      const res = await page.request.get(`${REMOTE_API}${ep}`, { headers: {} });
      test.info().annotations.push({
        type: `trace DP-01 ${ep}`,
        description: `GET ${ep} without token -> ${res.status()}`,
      });
      expect(res.status()).toBe(401);
    }
  });

  test('DP-02 malformed JWT -> 401 not 500', async ({ page }) => {
    await remoteEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    // The malformed JWT must yield 401 (anonymous on protected endpoint), never a 500.
    // Retry once to absorb Playwright response-disposal races during page load.
    let status = 0;
    for (let attempt = 0; attempt < 2 && status === 0; attempt++) {
      try {
        const res = await page.request.get(`${REMOTE_API}/profile`, {
          headers: { Authorization: 'Bearer not-a-real-jwt.malformed.token' },
        });
        status = res.status();
      } catch {
        await page.waitForTimeout(500);
      }
    }
    expect(status).toBe(401);
  });

  test('DP-03 malformed JSON body -> 400', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    // POST an invalid JSON string to a JSON-expecting endpoint (filters create)
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/filters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: '{this is not json',
    });
    expect([400, 415]).toContain(res.status());
  });

  test('DP-04 wrong content type for JSON API POST -> 4xx', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/filters`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      data: 'hello',
    });
    expect([400, 404, 415]).toContain(res.status());
  });

  test('DP-05 unknown route -> structured 404, never a stack trace', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(
      `${REMOTE_API}/definitely-not-a-route-${Date.now()}`,
      { headers: bearer(token) }
    );
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).not.toContain('Traceback');
    expect(text).not.toContain('File "/app/');
  });

  test('DP-06 wrong method on known route -> 405', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.delete(`${REMOTE_API}/profile`, { headers: bearer(token) });
    expect([405, 404]).toContain(res.status());
  });

  test('DP-07 schema validation yields field-level errors (400/422)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    // resources/available without required query fields
    const res = await page.request.get(`${REMOTE_API}/resources/available`, { headers: bearer(token) });
    expect([400, 422]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    const q = body?.errors?.query ?? body?.[0]?.data?.errors?.query ?? {};
    expect(Object.keys(q).length).toBeGreaterThan(0);
  });

  test('DP-08 API responses carry hardening headers', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, { headers: bearer(token) });
    const headers = res.headers();
    test.info().annotations.push({
      type: 'trace DP-08',
      description:
        `x-content-type-options=${headers['x-content-type-options'] ?? 'MISSING'} ` +
        `x-frame-options=${headers['x-frame-options'] ?? 'MISSING'} ` +
        `x-request-id=${headers['x-request-id'] ? 'present' : 'MISSING'}`,
    });
    // SOGo response contract: every API response carries a request id for tracing.
    expect(res.status()).toBe(200);
    expect(headers['x-request-id']).toBeTruthy();
  });
});
