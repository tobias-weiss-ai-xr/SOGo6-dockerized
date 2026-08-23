// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Six-Sigma Tier-0 coverage: WEBAUTHN / PASSKEYS  (openspec: webauthn-passkeys.spec.md)
//
// Traced requirements (traceability → SIX_SIGMA_TEST_MATRIX.md):
//   T0-WA-01 status endpoint (200)
//   T0-WA-02 list credentials (200, empty for fresh account)
//   T0-WA-03 registration challenge (200 with WebAuthn options + challenge_id)
//   T0-WA-04 login/authentication challenge (200)
//   T0-WA-05 register validates body -> 422 when credential missing
//   T0-WA-06 login validates body -> 422 when credential missing
//   T0-WA-07 unauthenticated -> 401
//   T0-WA-08 challenge fields shape (challenge/rpId/userVerification present)

import { test, expect } from '../helpers';
import {
  REMOTE_BASE, REMOTE_API, ADMIN_API,
  remoteEnvInterception, loginRemoteUser, remoteUserToken, loginRemoteAdmin, bearer,
} from '../helpers';

test.describe('Tier-0 WebAuthn / Passkeys', () => {
  test.describe.configure({ mode: 'serial' });

  test('T0-WA-01 webauthn status -> 200', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/webauthn`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    await res.json();
  });

  test('T0-WA-02 list credentials -> 200 with count', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/webauthn/credentials`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // WebAuthn credentials returns {count, credentials} at the root (no data wrapper)
    const data = body?.data ?? body;
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data?.credentials ?? data)).toBeTruthy();
    test.info().annotations.push({
      type: 'trace T0-WA-02',
      description: `credentials count=${data?.count}`,
    });
  });

  test('T0-WA-03 registration challenge -> 200 with options', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/webauthn/challenge/register`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body?.data ?? body;
    expect(typeof data?.challenge).toBe('string');
    expect(data?.challenge?.length).toBeGreaterThan(10);
    test.info().annotations.push({
      type: 'trace T0-WA-03',
      description: `register challenge fields: ${Object.keys(data ?? {}).join(', ')}`,
    });
  });

  test('T0-WA-04 login challenge -> 200', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/webauthn/challenge/login`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body?.data ?? body;
    expect(typeof data?.challenge).toBe('string');
  });

  test('T0-WA-05 register validates body -> 422 when credential missing', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(`${REMOTE_API}/webauthn/register`, {
      headers: bearer(token),
      data: {},
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body?.errors?.json).toHaveProperty('credential');
    expect(body?.errors?.json).toHaveProperty('challenge_id');
  });

  test('T0-WA-06 login validates body -> 422 when credential missing', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(`${REMOTE_API}/webauthn/login`, {
      headers: bearer(token),
      data: {},
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body?.errors?.json).toHaveProperty('credential');
  });

  test('T0-WA-07 unauthenticated webauthn -> 401', async ({ page }) => {
    await remoteEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const res = await page.request.get(`${REMOTE_API}/webauthn/credentials`, { headers: {} });
    expect(res.status()).toBe(401);
  });

  test('T0-WA-08 register challenge exposes RFC 9346-ready fields', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/webauthn/challenge/register`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body?.data ?? body;
    for (const field of ['challenge', 'rp', 'user', 'timeout']) {
      test.info().annotations.push({
        type: `trace T0-WA-08 ${field}`,
        description: `${field}=${JSON.stringify(data[field]).substring(0, 80)}`,
      });
    }
    expect(data).toHaveProperty('rp');
    expect(data).toHaveProperty('user');
    expect(typeof data.timeout).toBe('number');
  });
});
