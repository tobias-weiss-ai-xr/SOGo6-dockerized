// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Blueprints that were recently wired/verified in the LOCAL stack:
//   - oauth/clients + push/vapid-public-key were ORPHANED blueprints
//     (defined but never imported). Now registered under the user API.
//   - auth/app-passwords mounts at /api/user/v1/auth/app-passwords/.
//   - admin files/shares, branding/<domain>, webhooks, workflows, audit-log
//     mount at their real sub-paths (earlier probes at blueprint roots were
//     false 404s).
//
// Every suite member must be reachable and return 200 with valid auth. Admin
// calls use a FRESH login per test so transient rate-limits never cause a
// false 401 (the correct unauth response would be `S000203`).
//
//   npx playwright test recent-blueprints.spec.ts

import { test, expect } from '../helpers';
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };
const ADMIN_USERNAME = 'admin';

// Local admin password: env override first (CI-friendly), then the gitignored
// vault file. The e2e helpers' default 'admin' only applies to the remote demo.
const ADMIN_PASSWORD = (() => {
  if (process.env.SOGO_ADMIN_PASSWORD) return process.env.SOGO_ADMIN_PASSWORD;
  try {
    const vault = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'secrets', 'sogo6.vault.env'),
      'utf8',
    );
    for (const line of vault.split(/\r?\n/)) {
      const m = line.match(/^SOGO_P_ADMIN_PWD\s*=\s*(.+)$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* vault file absent on other machines */
  }
  return '';
})();

async function userToken(request: any): Promise<string> {
  const res = await request.post(`${API}/api/user/v1/auth/login`, {
    data: { username: USER.email, password: USER.password },
  });
  return (await res.json())?.data?.jwt_token ?? '';
}

async function adminToken(request: any): Promise<string> {
  const res = await request.post(`${API}/api/admin/v1/auth/login`, {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  return (await res.json())?.data?.jwt_token ?? '';
}

test.describe('recently-wired user blueprints @local', () => {
  test('oauth clients list is reachable', async ({ request }) => {
    const t = await userToken(request);
    expect(t, 'user login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/user/v1/oauth/clients`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data?.clients)).toBe(true);
  });

  test('push VAPID public key is served', async ({ request }) => {
    const t = await userToken(request);
    expect(t, 'user login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/user/v1/push/vapid-public-key`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.public_key).toBe('string');
    expect((body.public_key ?? '').length).toBeGreaterThan(20);
  });

  test('app passwords list is reachable (mounted at /auth/app-passwords/)', async ({ request }) => {
    const t = await userToken(request);
    expect(t, 'user login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/user/v1/auth/app-passwords/`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe('recently-verified admin blueprints @local', () => {
  test.skip(!ADMIN_PASSWORD, 'no local admin password (set SOGO_ADMIN_PASSWORD or secrets/sogo6.vault.env)');

  test('files shares list is reachable', async ({ request }) => {
    const t = await adminToken(request);
    expect(t, 'admin login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/admin/v1/files/shares`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data?.shares)).toBe(true);
  });

  test('domain branding is reachable for the seeded domain', async ({ request }) => {
    const t = await adminToken(request);
    expect(t, 'admin login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/admin/v1/branding/example.org`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
    await res.json(); // must be valid JSON
  });

  test('webhooks list is reachable', async ({ request }) => {
    const t = await adminToken(request);
    expect(t, 'admin login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/admin/v1/webhooks`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
  });

  test('workflows list is reachable', async ({ request }) => {
    const t = await adminToken(request);
    expect(t, 'admin login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/admin/v1/workflows`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
  });

  test('audit log is reachable', async ({ request }) => {
    const t = await adminToken(request);
    expect(t, 'admin login must return a JWT').toBeTruthy();
    const res = await request.get(`${API}/api/admin/v1/audit-log`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(200);
  });
});
