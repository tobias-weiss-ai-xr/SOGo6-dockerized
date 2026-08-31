// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local admin domain-settings lifecycle @local @admin.
//
//   GET    /api/admin/v1/config/domains                 list domain settings
//   POST   /api/admin/v1/config/domains                 create (duplicate -> 409 S000301)
//   PATCH  /api/admin/v1/config/domains/<domain_id>     update (ghost -> 404 S000302)
//   DELETE /api/admin/v1/config/domains/<domain_id>     remove (ghost -> 404 S000302)
//
// Regression context (2026-08-31, round 11):
//   - Bug #17: DELETE of a nonexistent domain fell through to the raw DB layer
//     and returned 500 S000403 ("Expected number of row deleted..."), because
//     get_one_domain_setting() silently returns DEFAULT settings for unknown
//     ids — the guard mirrored the PATCH path's domain_name fallback check.
//   - GET of an unknown domain id intentionally returns 200 with the DEFAULT
//     settings (domain_name: "default") — pinned here as designed.
//
//   npx playwright test local-admin-domains.spec.ts

import { test, expect, adminPassword } from '../helpers';

const API = 'http://localhost:5001';
const ADMIN_API = `${API}/api/admin/v1`;
const DOMAINS = `${ADMIN_API}/config/domains`;
const CT = { 'Content-Type': 'application/json' };

let adminToken = '';
const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const adminJson = () => ({ ...adminAuth(), ...CT });

const SUFFIX = Date.now().toString(36);
const DOMAIN = `e2e-dom-${SUFFIX}.example`;

test.describe('local admin domain lifecycle @local @admin', () => {
  test.beforeAll(async ({ request }) => {
    const pwd = adminPassword();
    test.skip(!pwd, 'no local admin password (set SOGO_ADMIN_PASSWORD or secrets/sogo6.vault.env)');
    const res = await request.post(`${ADMIN_API}/auth/login`, {
      headers: CT,
      data: { username: 'admin', password: pwd },
    });
    adminToken = ((await res.json()).data ?? {}).jwt_token ?? '';
    expect(adminToken, 'admin login').toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    // idempotent cleanup: a failed run may leave the domain behind
    if (adminToken) {
      await request.delete(`${DOMAINS}/${DOMAIN}`, { headers: adminAuth() }).catch(() => {});
    }
  });

  test('DOM-01 create domain returns 200 and the domain appears in the list', async ({ request }) => {
    const res = await request.post(DOMAINS, {
      headers: adminJson(),
      data: { domain_name: DOMAIN, domain_description: 'round11 e2e lifecycle' },
    });
    expect(res.status(), await res.text()).toBe(200);

    const list = await request.get(DOMAINS, { headers: adminAuth() });
    expect(list.status()).toBe(200);
    const entries = (await list.json()).data;
    const names: string[] = entries.map((d: any) => d.domain_name);
    expect(names, `created domain visible in list: ${JSON.stringify(names)}`).toContain(DOMAIN);
  });

  test('DOM-02 duplicate domain create -> 409 S000301', async ({ request }) => {
    const res = await request.post(DOMAINS, {
      headers: adminJson(),
      data: { domain_name: DOMAIN },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error_code).toBe('S000301');
  });

  test('DOM-03 patch description persists', async ({ request }) => {
    const res = await request.patch(`${DOMAINS}/${DOMAIN}`, {
      headers: adminJson(),
      data: { domain_description: 'round11 patched' },
    });
    expect(res.status(), await res.text()).toBe(200);

    const get = await request.get(`${DOMAINS}/${DOMAIN}`, { headers: adminAuth() });
    expect(get.status()).toBe(200);
    const body = await get.json();
    expect(body.data.domain_name).toBe(DOMAIN);
    expect(body.data.domain_description).toBe('round11 patched');
  });

  test('DOM-04 patch ghost domain -> 404 S000302', async ({ request }) => {
    const res = await request.patch(`${DOMAINS}/ghost-${SUFFIX}.example`, {
      headers: adminJson(),
      data: { domain_description: 'nope' },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error_code).toBe('S000302');
  });

  test('DOM-05 delete ghost domain -> 404 S000302 (bug #17 regression)', async ({ request }) => {
    const res = await request.delete(`${DOMAINS}/ghost-${SUFFIX}.example`, { headers: adminAuth() });
    expect(res.status(), `ghost delete returned ${res.status()} ${await res.text()}`).toBe(404);
    const body = await res.json();
    expect(body.error_code).toBe('S000302');
    expect(body.error_msg).toBe("Domain's Name Not Found");
  });

  test('DOM-06 delete existing domain -> 200 and gone from the list', async ({ request }) => {
    const res = await request.delete(`${DOMAINS}/${DOMAIN}`, { headers: adminAuth() });
    expect(res.status(), await res.text()).toBe(200);

    const list = await request.get(DOMAINS, { headers: adminAuth() });
    const names: string[] = (await list.json()).data.map((d: any) => d.domain_name);
    expect(names).not.toContain(DOMAIN);
  });

  test('DOM-07 get unknown domain returns the DEFAULT settings (by design)', async ({ request }) => {
    const res = await request.get(`${DOMAINS}/never-existed-${SUFFIX}.example`, { headers: adminAuth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.domain_name).toBe('default');
  });
});
