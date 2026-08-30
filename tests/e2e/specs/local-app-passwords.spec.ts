// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local app-password lifecycle (@local).
//
//   GET  /api/user/v1/auth/app-passwords/        (list; trailing slash required)
//   POST /api/user/v1/auth/app-passwords/        (create; body {label}; token shown once)
//   POST /api/user/v1/auth/app-passwords/delete  (body {id})
//
// Regression context (2026-08-30): the container image shipped without
// `bcrypt` (Dockerfile pip list drifted from pyproject.toml), so create always
// failed — masked as 404 S001220 "App Password Not Found".
//
//   npx playwright test local-app-passwords.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const BASE = `${USER_API}/auth/app-passwords`;
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, USER_API))!;
  expect(token).toBeTruthy();
});

test.describe('local app-password lifecycle @local @auth', () => {
  test.afterAll(async ({ request }) => {
    // best-effort cleanup: revoke every [local-e2e] labeled app password
    const res = await request.get(`${BASE}/`, { headers: auth() });
    for (const rec of (await res.json()).data ?? []) {
      if (String(rec.label ?? '').startsWith('[local-e2e]')) {
        await request.post(`${BASE}/delete`, { headers: json(), data: { id: rec.id } }).catch(() => {});
      }
    }
  });

  test('AP-01 create returns the raw token exactly once plus metadata', async ({ request }) => {
    const res = await request.post(`${BASE}/`, {
      headers: json(),
      data: { label: `[local-e2e] ap ${Date.now()}` },
    });
    expect(res.status(), `create -> ${res.status()} ${await res.text()}`).toBe(200);
    const data = (await res.json()).data;
    expect(data.token).toMatch(/^sogo-ap-[0-9a-f]{64}$/);
    expect(data.app_password.id).toBeGreaterThan(0);
    expect(data.app_password.label).toContain('[local-e2e]');
    // the stored hash must never come back
    expect(JSON.stringify(data)).not.toContain('$2');
  });

  test('AP-02 created password appears in the list (metadata only, no token)', async ({ request }) => {
    const res = await request.get(`${BASE}/`, { headers: auth() });
    expect(res.status()).toBe(200);
    const list = (await res.json()).data ?? [];
    const mine = list.find((x: any) => x.label?.includes('[local-e2e] ap '));
    expect(mine, 'created label visible in list').toBeTruthy();
    expect(Object.keys(mine)).not.toContain('hash');
    expect(Object.keys(mine)).not.toContain('token');
  });

  test('AP-03 blank label is rejected with a 400-class error (not 500)', async ({ request }) => {
    const res = await request.post(`${BASE}/`, {
      headers: json(),
      data: { label: '   ' },
    });
    // regression: used to be 500 S999999 "Undefined Error" (RequestException
    // raised without an error code); now ERROR_VALIDATION_ERROR (400).
    expect(res.status(), `blank label -> ${res.status()} ${await res.text()}`).toBe(400);
    expect((await res.json()).error_code).toBe('S000300');
  });

  test('AP-04 delete removes the record; deleting again is a 404', async ({ request }) => {
    // create a dedicated record
    const create = await request.post(`${BASE}/`, {
      headers: json(),
      data: { label: `[local-e2e] ap-del ${Date.now()}` },
    });
    expect(create.status()).toBe(200);
    const id = (await create.json()).data.app_password.id;

    const del = await request.post(`${BASE}/delete`, {
      headers: json(),
      data: { id },
    });
    expect(del.status(), `delete -> ${del.status()} ${await del.text()}`).toBe(200);

    const again = await request.post(`${BASE}/delete`, {
      headers: json(),
      data: { id },
    });
    expect(again.status()).toBe(404); // S001220 App Password Not Found
  });

  test('AP-05 unauthenticated access is rejected', async ({ request }) => {
    const res = await request.get(`${BASE}/`);
    expect([401, 403]).toContain(res.status());
  });
});
