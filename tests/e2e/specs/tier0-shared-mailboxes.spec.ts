// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Six-Sigma Tier-0 coverage: SHARED MAILBOXES  (openspec: shared-mailboxes.spec.md)
//
// Traced requirements (traceability → SIX_SIGMA_TEST_MATRIX.md):
//   T0-SM-01 list user-visible shared mailboxes
//   T0-SM-02 detail lookup: unknown id -> SOGo 404 S000383
//   T0-SM-03 access control: note on non-member mailbox -> 403 S000399
//   T0-SM-04 admin list + search
//   T0-SM-05 admin create (schema requires email+name; 400 when missing)
//   T0-SM-06 unauthenticated -> 401
//
// NOTE: the demo admin shared-mailbox store is in-memory; a create (201) is not
// guaranteed to persist to MySQL (DataError on created_at ISO8601). Documented.

import { test, expect } from '../helpers';
import {
  REMOTE_BASE, REMOTE_API, ADMIN_API,
  remoteEnvInterception, loginRemoteUser, remoteUserToken, loginRemoteAdmin, bearer,
} from '../helpers';

test.describe('Tier-0 Shared Mailboxes', () => {
  test.describe.configure({ mode: 'serial' });

  test('T0-SM-01 user can list shared mailboxes (200)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/shared-mailboxes`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // User endpoint returns the list at the root (admin wraps in {data:{mailboxes}})
    const list = body?.data ?? body;
    expect(Array.isArray(list)).toBeTruthy();
    test.info().annotations.push({
      type: 'trace T0-SM-01',
      description: `GET /shared-mailboxes -> 200, ${Array.isArray(list) ? list.length : 0} mailboxes`,
    });
  });

  test('T0-SM-02 unknown shared mailbox id -> 404 S000383', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(
      `${REMOTE_API}/shared-mailboxes/00000000-0000-0000-0000-000000000000`,
      { headers: bearer(token) }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body?.error_code).toBe('S000383');
    expect(body?.error_msg).toContain('Shared Mailbox');
  });

  test('T0-SM-03 non-member cannot create notes -> 403 S000399', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(
      `${REMOTE_API}/shared-mailboxes/00000000-0000-0000-0000-000000000000/notes`,
      { headers: bearer(token), data: { content: 'x', email_id: null } }
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body?.error_code).toBe('S000399');
    expect(body?.error_msg).toContain('Access Denied');
  });

  test('T0-SM-06 unauthenticated shared-mailboxes -> 401', async ({ page }) => {
    await remoteEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const res = await page.request.get(`${REMOTE_API}/shared-mailboxes`, { headers: {} });
    expect(res.status()).toBe(401);
  });

  test('T0-SM-04 admin can list and search shared mailboxes', async ({ page }) => {
    await loginRemoteUser(page); // page context with valid cookies/host
    const adminToken = await loginRemoteAdmin(page);
    expect(adminToken).toBeTruthy();
    const ah = bearer(adminToken);
    for (const ep of ['/shared-mailboxes', '/shared-mailboxes/search']) {
      const res = await page.request.get(`${ADMIN_API}${ep}`, { headers: ah });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body?.data?.mailboxes)).toBeTruthy();
      test.info().annotations.push({
        type: `trace T0-SM-04 ${ep}`,
        description: `GET ${ep} -> 200, total_count=${body?.data?.total_count}`,
      });
    }
  });

  test('T0-SM-05 admin create validates schema (400 when email/name missing)', async ({ page }) => {
    await loginRemoteUser(page);
    const adminToken = await loginRemoteAdmin(page);
    const res = await page.request.post(`${ADMIN_API}/shared-mailboxes`, {
      headers: bearer(adminToken),
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    const miss = body?.[0]?.data?.errors?.json ?? {};
    expect(Object.keys(miss)).toContain('email');
    expect(Object.keys(miss)).toContain('name');
  });
});
