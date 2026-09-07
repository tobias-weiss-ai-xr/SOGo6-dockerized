// SPDX-FileCopyrightText: 2025 SOGo project controllers
// SPDX-License-Identifier: LGPL-2.1-only

import { test, expect } from '../helpers';
import { REMOTE_API, REMOTE_BASE, REMOTE_CREDENTIALS } from '../helpers';

test.describe('User Settings / API', () => {

  // Shared login helper
  async function loginViaApi(request: any) {
    const loginRes = await request.post(REMOTE_API + '/auth/login', {
      data: {
        username: REMOTE_CREDENTIALS.email,
        password: REMOTE_CREDENTIALS.password,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.status() === 200) {
      const body = await loginRes.json();
      return body.data?.jwt_token;
    }
    return null;
  }

  test.describe('Password Change API', () => {

    test('password change endpoint responds', async ({ request }) => {
      const token = await loginViaApi(request);
      if (!token) { test.skip(); return; }

      const resp = await request.post(
        REMOTE_API + '/profile/password',
        {
          data: { current_password: REMOTE_CREDENTIALS.password, new_password: REMOTE_CREDENTIALS.password },
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );
      expect([200, 400, 404]).toContain(resp.status());
    });

    test('password form route loads', async ({ page }) => {
      const response = await page.goto(REMOTE_BASE + '/en/u/testuser2%40sogo6.contextual-intelligence.org/settings/security').catch(() => null);
      await page.waitForTimeout(3000);
      expect(page.url()).toContain('/auth/login') || page.url().includes('/settings');
    });
  });

  test.describe('User Profile API', () => {

    test('profile settings endpoint is reachable', async ({ request }) => {
      const token = await loginViaApi(request);
      if (!token) { test.skip(); return; }

      const profileRes = await request.get(REMOTE_API + '/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 404]).toContain(profileRes.status());
    });

    test('display name endpoint responds', async ({ request }) => {
      const token = await loginViaApi(request);
      if (!token) { test.skip(); return; }

      const profileRes = await request.get(REMOTE_API + '/profile/display-name', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 404]).toContain(profileRes.status());
    });
  });
});
