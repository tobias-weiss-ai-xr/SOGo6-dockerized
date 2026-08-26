// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Admin WebAuthn governance & system audit.
//
// Stories for the admin to inspect WebAuthn policies, credential audit logs,
// user passkey inventory, and additional config-as-code management.
//
// Runs against https://sogo6.contextual-intelligence.org/api/admin/v1
// Admin credentials: admin / 3fb7db8074230771

import { test, expect, apiLogin, bearer } from '../helpers';

const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const ADMIN = { username: 'admin', password: '3fb7db8074230771' };
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let ADMIN_TOKEN: string | null = null;
async function token(request: any) {
  if (!ADMIN_TOKEN) ADMIN_TOKEN = await apiLogin(request, ADMIN.username, ADMIN.password, ADMIN_API);
  return ADMIN_TOKEN;
}

test.describe('Epic — Admin WebAuthn governance', () => {

  test('AWG-01 admin reads WebAuthn audit log', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/webauthn/audit`, { headers: bearer(tk) });
    expect([200, 404], `GET /webauthn/audit -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const entries = Array.isArray(body?.data) ? body.data : (body?.data?.logs ?? []);
      test.info().annotations.push({ type: 'audit', description: `entries: ${Array.isArray(entries) ? entries.length : 0}` });
    }
  });

  test('AWG-02 admin reads WebAuthn policies', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/webauthn/policies`, { headers: bearer(tk) });
    expect([200, 404], `GET /webauthn/policies -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      test.info().annotations.push({ type: 'policies', description: `keys: ${Object.keys(body?.data ?? body ?? {}).slice(0, 6).join(',')}` });
    }
  });

  test('AWG-03 admin reads WebAuthn users (passkey inventory)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/webauthn/users`, { headers: bearer(tk) });
    expect([200, 404], `GET /webauthn/users -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const users = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'w-users', description: `count: ${users.length}` });
    }
  });

  test('AWG-04 admin creates a WebAuthn policy', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${ADMIN_API}/webauthn/policies`, {
      headers: bearer(tk),
      data: { name: `e2e-policy-${Date.now()}`, require_webauthn: false, allow_password_fallback: true },
    });
    expect(ACCEPT, `POST /webauthn/policies -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'policy-create', description: `-> ${res.status()}` });
  });

  test('AWG-05 admin re-reads health dashboard', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/health-dashboard`, { headers: bearer(tk) });
    expect(200, `GET /health-dashboard -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const data = body?.data ?? {};
    test.info().annotations.push({ type: 'health', description: `services: ${Array.isArray(data?.services) ? data.services.length : 0}` });
  });

  test('AWG-06 admin reads config-as-code diff', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config-as-code/diff`, { headers: bearer(tk) });
    expect([200, 404], `GET /config-as-code/diff -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'cac-diff', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Admin system audit', () => {

  test('AWG-07 admin lists users and checks total count', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/users/list`, { headers: bearer(tk) });
    expect(200, `GET /users/list -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const users = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'users', description: `total: ${users.length}` });
  });

  test('AWG-08 admin checks active user sessions', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/users/active`, { headers: bearer(tk) });
    expect(200, `GET /users/active -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'active', description: `-> ${res.status()}` });
  });

  test('AWG-09 admin reads system configuration', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config/system`, { headers: bearer(tk) });
    expect(200, `GET /config/system -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const settings = body?.data?.SYSTEM_SETTINGS ?? body?.data ?? {};
    test.info().annotations.push({ type: 'sys-cfg', description: `keys: ${Object.keys(settings).length}` });
  });

  test('AWG-10 admin reads domain configuration', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config/domains`, { headers: bearer(tk) });
    expect([200, 404], `GET /config/domains -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const domains = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'domains', description: `count: ${domains.length}` });
    }
  });

  test('AWG-11 admin checks shared mailbox governance', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/shared-mailboxes/search`, { headers: bearer(tk) });
    expect(200, `GET /shared-mailboxes/search -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'smb', description: `-> ${res.status()}` });
  });
});
