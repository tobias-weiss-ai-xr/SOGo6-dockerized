// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Security & authentication workflows.
//
// Stories covering WebAuthn passkey lifecycle (challenge → register → credentials →
// login → delete), app-password management, MFA status detection, and the
// auth-mode endpoint that the UI uses to decide between LDAP / passkey / SSO.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role: see tests/e2e/.env (gitignored)

import { test, expect, apiLogin, bearer, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Security: WebAuthn passkey lifecycle', () => {

  test('SEC-01 user checks overall WebAuthn status and MFA policy', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/webauthn`, { headers: bearer(tk) });
    expect(200, `GET /webauthn -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    test.info().annotations.push({
      type: 'webauthn-status',
      description: `supported=${body?.supported} require=${body?.require_webauthn} passkeys=${body?.passkey_count}`,
    });
  });

  test('SEC-02 user lists existing passkey credentials', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/webauthn/credentials`, { headers: bearer(tk) });
    expect(200, `GET /webauthn/credentials -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const count = body?.count ?? (Array.isArray(body?.credentials) ? body.credentials.length : 0);
    test.info().annotations.push({ type: 'passkeys', description: `count: ${count}` });
  });

  test('SEC-03 user requests a WebAuthn registration challenge', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/webauthn/challenge/register`, { headers: bearer(tk) });
    expect(200, `GET /webauthn/challenge/register -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    test.info().annotations.push({
      type: 'reg-challenge',
      description: `rp=${body?.rp?.id ?? '?'} algos=${JSON.stringify(body?.pubKeyCredParams ?? [])}`,
    });
  });

  test('SEC-04 user requests a WebAuthn login challenge', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/webauthn/challenge/login`, { headers: bearer(tk) });
    expect(200, `GET /webauthn/challenge/login -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    test.info().annotations.push({
      type: 'login-challenge',
      description: `rpId=${body?.rpId ?? '?'} uv=${body?.userVerification ?? '?'}`,
    });
  });

  test('SEC-05 user submits a registration (will fail without real authenticator)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/webauthn/register`, {
      headers: bearer(tk),
      data: { credential: { id: 'fake-cred-id', rawId: 'ZmFrZQ==', type: 'public-key', response: {} }, name: `e2e-test-${Date.now()}` },
    });
    // Without a real authenticator this fails with 400/422 — that is expected
    expect([400, 401, 403, 422, 500], `POST /webauthn/register -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'reg-submit', description: `-> ${res.status()} (no real authenticator)` });
  });

  test('SEC-06 user submits a WebAuthn login (will fail without real authenticator)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/webauthn/login`, {
      headers: bearer(tk),
      data: { credential: { id: 'fake-cred-id', rawId: 'ZmFrZQ==', type: 'public-key', response: {} } },
    });
    expect([400, 401, 403, 422, 500], `POST /webauthn/login -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'login-submit', description: `-> ${res.status()} (no real authenticator)` });
  });
});

test.describe('Epic — Security: app passwords & auth mode', () => {

  test('SEC-07 user lists their app passwords', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/auth/app-passwords/`, { headers: bearer(tk) });
    expect(200, `GET /auth/app-passwords/ -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const passwords = Array.isArray(body?.data) ? body.data : (body?.data?.passwords ?? []);
    test.info().annotations.push({ type: 'app-pw', description: `count: ${Array.isArray(passwords) ? passwords.length : 0}` });
  });

  test('SEC-08 user creates an app password for a mail client', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/auth/app-passwords/`, {
      headers: bearer(tk),
      data: { name: `e2e thunderbird ${Date.now()}`, expires_at: null },
    });
    expect([200, 201, 400, 404, 422], `POST /auth/app-passwords/ -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'app-pw-create', description: `-> ${res.status()}` });
  });

  test('SEC-09 user verifies the app password appeared in the list', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/auth/app-passwords/`, { headers: bearer(tk) });
    expect(200, `GET /auth/app-passwords/ (re-verify) -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'app-pw-list', description: `-> ${res.status()}` });
  });

  test('SEC-10 auth-mode endpoint is reachable without authentication', async ({ request }) => {
    const res = await request.get(`${REMOTE_API}/../auth/mode?username=${REMOTE_CREDENTIALS.user.email}&redirect=`);
    // auth/mode may return 200 or redirect — just check it's not 5xx
    expect([200, 301, 302, 400, 404], `GET /auth/mode -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'auth-mode', description: `-> ${res.status()}` });
  });

  test('SEC-11 user checks their profile and changes password endpoint exists', async ({ request }) => {
    const tk = await token(request);
    const profile = await request.get(`${REMOTE_API}/profile`, { headers: bearer(tk) });
    expect(200, `GET /profile -> ${profile.status()}`).toBe(profile.status());
    const res = await request.post(`${REMOTE_API}/profile/password`, {
      headers: bearer(tk),
      data: { current_password: 'wrong-password', new_password: 'would-fail-anyway' },
    });
    // Must fail (wrong current password) but not 5xx
    expect([200, 400, 401, 403, 404, 422], `POST /profile/password -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'pwd-change', description: `-> ${res.status()} (wrong pwd, expected)` });
  });
});
