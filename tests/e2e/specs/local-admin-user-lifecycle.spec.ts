// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local admin user lifecycle @local @admin.
//
//   POST   /api/admin/v1/users/create   {uid, cn, sn, givenName, mail, password}
//   GET    /api/admin/v1/users/list
//   DELETE /api/admin/v1/users/<uid>
//   POST   /api/user/v1/auth/login      (verify the account actually works)
//
// Regression context (2026-08-30): creating a user with a bare uid (no @)
// returned 200 and stored uid=jdoe in LDAP — but the login flow binds
// uid=<full-email>, so the account could NEVER log in. The server now
// rejects a bare uid / uid≠mail with 400 S000300 before touching LDAP.
//
//   npx playwright test local-admin-user-lifecycle.spec.ts

import { test, expect, apiLogin, adminPassword } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const ADMIN_API = `${API}/api/admin/v1`;
const CT = { 'Content-Type': 'application/json' };

let adminToken = '';
const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const adminJson = () => ({ ...adminAuth(), ...CT });

const SUFFIX = Date.now().toString(36);
const USER = {
  uid: `e2e-lifecycle-${SUFFIX}@example.org`,
  cn: 'E2E Lifecycle',
  sn: 'Lifecycle',
  givenName: 'E2E',
  mail: `e2e-lifecycle-${SUFFIX}@example.org`,
  password: 'Lifecycle!123',
};

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
  if (adminToken) {
    await request.delete(`${ADMIN_API}/users/${USER.uid}`, { headers: adminAuth() }).catch(() => {});
  }
});

async function adminLogin(request: any, uid: string, password: string) {
  const res = await request.post(`${LOCAL_API}/auth/login`, {
    headers: CT,
    data: { username: uid, password },
  });
  return { status: res.status(), body: await res.json() };
}

test.describe('local admin user lifecycle @local @admin', () => {
  test('USER-01 creating a bare-uid account is rejected (400 S000300)', async ({ request }) => {
    const res = await request.post(`${ADMIN_API}/users/create`, {
      headers: adminJson(),
      data: { ...USER, uid: `bare-${SUFFIX}`, mail: `bare-${SUFFIX}@example.org` },
    });
    expect(res.status(), `bare uid -> ${res.status()} ${await res.text()}`).toBe(400);
    expect((await res.json()).error_code).toBe('S000300');
  });

  test('USER-02 uid/mail mismatch is rejected (400 S000300)', async ({ request }) => {
    const res = await request.post(`${ADMIN_API}/users/create`, {
      headers: adminJson(),
      data: { ...USER, mail: `different-${SUFFIX}@example.org` },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error_code).toBe('S000300');
  });

  test('USER-03 a valid create succeeds and the account can log in immediately', async ({ request }) => {
    const res = await request.post(`${ADMIN_API}/users/create`, {
      headers: adminJson(),
      data: USER,
    });
    expect(res.status(), `create -> ${res.status()} ${await res.text()}`).toBe(200);
    const data = (await res.json()).data ?? {};
    expect(data.dn).toBe(`uid=${USER.uid},ou=users,dc=example,dc=org`);

    const { status, body } = await adminLogin(request, USER.uid, USER.password);
    expect(status, `login -> ${status} ${JSON.stringify(body)}`).toBe(200);
    expect((body.data ?? {}).jwt_token).toBeTruthy();
  });

  test('USER-04 wrong password is rejected (401)', async ({ request }) => {
    const { status } = await adminLogin(request, USER.uid, 'wrong-password!');
    expect(status).toBe(401);
  });

  test('USER-05 the new user appears in the admin list', async ({ request }) => {
    const res = await request.get(`${ADMIN_API}/users/list`, { headers: adminAuth() });
    expect(res.status()).toBe(200);
    const users = (await res.json()).data ?? [];
    const hit = users.find((u: any) => (u.uid?.[0] ?? u.uid) === USER.uid);
    expect(hit, `uid ${USER.uid} must be in the list`).toBeTruthy();
  });

  test('USER-06 duplicate create conflicts or errors clearly (not 200)', async ({ request }) => {
    const res = await request.post(`${ADMIN_API}/users/create`, {
      headers: adminJson(),
      data: USER,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('USER-07 deleting the user removes it — login afterwards is a 401', async ({ request }) => {
    const del = await request.delete(`${ADMIN_API}/users/${USER.uid}`, { headers: adminAuth() });
    expect(del.status(), `delete -> ${del.status()}`).toBe(200);

    const { status } = await adminLogin(request, USER.uid, USER.password);
    expect(status, 'login after delete must fail').toBe(401);
  });

  test('USER-08 deleting an unknown user is a clean 404 (not 500)', async ({ request }) => {
    const res = await request.delete(`${ADMIN_API}/users/ghost-${SUFFIX}@example.org`, {
      headers: adminAuth(),
    });
    expect(res.status(), `delete ghost -> ${res.status()}`).toBe(404);
  });
});
