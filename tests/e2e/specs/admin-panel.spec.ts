// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
import { test, expect } from '../helpers';

test.describe('Admin Panel', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/env', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.REACT_APP_API_BASE_URL = 'http://localhost:5001/api/user/v1';
      await route.fulfill({ response, body });
    });
  });

  test.describe('Admin API (direct HTTP)', () => {
    test('admin API login works', async ({ page }) => {
      const response = await page.request.post('http://localhost:5001/api/admin/v1/auth/login', {
        data: { username: 'admin', password: 'admin' },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.jwt_token).toBeTruthy();
    });

    test('admin API theme settings can be read', async ({ page }) => {
      const token = await getAdminToken(page);

      // GET theme settings
      const res = await page.request.get('http://localhost:5001/api/admin/v1/config/theme', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test('admin API rules CRUD works', async ({ page }) => {
      const token = await getAdminToken(page);

      // Create
      const createRes = await page.request.post('http://localhost:5001/api/admin/v1/config/rules', {
        data: { rule_name: 'e2e-test-rule', rule_description: 'E2E test', rule_domains: ['example.org'] },
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(createRes.status() === 201 || createRes.status() === 200).toBeTruthy();
      const rule = await createRes.json();
      const ruleId = rule.data?.id;
      expect(ruleId).toBeDefined();

      // Read
      const getRes = await page.request.get(`http://localhost:5001/api/admin/v1/config/rules/${ruleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(getRes.status()).toBe(200);

      // Update
      const patchRes = await page.request.patch(`http://localhost:5001/api/admin/v1/config/rules/${ruleId}`, {
        data: { rule_description: 'Updated via E2E' },
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(patchRes.status()).toBe(200);

      // Delete
      const delRes = await page.request.delete(`http://localhost:5001/api/admin/v1/config/rules/${ruleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(delRes.status()).toBe(200);
    });

    test('admin API users list works', async ({ page }) => {
      const token = await getAdminToken(page);

      const res = await page.request.get('http://localhost:5001/api/admin/v1/users/list?limit=5&offset=0', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    });

    test('admin API sessions (active users) works', async ({ page }) => {
      const token = await getAdminToken(page);

      const res = await page.request.get('http://localhost:5001/api/admin/v1/users/active?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    });

    test('admin API domain default config works', async ({ page }) => {
      const token = await getAdminToken(page);

      const res = await page.request.get('http://localhost:5001/api/admin/v1/config/domain-default', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });
  });
});

let adminToken: string | null = null;

async function getAdminToken(page: any): Promise<string> {
  if (adminToken) return adminToken;
  const response = await page.request.post('http://localhost:5001/api/admin/v1/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  const body = await response.json();
  adminToken = body.data.jwt_token;
  return adminToken;
}
