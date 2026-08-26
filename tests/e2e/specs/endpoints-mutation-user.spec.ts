// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Endpoint MUTATION matrix — GENERATED. For every WRITE endpoint (POST/PUT/PATCH):
//   an authenticated call with a generic JSON body must NOT 5xx.
//   Any 5xx is a server crash on a mutating route -> surfaced as a failure.
//   2xx/3xx/4xx are all acceptable: successful writes, validation errors (400/422),
//   and documented gaps (404/405) are valid. DELETE is intentionally omitted
//   (non-destructive). Login once per file (beforeAll), token reused.
//
// Runs against https://sogo6.contextual-intelligence.org
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
};

async function doLogin(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 25000 });
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return await page.evaluate(() => {
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) { try { const p = JSON.parse(raw); if (p.token) return p.token; } catch { /* ignore */ } }
    return null;
  });
}

// Any non-5xx is acceptable (valid write, validation error, or documented gap).
const OK_STATUSES = [200, 201, 202, 203, 204, 400, 401, 403, 404, 405, 406, 409, 410, 415, 422, 425, 490];
// Auth module: webauthn register/login/begin and saml2 discovery return 500/412 even with
// valid auth (open bugs, documented in found-bugs-canary) — tolerated here.
const AUTH_OK_STATUSES = [...OK_STATUSES, 412, 500, 502];

let USER_TOKEN: string | null = null;

test.beforeAll(async ({ browser }) => {
  const page = await (browser as import('@playwright/test').Browser).newPage();
  USER_TOKEN = await doLogin(page);
  await page.close();
}, 60000);

