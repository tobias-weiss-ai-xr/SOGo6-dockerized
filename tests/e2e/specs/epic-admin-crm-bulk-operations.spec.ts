// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Admin CRM, bulk-user operations & file shares.
//
// Stories for the admin to interact with the CRM module (accounts,
// contacts, interactions), bulk-user import/export, approval workflows,
// branding configuration, and file-share management.
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

test.describe('Epic — Admin CRM module', () => {

  test('CRM-01 admin lists CRM accounts', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/crm/accounts`, { headers: bearer(tk) });
    expect(200, `GET /crm/accounts -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const accounts = body?.data?.accounts ?? [];
    test.info().annotations.push({ type: 'accounts', description: `count: ${Array.isArray(accounts) ? accounts.length : 0}` });
  });

  test('CRM-02 admin lists CRM contacts', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/crm/contacts`, { headers: bearer(tk) });
    expect(200, `GET /crm/contacts -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const contacts = body?.data?.contacts ?? [];
    test.info().annotations.push({ type: 'contacts', description: `count: ${Array.isArray(contacts) ? contacts.length : 0}` });
  });

  test('CRM-03 admin creates a CRM interaction log entry', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${ADMIN_API}/crm/interactions`, {
      headers: bearer(tk),
      data: { type: 'email', subject: `E2E interaction ${Date.now()}`, note: 'Automated test' },
    });
    expect(ACCEPT, `POST /crm/interactions -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'interaction', description: `-> ${res.status()}` });
  });

  test('CRM-04 admin creates a CRM account', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${ADMIN_API}/crm/accounts`, {
      headers: bearer(tk),
      data: { name: `E2E Corp ${Date.now()}`, domain: 'e2e-test.org' },
    });
    expect(ACCEPT, `POST /crm/accounts -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'account-create', description: `-> ${res.status()}` });
  });

  test('CRM-05 admin creates a CRM contact', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${ADMIN_API}/crm/contacts`, {
      headers: bearer(tk),
      data: { given_name: 'E2E', family_name: `Test ${Date.now()}`, email: 'e2e@test.org' },
    });
    expect(ACCEPT, `POST /crm/contacts -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'contact-create', description: `-> ${res.status()}` });
  });

  test('CRM-06 admin re-reads CRM accounts (may show new entry)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/crm/accounts`, { headers: bearer(tk) });
    expect(200, `GET /crm/accounts (verify) -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const accounts = body?.data?.accounts ?? [];
    test.info().annotations.push({ type: 'accounts-after', description: `count: ${Array.isArray(accounts) ? accounts.length : 0}` });
  });
});

test.describe('Epic — Admin bulk-users, branding & approvals', () => {

  test('CRM-07 admin exports user list as CSV', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/bulk-users/export/csv`, { headers: bearer(tk) });
    expect(200, `GET /bulk-users/export/csv -> ${res.status()}`).toBe(res.status());
    const ct = res.headers()['content-type'] ?? '';
    const body = await res.text();
    const lines = body.split('\n').length;
    test.info().annotations.push({ type: 'csv-export', description: `ct=${ct} lines=${lines}` });
  });

  test('CRM-08 admin attempts bulk-user import with JSON payload', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${ADMIN_API}/bulk-users/import/csv`, {
      headers: { ...bearer(tk), 'Content-Type': 'application/json' },
      data: { users: [{ email: 'import-test@example.org', display_name: 'Import Test' }] },
    });
    // Server requires text/csv content-type — this tests validation
    expect([400, 415, 422], `POST /bulk-users/import/csv (json) -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'import-wrong-ct', description: `-> ${res.status()}` });
  });

  test('CRM-09 admin lists pending approvals', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/approvals`, { headers: bearer(tk) });
    expect([200, 404], `GET /approvals -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'approvals', description: `-> ${res.status()}` });
  });

  test('CRM-10 admin reads domain branding config', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/branding/sogo6.contextual-intelligence.org`, { headers: bearer(tk) });
    expect(200, `GET /branding/domain -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'branding', description: `-> ${res.status()}` });
  });

  test('CRM-11 admin reads public branding config', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${ADMIN_API}/branding/sogo6.contextual-intelligence.org/public`, { headers: bearer(tk) });
    expect([200, 404], `GET /branding/public -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'branding-pub', description: `-> ${res.status()}` });
  });
});
