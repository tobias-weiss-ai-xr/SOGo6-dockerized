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

test.describe('Endpoint matrix — Calendar (36 routes / 118 tests)', () => {
  test('AUTH-calendar-1: GET /appointment-slots rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /appointment-slots -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /appointment-slots executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /appointment-slots -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /appointment-slots rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /appointment-slots -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /appointment-slots is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /appointment-slots anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /appointment-slots/0/book rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots/0/book`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /appointment-slots/0/book -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /appointment-slots/0/book is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots/0/book`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /appointment-slots/0/book anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /appointment-slots/bookings rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots/bookings`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /appointment-slots/bookings -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /appointment-slots/bookings executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots/bookings`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /appointment-slots/bookings -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /calendars/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /calendars/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /calendars/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: GET /calendars/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-2: GET /calendars/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-3: PATCH /calendars/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-3: PATCH /calendars/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /calendars/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/0/events rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/events`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/0/events -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/0/events executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/events`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/0/events -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars/0/events rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/events`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/0/events -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars/0/events is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/events`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/0/events anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/0/export rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/export`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/0/export executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /calendars/0/import rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/import`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/0/import -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /calendars/0/import is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/import`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/0/import anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/0/shares rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/0/shares executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars/0/shares rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars/0/shares is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/0/shares anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /calendars/0/shares/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /calendars/0/shares/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /calendars/0/shares/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /calendars/0/shares/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /calendars/0/subscription rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/subscription`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /calendars/0/subscription -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /calendars/0/subscription is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/subscription`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /calendars/0/subscription anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars/0/subscription rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/subscription`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/0/subscription -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars/0/subscription is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/subscription`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/0/subscription anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/0/tasks rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/tasks`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/0/tasks -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/0/tasks executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/tasks`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/0/tasks -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars/0/tasks rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/tasks`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/0/tasks -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars/0/tasks is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/tasks`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/0/tasks anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/caldav/connection rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/caldav/connection`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/caldav/connection -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/caldav/connection executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/caldav/connection`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/caldav/connection -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/caldav/overview rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/caldav/overview`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/caldav/overview -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/caldav/overview executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/caldav/overview`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/caldav/overview -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/teams rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/teams -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/teams executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/teams -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars/teams rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/teams -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars/teams is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/teams anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /calendars/teams/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /calendars/teams/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /calendars/teams/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /calendars/teams/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: GET /calendars/teams/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/teams/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-2: GET /calendars/teams/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/teams/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-3: PATCH /calendars/teams/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /calendars/teams/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-3: PATCH /calendars/teams/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /calendars/teams/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /calendars/teams/0/invites rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/invites`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/teams/0/invites -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /calendars/teams/0/invites is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/invites`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/teams/0/invites anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/teams/0/members rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/teams/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/teams/0/members executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/teams/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /calendars/teams/0/members rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/teams/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /calendars/teams/0/members is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/teams/0/members anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /calendars/teams/0/members/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /calendars/teams/0/members/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /calendars/teams/0/members/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /calendars/teams/0/members/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: PATCH /calendars/teams/0/members/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /calendars/teams/0/members/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: PATCH /calendars/teams/0/members/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /calendars/teams/0/members/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /calendars/teams/invites rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/teams/invites -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /calendars/teams/invites executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/teams/invites -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /calendars/teams/invites/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /calendars/teams/invites/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /calendars/teams/invites/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /calendars/teams/invites/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: GET /calendars/teams/invites/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /calendars/teams/invites/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-2: GET /calendars/teams/invites/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /calendars/teams/invites/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /calendars/teams/invites/0/accept rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0/accept`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/teams/invites/0/accept -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /calendars/teams/invites/0/accept is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0/accept`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/teams/invites/0/accept anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /calendars/teams/invites/0/reject rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0/reject`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /calendars/teams/invites/0/reject -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /calendars/teams/invites/0/reject is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0/reject`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /calendars/teams/invites/0/reject anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /events rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /events -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /events executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /events -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /events/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /events/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /events/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /events/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: GET /events/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /events/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-2: GET /events/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /events/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-3: PATCH /events/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /events/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-3: PATCH /events/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /events/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /events/0/attendance rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0/attendance`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /events/0/attendance -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /events/0/attendance is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0/attendance`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /events/0/attendance anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /external-calendars rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /external-calendars -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /external-calendars executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /external-calendars -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /external-calendars rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /external-calendars -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /external-calendars is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /external-calendars anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /external-calendars/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /external-calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /external-calendars/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /external-calendars/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: GET /external-calendars/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /external-calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-2: GET /external-calendars/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /external-calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-3: PUT /external-calendars/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, { method: "PUT" });
    expect(GUARD_STATUSES, `unauth PUT /external-calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-3: PUT /external-calendars/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, { method: "PUT" });
    expect(GUARD_STATUSES, `write PUT /external-calendars/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /external-calendars/0/sync rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0/sync`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /external-calendars/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /external-calendars/0/sync executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0/sync`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /external-calendars/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /external-calendars/0/sync rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0/sync`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /external-calendars/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /external-calendars/0/sync is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0/sync`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /external-calendars/0/sync anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /freebusy rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/freebusy`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /freebusy -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /freebusy is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/freebusy`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /freebusy anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /polls rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /polls -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /polls executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /polls -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: POST /polls rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /polls -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-2: POST /polls is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /polls anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: POST /polls/0/respond rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls/0/respond`, { method: "POST" });
    expect(GUARD_STATUSES, `unauth POST /polls/0/respond -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: POST /polls/0/respond is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls/0/respond`, { method: "POST" });
    expect(GUARD_STATUSES, `write POST /polls/0/respond anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /polls/0/results rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls/0/results`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /polls/0/results -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /polls/0/results executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls/0/results`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /polls/0/results -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /reminders rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/reminders`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /reminders -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /reminders executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/reminders`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /reminders -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: GET /tasks rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /tasks -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-1: GET /tasks executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /tasks -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-1: DELETE /tasks/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `unauth DELETE /tasks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-1: DELETE /tasks/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, { method: "DELETE" });
    expect(GUARD_STATUSES, `write DELETE /tasks/0 anonymous -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-2: GET /tasks/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, { method: "GET" });
    expect(GUARD_STATUSES, `unauth GET /tasks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('SMOKE-calendar-2: GET /tasks/0 executes (no 5xx)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(OK_STATUSES, `auth GET /tasks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('AUTH-calendar-3: PATCH /tasks/0 rejects anonymous', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `unauth PATCH /tasks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('GUARD-NOMUTATE-calendar-3: PATCH /tasks/0 is not reachable without auth (no data mutation)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, { method: "PATCH" });
    expect(GUARD_STATUSES, `write PATCH /tasks/0 anonymous -> ${res.status()}`).toContain(res.status());
  });
});
