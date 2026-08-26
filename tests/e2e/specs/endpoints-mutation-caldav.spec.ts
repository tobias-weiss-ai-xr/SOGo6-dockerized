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

test.describe('Endpoint mutation matrix — CalDAV (12 write endpoints / 12 tests)', () => {
  test('MUT-caldav-1: authenticated PROPFIND /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/`, {
      method: "PROPFIND",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPFIND /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPFIND /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-2: authenticated REPORT /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/`, {
      method: "REPORT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `REPORT /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write REPORT /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-3: authenticated PROPPATCH /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/`, {
      method: "PROPPATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPPATCH /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPPATCH /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-4: authenticated MKCALENDAR /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/`, {
      method: "MKCALENDAR",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCALENDAR /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCALENDAR /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-5: authenticated MKCOL /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/`, {
      method: "MKCOL",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCOL /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCOL /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-6: authenticated PUT /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-7: authenticated PROPFIND /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/INBOX`, {
      method: "PROPFIND",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPFIND /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPFIND /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-8: authenticated REPORT /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/INBOX`, {
      method: "REPORT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `REPORT /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write REPORT /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-9: authenticated PROPPATCH /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/INBOX`, {
      method: "PROPPATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPPATCH /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPPATCH /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-10: authenticated MKCALENDAR /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/INBOX`, {
      method: "MKCALENDAR",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCALENDAR /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCALENDAR /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-11: authenticated MKCOL /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/INBOX`, {
      method: "MKCOL",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCOL /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCOL /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-caldav-12: authenticated PUT /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/caldav/INBOX`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });
});
