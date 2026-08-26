// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Platform administration.
//
// Realistic multi-step stories for a SOGo platform admin (separate process-level
// admin store, NOT LDAP): platform health, global configuration, directory
// management, shared-mailbox governance, and auditability.
//
// Runs against https://sogo6.contextual-intelligence.org/api/admin/v1
// Admin credentials (process settings store): admin / 3fb7db8074230771
//
// Every story is authenticated with a real admin JWT. 5xx fails; 2xx/4xx are OK.

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const ADMIN = { username: 'admin', password: '3fb7db8074230771' };

const ACCEPT = [200, 201, 202, 204, 400, 404, 422];

let ADMIN_TOKEN: string | null = null;
async function token(request: any) {
  if (!ADMIN_TOKEN) ADMIN_TOKEN = await apiLogin(request, ADMIN.username, ADMIN.password, ADMIN_API);
  return ADMIN_TOKEN;
}

test.describe('Epic — Platform admin: health & configuration', () => {

  test('EPIC/ADM-01 admin authenticates and reaches the health dashboard', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'admin login returns a JWT').toBeTruthy();
    const res = await request.get(`${ADMIN_API}/health-dashboard`, { headers: bearer(tk) });
    expect(200, `auth GET /health-dashboard -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const data = body?.data ?? {};
    const healthy = data?.healthy_count;
    const services = Array.isArray(data?.services) ? data.services : [];
    test.info().annotations.push({ type: 'health', description: `healthy: ${healthy} / services: ${services.length}` });
    expect(Array.isArray(services)).toBe(true);
  });

  test('EPIC/ADM-02 admin reads global system configuration', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config/system`, { headers: bearer(tk) });
    expect(200, `GET /config/system -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const settings = body?.data?.SYSTEM_SETTINGS ?? body?.data ?? {};
    test.info().annotations.push({ type: 'config', description: `keys: ${Object.keys(settings).length}` });
  });

  test('EPIC/ADM-03 admin lists configured domains', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config/domains`, { headers: bearer(tk) });
    expect([200, 404], `GET /config/domains -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const domains = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'domains', description: `count: ${domains.length}` });
    }
  });

  test('EPIC/ADM-04 admin reads the active theme configuration', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config/theme`, { headers: bearer(tk) });
    expect([200, 404], `GET /config/theme -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'theme', description: `-> ${res.status()}` });
  });

  test('EPIC/ADM-05 admin gets domain-default settings', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config/domain-default`, { headers: bearer(tk) });
    expect([200, 404], `GET /config/domain-default -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'domdef', description: `-> ${res.status()}` });
  });

  test('EPIC/ADM-06 admin reviews auditing configuration', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/audit-log`, { headers: bearer(tk) });
    expect([200, 404], `GET /audit-log -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'audit', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Platform admin: directory & mailbox governance', () => {

  test('EPIC/ADM-07 admin lists the LDAP user directory', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/users/list`, { headers: bearer(tk) });
    expect(200, `GET /users/list -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const users = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'users', description: `count: ${users.length}` });
    expect(Array.isArray(users)).toBe(true);
  });

  test('EPIC/ADM-08 admin sees active sessions', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/users/active`, { headers: bearer(tk) });
    expect(200, `GET /users/active -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const active = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'active', description: `sessions: ${active.length}` });
  });

  test('EPIC/ADM-09 admin searches shared mailboxes', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/shared-mailboxes/search`, { headers: bearer(tk) });
    expect(200, `GET /shared-mailboxes/search -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'smb', description: `-> ${res.status()}` });
  });

  test('EPIC/ADM-10 admin reads the backup plan configuration', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/backup/config`, { headers: bearer(tk) });
    expect([200, 404], `GET /backup/config -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'backup', description: `-> ${res.status()}` });
  });

  test('EPIC/ADM-11 admin verifies config-as-code sync status', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/config-as-code/diff`, { headers: bearer(tk) });
    expect([200, 404], `GET /config-as-code/diff -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'cac', description: `-> ${res.status()}` });
  });
});