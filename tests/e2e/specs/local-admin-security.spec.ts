// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local admin/security probes (@local): the two former GAP-ANALYSIS §6
// blockers and their auth boundaries.
//
//  - GET /auth/saml2/providers       {regression: condition=None -> 500}
//  - GET /scim/v2/Users             {gated by SCIM_BEARER_TOKEN}
//
//   npx playwright test local-admin-security.spec.ts

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const ADMIN_API = `${API}/api/admin/v1`;
const ADMIN = { username: 'admin', password: adminPassword() };

let adminToken = '';

// Local admin password: env override first (CI-friendly), then the gitignored
// vault file (same convention as recent-blueprints.spec.ts).
function adminPassword(): string {
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
}

// SCIM_BEARER_TOKEN is set in the repo-root .env (gitignored) and passed into
// the server container; Playwright reads it from there for local runs.
function scimToken(): string {
  if (process.env.SCIM_BEARER_TOKEN) return process.env.SCIM_BEARER_TOKEN;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../../.env'), 'utf8');
    const m = raw.match(/^SCIM_BEARER_TOKEN=(.*)$/m);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

test.beforeAll(async ({ request }) => {
  test.skip(!ADMIN.password, 'no local admin password (set SOGO_ADMIN_PASSWORD or secrets/sogo6.vault.env)');
  const res = await request.post(`${ADMIN_API}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { username: ADMIN.username, password: ADMIN.password },
  });
  expect(res.status()).toBe(200);
  adminToken = ((await res.json()).data ?? {}).jwt_token ?? '';
  expect(adminToken).toBeTruthy();
});

test.describe('local admin security surfaces @local @admin', () => {
  test('ADMIN-01 SAML2 providers list returns 200 (regression: was 500)', async ({ request }) => {
    const res = await request.get(`${ADMIN_API}/auth/saml2/providers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status(), `GET /auth/saml2/providers -> ${res.status()}`).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.providers)).toBe(true);
  });

  test('ADMIN-02 SCIM Users requires the SCIM bearer token (401 without)', async ({ request }) => {
    const noTok = await request.get(`${ADMIN_API}/scim/v2/Users`);
    expect(noTok.status()).toBe(401);

    const wrongTok = await request.get(`${ADMIN_API}/scim/v2/Users`, {
      headers: { Authorization: 'Bearer definitely-wrong-token' },
    });
    expect(wrongTok.status()).toBe(401);
  });

  test('ADMIN-03 SCIM Users returns a ListResponse with the configured token', async ({ request }) => {
    const token = scimToken();
    test.skip(!token, 'SCIM_BEARER_TOKEN not set locally');
    const res = await request.get(`${ADMIN_API}/scim/v2/Users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), `GET /scim/v2/Users -> ${res.status()}`).toBe(200);
    const body = await res.json();
    expect(body.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:ListResponse');
    expect(Number.isInteger(body.totalResults)).toBe(true);
  });

  test('ADMIN-04 SAML2 providers rejects unauthenticated access', async ({ request }) => {
    const res = await request.get(`${ADMIN_API}/auth/saml2/providers`);
    expect([401, 403]).toContain(res.status());
  });
});
