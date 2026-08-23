// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Six-Sigma Tier-0 coverage: RESOURCE BOOKING  (openspec: resource-booking.spec.md)
//
// Traced requirements (traceability → SIX_SIGMA_TEST_MATRIX.md):
//   T0-RB-01 list resources (user)
//   T0-RB-02 list favorites (user)
//   T0-RB-03 favorite unknown resource -> 404 S000385
//   T0-RB-04 available query requires start_time+end_time -> 422
//   T0-RB-05 available with valid range -> 200
//   T0-RB-06 my-bookings (user)
//   T0-RB-07 admin list resources
//   T0-RB-08 admin availability uses start/end query names -> 400 when missing

import { test, expect } from '../helpers';
import {
  REMOTE_BASE, REMOTE_API, ADMIN_API,
  remoteEnvInterception, loginRemoteUser, remoteUserToken, loginRemoteAdmin, bearer,
} from '../helpers';

test.describe('Tier-0 Resource Booking', () => {
  test.describe.configure({ mode: 'serial' });

  test('T0-RB-01 user can list resources (200)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // User endpoint returns the resource list as a bare array at the root
    const data = body?.data ?? body;
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('T0-RB-02 user can list favorites (200)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources/favorites`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body?.data ?? body;
    expect(Array.isArray(data?.resources ?? data)).toBeTruthy();
  });

  test('T0-RB-03 favorite unknown resource -> 404 S000385', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(
      `${REMOTE_API}/resources/not-a-real-id/favorite`,
      { headers: bearer(token), data: {} }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body?.error_code).toBe('S000385');
    expect(body?.error_msg).toContain('Resource Not Found');
  });

  test('T0-RB-04 availability requires start_time+end_time (422)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources/available`, { headers: bearer(token) });
    expect(res.status()).toBe(422);
    const body = await res.json();
    const q = body?.errors?.query ?? {};
    expect(q).toHaveProperty('start_time');
    expect(q).toHaveProperty('end_time');
  });

  test('T0-RB-05 availability with valid ISO range -> 200', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources/available`, {
      headers: bearer(token),
      params: { start_time: '2030-01-02T09:00:00Z', end_time: '2030-01-02T10:00:00Z' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body?.data ?? body;
    expect(Array.isArray(data?.resources ?? data)).toBeTruthy();
  });

  test('T0-RB-06 user my-bookings (200)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources/my-bookings`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
  });

  test('T0-RB-07 admin can list resources', async ({ page }) => {
    await loginRemoteUser(page);
    const adminToken = await loginRemoteAdmin(page);
    expect(adminToken).toBeTruthy();
    const res = await page.request.get(`${ADMIN_API}/resources`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body?.data ?? body;
    expect(Array.isArray(data?.resources ?? data)).toBeTruthy();
  });

  test('T0-RB-08 admin availability uses start/end query names (400 when missing)', async ({ page }) => {
    await loginRemoteUser(page);
    const adminToken = await loginRemoteAdmin(page);
    const res = await page.request.get(`${ADMIN_API}/resources/available`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(400);
    const body = await res.json();
    const q = body?.[0]?.data?.errors?.query ?? body?.errors?.query ?? {};
    expect(Object.keys(q)).toContain('start');
    expect(Object.keys(q)).toContain('end');
  });
});
