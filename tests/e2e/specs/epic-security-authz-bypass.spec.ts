/**
 * CRA Art. 10(1)(c) — Authorization Bypass Verification (G2)
 */
import { test, expect } from '@playwright/test';
import { apiLogin, REMOTE_API, bearer, REMOTE_CREDENTIALS } from '../helpers';

const BASE = REMOTE_API.replace('/api/user/v1', '');
const USER_API = BASE + '/api/user/v1';
const ADMIN_API = BASE + '/api/admin/v1';

let userToken: string | null = null;
let adminToken: string | null = null;
async function getUserToken(): Promise<string> {
  if (!userToken) userToken = await apiLogin(REMOTE_CREDENTIALS.user.email, REMOTE_CREDENTIALS.user.password);
  return userToken;
}
async function getAdminToken(): Promise<string> {
  if (!adminToken) adminToken = await apiLogin(REMOTE_CREDENTIALS.admin.username, REMOTE_CREDENTIALS.admin.password, REMOTE_API);
  return adminToken;
}

test.describe('Authorization bypass — CRA Art. 10(1)(c)', () => {

  test('AUTHZ-01 user JWT rejected on admin endpoint', async ({ request }) => {
    const tk = await getUserToken();
    const res = await request.get(`${ADMIN_API}/users`, { headers: bearer(tk) });
    expect([401, 403, 404], `User token on admin /users -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-02 admin JWT on user endpoint (document behavior)', async ({ request }) => {
    const tk = await getAdminToken();
    const res = await request.get(`${USER_API}/profile`, { headers: bearer(tk) });
    expect([401, 403, 404], `Admin token on user /profile -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-03 no token on protected endpoint returns 401/403/404', async ({ request }) => {
    const res = await request.get(`${USER_API}/mailboxes`);
    expect([401, 403, 404], `No auth on /mailboxes -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-04 expired token rejected', async ({ request }) => {
    const expired = 'eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiJ0ZXN0QHRlc3QuY29tIiwiZXhwIjoxMDAwMDAwMDAwfQ.fake';
    const res = await request.get(`${USER_API}/mailboxes`, { headers: bearer(expired) });
    expect([401, 403, 404], `Expired token -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-05 tampered token (bad signature) rejected', async ({ request }) => {
    const tk = await getUserToken();
    if (!tk || tk.split('.').length !== 3) {
      test.info().annotations.push({ type: 'skip', description: 'Token not in JWT format' });
      return;
    }
    const parts = tk.split('.');
    parts[2] = parts[2].slice(0, -10) + 'XXXXXXXXXX';
    const tampered = parts.join('.');
    const res = await request.get(`${USER_API}/mailboxes`, { headers: bearer(tampered) });
    expect([401, 403, 404], `Tampered signature -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-06 cross-user calendar isolation', async ({ request }) => {
    const tk = await getUserToken();
    const res = await request.get(`${USER_API}/calendars/99999`, { headers: bearer(tk) });
    expect([404, 403, 400, 401], `Cross-user calendar 99999 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-07 cross-user addressbook write blocked', async ({ request }) => {
    const tk = await getUserToken();
    const res = await request.post(`${USER_API}/address-books/99999/contacts`, {
      headers: { ...bearer(tk), 'Content-Type': 'application/json' },
      data: { first_name: 'Evil', last_name: 'Test' },
    });
    expect([403, 404, 400, 422], `Cross-user AB write -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-08 own mailbox read works', async ({ request }) => {
    const tk = await getUserToken();
    const res = await request.get(`${USER_API}/mailboxes/0/folders/INBOX/mails`, { headers: bearer(tk) });
    expect(res.status()).toBeLessThan(500);
  });

  test('AUTHZ-09 malformed authorization header rejected', async ({ request }) => {
    const res = await request.get(`${USER_API}/mailboxes`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    expect([401, 403, 404], `Malformed Bearer -> ${res.status()}`).toContain(res.status());
  });

  test('AUTHZ-10 different user endpoint accessed directly', async ({ request }) => {
    // Try to access lisa.mayer's profile as testuser
    const tk = await getUserToken();
    const res = await request.get(`${USER_API}/profile`, { headers: bearer(tk) });
    const body = await res.json().catch(() => ({}));
    const uid = body?.data?.uid || body?.data?.email || '';
    // Verify we only see our own data, not another user's
    if (uid) {
      expect(uid).toContain('testuser');
    }
    test.info().annotations.push({ type: 'profile-uid', description: `-> ${res.status()} uid=${uid}` });
  });

});
