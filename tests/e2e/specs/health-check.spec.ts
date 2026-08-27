// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Health & System diagnostics on the live SOGo6 demo site.
// Covers: health endpoint, dependencies (db, ldap, redis, mail), unauthenticated
// access handling, and admin API health.
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)
//             admin / admin (admin panel)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};
// Admin password from server .env: SOGO_P_ADMIN_PWD / SOGO_ADMIN_PASSWORD
const ADMIN_CREDENTIALS = {
  username: REMOTE_CREDENTIALS.admin.username,
  password: REMOTE_CREDENTIALS.admin.password,
};

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Health & System Diagnostics', () => {

  test('GET /health returns ok with dependencies', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.dependencies).toBeTruthy();

    const deps = body.dependencies;
    const names = Object.keys(deps).join(', ').toLowerCase();
    // Dependency names include 'database' (not 'db')
    expect(names).toMatch(/database|db/);
  });

  test('each dependency reports a status', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const deps = body.dependencies ?? {};

    for (const [name, info] of Object.entries(deps)) {
      const status = (info as any)?.status ?? info;
      // Each dependency should report ok/healthy/up
      test.info().annotations.push({
        type: name,
        description: `${name}: ${JSON.stringify(info)}`,
      });
      expect(String(status).toLowerCase()).toMatch(/ok|healthy|up|running/);
    }
  });

  test('protected endpoint returns 401 without token', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/profile`);
    expect(res.status()).toBe(401);
  });

  test('health endpoint is anonymous (no token needed)', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/health`);
    expect(res.status()).toBe(200);
  });
});

test.describe('Admin API Health', () => {

  test('admin login returns JWT', async ({ page }) => {
    const res = await page.request.post(`${ADMIN_API}/auth/login`, {
      data: ADMIN_CREDENTIALS,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data?.jwt_token).toBeTruthy();
  });

  test('admin health dashboard endpoint responds', async ({ page }) => {
    const loginRes = await page.request.post(`${ADMIN_API}/auth/login`, {
      data: ADMIN_CREDENTIALS,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    const token = loginBody?.data?.jwt_token;

    const res = await page.request.get(`${ADMIN_API}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test('admin users endpoint returns list', async ({ page }) => {
    const loginRes = await page.request.post(`${ADMIN_API}/auth/login`, {
      data: ADMIN_CREDENTIALS,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    const token = loginBody?.data?.jwt_token;

    const res = await page.request.get(`${ADMIN_API}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const users = body?.data ?? body;
      expect(users).toBeTruthy();
    }
  });
});