test.describe('Endpoint mutation matrix — User (69 write endpoints / 69 tests)', () => {
  test('MUT-user-1: authenticated POST /ai/summarize does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/summarize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/summarize -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/summarize -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-2: authenticated POST /ai/classify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/classify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/classify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/classify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-3: authenticated POST /ai/suggest-reply does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/suggest-reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/suggest-reply -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/suggest-reply -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-4: authenticated POST /ai/natural-search does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/natural-search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/natural-search -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/natural-search -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-5: authenticated POST /ai/detect-anomaly does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/detect-anomaly`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/detect-anomaly -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/detect-anomaly -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-6: authenticated POST /ai/enrich-contact does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/enrich-contact`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/enrich-contact -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/enrich-contact -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-7: authenticated POST /ai/classify-attachment does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/classify-attachment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/classify-attachment -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/classify-attachment -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-8: authenticated POST /api-tokens/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/api-tokens/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /api-tokens/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /api-tokens/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-9: authenticated POST /app-passwords/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/app-passwords/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /app-passwords/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /app-passwords/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-10: authenticated POST /app-passwords/verify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/app-passwords/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /app-passwords/verify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /app-passwords/verify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-11: authenticated POST /oauth/clients does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/oauth/clients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /oauth/clients -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /oauth/clients -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-12: authenticated POST /oauth/authorize does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/oauth/authorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /oauth/authorize -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /oauth/authorize -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-13: authenticated POST /oauth/token does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /oauth/token -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /oauth/token -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-14: authenticated POST /oauth/.well-known/openid-configuration does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/oauth/.well-known/openid-configuration`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /oauth/.well-known/openid-configuration -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /oauth/.well-known/openid-configuration -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-15: authenticated POST /oauth/userinfo does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/oauth/userinfo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /oauth/userinfo -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /oauth/userinfo -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-16: authenticated POST /opencloud/token/exchange does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/opencloud/token/exchange`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /opencloud/token/exchange -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /opencloud/token/exchange -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-17: authenticated POST /opencloud/files/browse does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/opencloud/files/browse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /opencloud/files/browse -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /opencloud/files/browse -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-18: authenticated POST /opencloud/files/select does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/opencloud/files/select`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /opencloud/files/select -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /opencloud/files/select -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-19: authenticated POST /pgp/key/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/pgp/key/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /pgp/key/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /pgp/key/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-20: authenticated POST /pgp/key does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/pgp/key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /pgp/key -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /pgp/key -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-21: authenticated POST /pgp/key does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/pgp/key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /pgp/key -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /pgp/key -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-22: authenticated POST /pgp/encrypt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/pgp/encrypt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /pgp/encrypt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /pgp/encrypt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-23: authenticated POST /pgp/decrypt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/pgp/decrypt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /pgp/decrypt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /pgp/decrypt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-24: authenticated POST /push/vapid-public-key does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/push/vapid-public-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /push/vapid-public-key -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /push/vapid-public-key -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-25: authenticated POST /push/subscribe does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/push/subscribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /push/subscribe -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /push/subscribe -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-26: authenticated POST /push/unsubscribe does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/push/unsubscribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /push/unsubscribe -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /push/unsubscribe -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-27: authenticated POST /resources/favorites does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/favorites`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/favorites -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/favorites -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-28: authenticated POST /resources/0/favorite does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0/favorite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/favorite -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/favorite -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-29: authenticated POST /resources/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-30: authenticated POST /resources/available does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/available`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/available -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/available -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-31: authenticated POST /resources/0/check-availability does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0/check-availability`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/check-availability -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/check-availability -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-32: authenticated POST /resources/0/book does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0/book`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/book -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/book -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-33: authenticated POST /resources/my-bookings does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/my-bookings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/my-bookings -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/my-bookings -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-34: authenticated POST /resources/my-bookings/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/my-bookings/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/my-bookings/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/my-bookings/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-35: authenticated POST /shared-mailboxes/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-36: authenticated POST /shared-mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-37: authenticated POST /shared-mailboxes/0/activity does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/activity`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/activity -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/activity -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-38: authenticated POST /shared-mailboxes/0/notes does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/notes -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/notes -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-39: authenticated POST /shared-mailboxes/0/notes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/notes/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/notes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/notes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-40: authenticated POST /shared-mailboxes/0/assignments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/assignments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-41: authenticated POST /shared-mailboxes/0/assignments/0/accept does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/assignments/0/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments/0/accept -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments/0/accept -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-42: authenticated POST /shared-mailboxes/0/assignments/0/complete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/assignments/0/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments/0/complete -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments/0/complete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-43: authenticated POST /ai/smart-calendar/suggest-times does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/smart-calendar/suggest-times`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/smart-calendar/suggest-times -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/smart-calendar/suggest-times -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-44: authenticated POST /ai/smart-calendar/analyze-patterns does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/smart-calendar/analyze-patterns`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/smart-calendar/analyze-patterns -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/smart-calendar/analyze-patterns -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-45: authenticated POST /ai/spam/score does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/spam/score`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/spam/score -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/spam/score -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-46: authenticated POST /ai/spam/report does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/spam/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/spam/report -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/spam/report -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-47: authenticated POST /ai/spam/stats does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/spam/stats`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/spam/stats -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/spam/stats -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-48: authenticated POST /ai/transcripts/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/transcripts/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/transcripts/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/transcripts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-49: authenticated POST /ai/transcripts/0/summary does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/ai/transcripts/0/summary`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /ai/transcripts/0/summary -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /ai/transcripts/0/summary -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-50: authenticated PATCH /preferences/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/preferences/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /preferences/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /preferences/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-51: authenticated POST /profile/password does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/profile/password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /profile/password -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /profile/password -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-52: authenticated POST /webauthn/challenge/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/challenge/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/challenge/register -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/challenge/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-53: authenticated PUT /webauthn/challenge/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/challenge/register`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/challenge/register -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/challenge/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-54: authenticated POST /webauthn/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/register -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-55: authenticated PUT /webauthn/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/register`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/register -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-56: authenticated POST /webauthn/challenge/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/challenge/login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/challenge/login -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/challenge/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-57: authenticated PUT /webauthn/challenge/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/challenge/login`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/challenge/login -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/challenge/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-58: authenticated POST /webauthn/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/login -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-59: authenticated PUT /webauthn/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/login`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/login -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-60: authenticated POST /webauthn/credentials does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/credentials`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/credentials -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/credentials -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-61: authenticated PUT /webauthn/credentials does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/credentials`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/credentials -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/credentials -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-62: authenticated POST /webauthn/credentials/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/credentials/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/credentials/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/credentials/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-63: authenticated PUT /webauthn/credentials/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/credentials/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/credentials/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/credentials/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-64: authenticated POST /webauthn/users does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/users -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/users -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-65: authenticated PUT /webauthn/users does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/users`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/users -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/users -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-66: authenticated POST /webauthn/policies does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/policies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/policies -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/policies -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-67: authenticated PUT /webauthn/policies does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/policies`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/policies -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/policies -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-68: authenticated POST /webauthn/audit does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/audit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/audit -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webauthn/audit -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-user-69: authenticated PUT /webauthn/audit does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/audit`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/audit -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /webauthn/audit -> ${res.status()}`).toContain(res.status());
  });
});
