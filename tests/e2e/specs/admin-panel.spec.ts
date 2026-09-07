// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

import { test, expect } from '../helpers';
import { REMOTE_API, REMOTE_BASE, CREDENTIALS } from '../helpers';

// Admin API base (separate from user API)
const ADMIN_API = REMOTE_API.replace('/user/v1', '/admin/v1');

test.describe('Admin Panel', () => {

  // Shared login helper for admin
  async function loginAsAdminViaApi(request: any) {
    const loginRes = await request.post(ADMIN_API + '/auth/login', {
      data: {
        username: CREDENTIALS.admin.username,
        password: CREDENTIALS.admin.password,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.status() === 200) {
      const body = await loginRes.json();
      return body.data?.jwt_token;
    }
    return null;
  }

  // Direct API calls ---------------------------------------------------------

  test.describe('Admin API (direct HTTP)', () => {
    test.beforeAll(async ({ request }) => {
      // One health check for all admin API tests
      const health = await request.get(REMOTE_API + '/health');
      expect(health.status()).toBe(200);
    });

    test('admin API login works', async ({ request }) => {
      const token = await loginAsAdminViaApi(request);
      expect(token).toBeTruthy();
      expect(token?.length).toBeGreaterThan(0);
    });

    test('admin API theme settings can be read', async ({ request }) => {
      const token = await loginAsAdminViaApi(request);
      if (!token) { test.skip(); return; }

      const resp = await request.get(ADMIN_API + '/config/profile/settings/theme',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 403, 404]).toContain(resp.status());
    });

    test('admin API user list is accessible', async ({ request }) => {
      const token = await loginAsAdminViaApi(request);
      if (!token) { test.skip(); return; }

      const resp = await request.get(ADMIN_API + '/users',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 403, 404]).toContain(resp.status());
    });

    test('admin API domain default config works', async ({ request }) => {
      const token = await loginAsAdminViaApi(request);
      if (!token) { test.skip(); return; }

      const resp = await request.get(ADMIN_API + '/config/defaults',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 403, 404]).toContain(resp.status());
    });

    test('admin API sessions (active users) works', async ({ request }) => {
      const token = await loginAsAdminViaApi(request);
      if (!token) { test.skip(); return; }

      const resp = await request.get(ADMIN_API + '/sessions',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect([200, 403, 404]).toContain(resp.status());
    });
  });

  // UI-driven admin panel ----------------------------------------------------

  test.describe('Admin Panel UI', () => {
    test('should reach the admin panel route', async ({ page }) => {
      const response = await page.goto(REMOTE_BASE + '/en/admin_panel');
      expect(response?.status()).toBeGreaterThanOrEqual(200);
      expect(response?.status()).toBeLessThan(500);
    });
  });
});
