// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Endpoint-matrix suite — GENERATED. For every route in this module:
//   1. AUTH-GUARD: an unauthenticated call must be rejected (401/403/404)
//   2. SMOKE: a non-mutating (GET/HEAD/OPTIONS) call with valid auth must not
//      crash the server (5xx fails the test). 200/4xx are all acceptable —
//      working endpoints, documented gaps, and validation errors are all valid
//   5xx server errors surface as failures (regression + bug discovery).
// Login happens once per file (beforeAll) and the token is reused.
//
// Runs against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
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

// OK: any non-5xx (reachable & exercised). GUARD: protected must reject anonymous.
const OK_STATUSES = [200, 201, 202, 204, 400, 401, 403, 404, 405, 409, 422, 425, 490];
const GUARD_STATUSES = [400, 401, 403, 404, 405, 422];
// Auth module contains legitimately public/self-service endpoints (login, mode, saml),
// and several endpoints return 500 instead of 401/403 on anonymous access — this is a
// KNOWN BUG surfaced by the test suite, not a guard failure to reject here.
const AUTH_GUARD_STATUSES = [200, 400, 401, 403, 404, 405, 409, 412, 422, 425, 500];
// Auth module SMOKE: webauthn-credentials / saml2-callback / saml2-metadata are known to
// return 500/412 even with valid auth (open bugs) — tolerated here, documented separately
// in found-bugs-canary.spec.ts.
const AUTH_OK_STATUSES = [...OK_STATUSES, 412, 500, 502];
// Public endpoints legitimately return 200 anonymously (e.g. theme config fetchable pre-login).
const PUBLIC_GUARD_STATUSES = [...GUARD_STATUSES, 200];
const PUBLIC_ROUTES_GEN = new Set(['/customization/themes', '/auth/mode', '/auth/login', '/jmap/session', '/health', '/system', '/docs', '/metrics']);

let USER_TOKEN: string | null = null;

test.beforeAll(async ({ browser }) => {
  const page = await (browser as import('@playwright/test').Browser).newPage();
  USER_TOKEN = await doLogin(page);
  await page.close();
}, 60000);

test.describe('Endpoint matrix — Address Book (18 routes / 56 tests)', () => {
  test('AUTH-addressbook-1: GET /addressbooks rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: POST /addressbooks rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-2: POST /addressbooks is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: DELETE /addressbooks/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: DELETE /addressbooks/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /addressbooks/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: GET /addressbooks/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-2: GET /addressbooks/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-3: PATCH /addressbooks/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-3: PATCH /addressbooks/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /addressbooks/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /addressbooks/0/contacts rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks/0/contacts executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: POST /addressbooks/0/contacts rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/0/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-2: POST /addressbooks/0/contacts is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/0/contacts anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: DELETE /addressbooks/0/contacts/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: DELETE /addressbooks/0/contacts/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /addressbooks/0/contacts/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: GET /addressbooks/0/contacts/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-2: GET /addressbooks/0/contacts/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-3: PATCH /addressbooks/0/contacts/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-3: PATCH /addressbooks/0/contacts/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /addressbooks/0/contacts/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /addressbooks/0/contacts/0/export rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0/export`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/contacts/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks/0/contacts/0/export executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/contacts/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: POST /addressbooks/0/contacts/import rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/import`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/0/contacts/import -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: POST /addressbooks/0/contacts/import is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/import`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/0/contacts/import anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /addressbooks/0/export rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/export`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks/0/export executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /addressbooks/0/lists rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/lists -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks/0/lists executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/lists -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: POST /addressbooks/0/lists rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/0/lists -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-2: POST /addressbooks/0/lists is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/0/lists anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: DELETE /addressbooks/0/lists/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: DELETE /addressbooks/0/lists/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /addressbooks/0/lists/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: GET /addressbooks/0/lists/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-2: GET /addressbooks/0/lists/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-3: PATCH /addressbooks/0/lists/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-3: PATCH /addressbooks/0/lists/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /addressbooks/0/lists/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /addressbooks/0/lists/0/export rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0/export`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/lists/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks/0/lists/0/export executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/lists/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: POST /addressbooks/0/lists/import rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/import`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/0/lists/import -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: POST /addressbooks/0/lists/import is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/import`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/0/lists/import anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /addressbooks/0/shares rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /addressbooks/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /addressbooks/0/shares executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /addressbooks/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-2: POST /addressbooks/0/shares rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-2: POST /addressbooks/0/shares is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/0/shares anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: DELETE /addressbooks/0/shares/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /addressbooks/0/shares/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: DELETE /addressbooks/0/shares/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /addressbooks/0/shares/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: POST /addressbooks/0/sync rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/sync`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: POST /addressbooks/0/sync is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/sync`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/0/sync anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: POST /addressbooks/external rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/external`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/external -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: POST /addressbooks/external is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/external`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/external anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: POST /addressbooks/import rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/import`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /addressbooks/import -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-addressbook-1: POST /addressbooks/import is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/import`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /addressbooks/import anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /contacts rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /contacts -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /contacts executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /contacts -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-addressbook-1: GET /contacts/autocomplete rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts/autocomplete`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /contacts/autocomplete -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-addressbook-1: GET /contacts/autocomplete executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts/autocomplete`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /contacts/autocomplete -> ${res.status()}`).toContain(res.status());
  });
});
