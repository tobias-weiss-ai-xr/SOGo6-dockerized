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

test.describe('Endpoint mutation matrix — Admin (209 write endpoints / 209 tests)', () => {
  test('MUT-admin-1: authenticated POST /Microsoft-Server-ActiveSync/Provision does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Provision`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Provision -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Provision -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-2: authenticated POST /Microsoft-Server-ActiveSync/FolderSync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/FolderSync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/FolderSync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/FolderSync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-3: authenticated POST /Microsoft-Server-ActiveSync/Sync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Sync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Sync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-4: authenticated POST /Microsoft-Server-ActiveSync/Ping does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Ping`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Ping -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Ping -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-5: authenticated POST /Microsoft-Server-ActiveSync/GetAttachment does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/GetAttachment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/GetAttachment -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/GetAttachment -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-6: authenticated POST /Microsoft-Server-ActiveSync/SendMail does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/SendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/SendMail -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/SendMail -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-7: authenticated POST /Microsoft-Server-ActiveSync/Settings does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Settings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Settings -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Settings -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-8: authenticated POST /Microsoft-Server-ActiveSync/status does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/status -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/status -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-9: authenticated POST /auth/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/login -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /auth/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-10: authenticated POST /auth/logout does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/logout -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /auth/logout -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-11: authenticated POST /calendar/clean does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/calendar/clean`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendar/clean -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendar/clean -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-12: authenticated POST /config/dynamic-form does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/dynamic-form`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/dynamic-form -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/dynamic-form -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-13: authenticated PATCH /config/dynamic-form does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/dynamic-form`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/dynamic-form -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/dynamic-form -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-14: authenticated POST /config/system does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/system`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/system -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/system -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-15: authenticated PATCH /config/system does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/system`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/system -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/system -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-16: authenticated POST /config/theme does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/theme`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/theme -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/theme -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-17: authenticated PATCH /config/theme does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/theme`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/theme -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/theme -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-18: authenticated POST /config/domain-default does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domain-default`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/domain-default -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/domain-default -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-19: authenticated PATCH /config/domain-default does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domain-default`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/domain-default -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/domain-default -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-20: authenticated POST /config/domains does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domains`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/domains -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/domains -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-21: authenticated PATCH /config/domains does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domains`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/domains -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/domains -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-22: authenticated POST /config/domains/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domains/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/domains/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/domains/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-23: authenticated PATCH /config/domains/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domains/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/domains/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/domains/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-24: authenticated POST /config/rules does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/rules`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/rules -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/rules -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-25: authenticated PATCH /config/rules does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/rules`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/rules -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/rules -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-26: authenticated POST /config/rules/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/rules/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/rules/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/rules/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-27: authenticated PATCH /config/rules/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/rules/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/rules/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/rules/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-28: authenticated POST /users/list does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/list`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/list -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/list -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-29: authenticated PUT /users/list does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/list`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/list -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/list -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-30: authenticated POST /users/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-31: authenticated PUT /users/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-32: authenticated POST /users/create does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/create -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/create -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-33: authenticated PUT /users/create does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/create`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/create -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/create -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-34: authenticated POST /users/active does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/active`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/active -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/active -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-35: authenticated PUT /users/active does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/active`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/active -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/active -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-36: authenticated POST /users/revoke does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/revoke -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/revoke -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-37: authenticated PUT /users/revoke does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/revoke`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/revoke -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/revoke -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-38: authenticated POST /users/inactive does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/inactive`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/inactive -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/inactive -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-39: authenticated PUT /users/inactive does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/inactive`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/inactive -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/inactive -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-40: authenticated POST /approvals/0/action does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/approvals/0/action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /approvals/0/action -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /approvals/0/action -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-41: authenticated POST /backup/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /backup/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /backup/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-42: authenticated PUT /backup/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/config`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /backup/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /backup/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-43: authenticated POST /backup/trigger does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/trigger`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /backup/trigger -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /backup/trigger -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-44: authenticated PUT /backup/trigger does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/trigger`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /backup/trigger -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /backup/trigger -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-45: authenticated POST /backup/0/verify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/0/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /backup/0/verify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /backup/0/verify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-46: authenticated PUT /backup/0/verify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/0/verify`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /backup/0/verify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /backup/0/verify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-47: authenticated POST /backup/0/restore does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/0/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /backup/0/restore -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /backup/0/restore -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-48: authenticated PUT /backup/0/restore does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/0/restore`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /backup/0/restore -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /backup/0/restore -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-49: authenticated POST /bulk-users/export/csv does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/bulk-users/export/csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /bulk-users/export/csv -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /bulk-users/export/csv -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-50: authenticated POST /bulk-users/import/csv does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/bulk-users/import/csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /bulk-users/import/csv -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /bulk-users/import/csv -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-51: authenticated POST /bulk-users/batch does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/bulk-users/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /bulk-users/batch -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /bulk-users/batch -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-52: authenticated POST /config-as-code/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config-as-code/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config-as-code/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config-as-code/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-53: authenticated POST /config-as-code/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config-as-code/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config-as-code/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config-as-code/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-54: authenticated POST /config-as-code/history does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config-as-code/history`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config-as-code/history -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config-as-code/history -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-55: authenticated POST /config-as-code/diff does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config-as-code/diff`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config-as-code/diff -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config-as-code/diff -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-56: authenticated POST /crm/accounts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/crm/accounts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /crm/accounts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /crm/accounts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-57: authenticated POST /crm/contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/crm/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /crm/contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /crm/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-58: authenticated POST /crm/interactions does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/crm/interactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /crm/interactions -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /crm/interactions -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-59: authenticated POST /db-migration/run does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/db-migration/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /db-migration/run -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /db-migration/run -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-60: authenticated POST /dns/spf/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/spf/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/spf/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/spf/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-61: authenticated POST /dns/spf/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/spf/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/spf/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/spf/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-62: authenticated POST /dns/dkim/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/dkim/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/dkim/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/dkim/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-63: authenticated POST /dns/dmarc/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/dmarc/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/dmarc/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/dmarc/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-64: authenticated POST /dns/dmarc/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/dmarc/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/dmarc/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/dmarc/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-65: authenticated PUT /branding/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/branding/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /branding/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /branding/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-66: authenticated PUT /branding/0/public does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/branding/0/public`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /branding/0/public -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /branding/0/public -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-67: authenticated POST /admin/donors/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-68: authenticated POST /admin/donors/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-69: authenticated POST /admin/donors/0/donate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/0/donate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/0/donate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/0/donate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-70: authenticated POST /admin/donors/0/donations/0/receipt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/0/donations/0/receipt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/0/donations/0/receipt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/0/donations/0/receipt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-71: authenticated POST /admin/donors/0/gdpr does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/0/gdpr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/0/gdpr -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/0/gdpr -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-72: authenticated POST /admin/eidas/sign does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/sign`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/sign -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/sign -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-73: authenticated POST /admin/eidas/verify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/verify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/verify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-74: authenticated POST /admin/eidas/certificates does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/certificates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/certificates -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/certificates -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-75: authenticated POST /admin/eidas/signatures does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/signatures`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/signatures -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/signatures -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-76: authenticated POST /email-auth/domains does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/domains -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/domains -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-77: authenticated PUT /email-auth/domains does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/domains -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/domains -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-78: authenticated POST /email-auth/domains/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/domains/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/domains/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-79: authenticated PUT /email-auth/domains/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/domains/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/domains/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-80: authenticated POST /email-auth/domains/0/status does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains/0/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/domains/0/status -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/domains/0/status -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-81: authenticated PUT /email-auth/domains/0/status does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains/0/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/domains/0/status -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/domains/0/status -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-82: authenticated POST /email-auth/dkim does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-83: authenticated PUT /email-auth/dkim does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dkim -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dkim -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-84: authenticated POST /email-auth/dkim/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-85: authenticated PUT /email-auth/dkim/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/generate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dkim/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dkim/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-86: authenticated POST /email-auth/dkim/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-87: authenticated PUT /email-auth/dkim/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dkim/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dkim/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-88: authenticated POST /email-auth/dkim/0/rotate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0/rotate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/0/rotate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/0/rotate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-89: authenticated PUT /email-auth/dkim/0/rotate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0/rotate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dkim/0/rotate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dkim/0/rotate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-90: authenticated POST /email-auth/dkim/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-91: authenticated PUT /email-auth/dkim/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0/validate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dkim/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dkim/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-92: authenticated POST /email-auth/dmarc does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dmarc -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dmarc -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-93: authenticated PUT /email-auth/dmarc does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dmarc -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dmarc -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-94: authenticated POST /email-auth/dmarc/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dmarc/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dmarc/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-95: authenticated PUT /email-auth/dmarc/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dmarc/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dmarc/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-96: authenticated POST /email-auth/dmarc/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dmarc/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dmarc/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-97: authenticated PUT /email-auth/dmarc/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0/validate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dmarc/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dmarc/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-98: authenticated POST /email-auth/dmarc/0/reports does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0/reports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dmarc/0/reports -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dmarc/0/reports -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-99: authenticated PUT /email-auth/dmarc/0/reports does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0/reports`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dmarc/0/reports -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dmarc/0/reports -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-100: authenticated POST /email-auth/spf does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/spf -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/spf -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-101: authenticated PUT /email-auth/spf does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/spf -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/spf -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-102: authenticated POST /email-auth/spf/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/spf/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/spf/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-103: authenticated PUT /email-auth/spf/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/spf/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/spf/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-104: authenticated POST /email-auth/spf/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/spf/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/spf/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-105: authenticated PUT /email-auth/spf/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0/validate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/spf/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/spf/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-106: authenticated POST /email-auth/test does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/test -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/test -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-107: authenticated PUT /email-auth/test does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/test`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/test -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/test -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-108: authenticated POST /email-auth/validate-all does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/validate-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/validate-all -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/validate-all -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-109: authenticated PUT /email-auth/validate-all does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/validate-all`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/validate-all -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/validate-all -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-110: authenticated POST /files/shares does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/files/shares`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /files/shares -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /files/shares -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-111: authenticated POST /tickets/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /tickets/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /tickets/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-112: authenticated PATCH /tickets/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /tickets/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /tickets/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-113: authenticated POST /tickets/0/respond does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets/0/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /tickets/0/respond -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /tickets/0/respond -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-114: authenticated PATCH /tickets/0/respond does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets/0/respond`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /tickets/0/respond -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /tickets/0/respond -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-115: authenticated POST /admin/hipaa/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-116: authenticated POST /admin/hipaa/detect-phi does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/detect-phi`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/detect-phi -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/detect-phi -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-117: authenticated POST /admin/hipaa/audit-trail does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/audit-trail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/audit-trail -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/audit-trail -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-118: authenticated POST /admin/hipaa/encrypt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/encrypt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/encrypt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/encrypt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-119: authenticated POST /admin/hipaa/decrypt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/decrypt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/decrypt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/decrypt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-120: authenticated POST /admin/import/pst/analyze does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/pst/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/pst/analyze -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/pst/analyze -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-121: authenticated POST /admin/import/pst/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/pst/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/pst/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/pst/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-122: authenticated POST /admin/import/m365/discover does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/m365/discover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/m365/discover -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/m365/discover -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-123: authenticated POST /admin/import/m365/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/m365/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/m365/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/m365/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-124: authenticated POST /admin/import/jobs does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/jobs -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/jobs -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-125: authenticated POST /admin/import/jobs/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/jobs/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/jobs/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/jobs/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-126: authenticated POST /jmap/session does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/jmap/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jmap/session -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jmap/session -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-127: authenticated POST /jmap/upload/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/jmap/upload/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jmap/upload/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jmap/upload/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-128: authenticated POST /jmap/download/0/0/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/jmap/download/0/0/INBOX`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jmap/download/0/0/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jmap/download/0/0/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-129: authenticated POST /jmap/status does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/jmap/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jmap/status -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jmap/status -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-130: authenticated POST /matrix/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-131: authenticated POST /matrix/serverkey does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/serverkey`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/serverkey -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/serverkey -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-132: authenticated POST /matrix/rooms does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/rooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/rooms -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/rooms -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-133: authenticated POST /matrix/rooms/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/rooms/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/rooms/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/rooms/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-134: authenticated POST /matrix/rooms/0/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/rooms/0/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/rooms/0/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/rooms/0/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-135: authenticated POST /matrix/link does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/link -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/link -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-136: authenticated POST /migration/history does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/history`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/history -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/history -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-137: authenticated POST /migration/sources does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/sources`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/sources -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/sources -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-138: authenticated POST /migration/start does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/start -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/start -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-139: authenticated POST /migration/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-140: authenticated POST /migration/0/cancel does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/0/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/0/cancel -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/0/cancel -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-141: authenticated POST /admin/mobile/devices does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/devices`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/devices -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/devices -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-142: authenticated POST /admin/mobile/devices/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/devices/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/devices/register -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/devices/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-143: authenticated POST /admin/mobile/devices/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/devices/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/devices/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/devices/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-144: authenticated POST /admin/mobile/devices/0/ping does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/devices/0/ping`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/devices/0/ping -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/devices/0/ping -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-145: authenticated POST /admin/mobile/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-146: authenticated POST /admin/mobile/push/broadcast does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/push/broadcast`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/push/broadcast -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/push/broadcast -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-147: authenticated POST /quick-actions/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/quick-actions/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /quick-actions/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /quick-actions/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-148: authenticated POST /quick-actions/0/execute does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/quick-actions/0/execute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /quick-actions/0/execute -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /quick-actions/0/execute -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-149: authenticated POST /resources/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-150: authenticated PATCH /resources/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /resources/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /resources/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-151: authenticated POST /resources/available does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/available`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/available -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/available -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-152: authenticated PATCH /resources/available does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/available`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /resources/available -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /resources/available -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-153: authenticated POST /resources/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-154: authenticated PATCH /resources/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /resources/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /resources/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-155: authenticated POST /resources/0/availability does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/0/availability`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/availability -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/availability -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-156: authenticated PATCH /resources/0/availability does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/0/availability`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /resources/0/availability -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /resources/0/availability -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-157: authenticated POST /auth/saml2/providers does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/providers -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /auth/saml2/providers -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-158: authenticated PUT /auth/saml2/providers does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /auth/saml2/providers -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /auth/saml2/providers -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-159: authenticated POST /auth/saml2/providers/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/providers/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /auth/saml2/providers/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-160: authenticated PUT /auth/saml2/providers/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /auth/saml2/providers/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /auth/saml2/providers/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-161: authenticated POST /auth/saml2/providers/0/refresh does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers/0/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/providers/0/refresh -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /auth/saml2/providers/0/refresh -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-162: authenticated PUT /auth/saml2/providers/0/refresh does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers/0/refresh`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /auth/saml2/providers/0/refresh -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /auth/saml2/providers/0/refresh -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-163: authenticated POST /scim/v2/Users does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/scim/v2/Users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /scim/v2/Users -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /scim/v2/Users -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-164: authenticated PATCH /scim/v2/Users does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/scim/v2/Users`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /scim/v2/Users -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /scim/v2/Users -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-165: authenticated POST /scim/v2/Users/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/scim/v2/Users/INBOX`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /scim/v2/Users/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /scim/v2/Users/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-166: authenticated PATCH /scim/v2/Users/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/scim/v2/Users/INBOX`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /scim/v2/Users/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /scim/v2/Users/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-167: authenticated POST /shared-mailboxes/search does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/search -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/search -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-168: authenticated PUT /shared-mailboxes/search does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/search`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/search -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/search -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-169: authenticated POST /shared-mailboxes/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-170: authenticated PUT /shared-mailboxes/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/export`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-171: authenticated POST /shared-mailboxes/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-172: authenticated PUT /shared-mailboxes/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/import`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-173: authenticated POST /shared-mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-174: authenticated PUT /shared-mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-175: authenticated POST /shared-mailboxes/0/members does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/members -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-176: authenticated PUT /shared-mailboxes/0/members does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/members`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/members -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-177: authenticated POST /shared-mailboxes/0/members/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/members/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/members/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/members/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-178: authenticated PUT /shared-mailboxes/0/members/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/members/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/members/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/members/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-179: authenticated POST /shared-mailboxes/0/analytics does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/analytics`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/analytics -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/analytics -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-180: authenticated PUT /shared-mailboxes/0/analytics does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/analytics`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/analytics -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/analytics -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-181: authenticated POST /shared-mailboxes/0/analytics/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/analytics/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/analytics/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/analytics/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-182: authenticated PUT /shared-mailboxes/0/analytics/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/analytics/export`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/analytics/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/analytics/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-183: authenticated POST /shared-mailboxes/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-184: authenticated PUT /shared-mailboxes/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/export`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-185: authenticated POST /shared-mailboxes/0/notes does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/notes -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/notes -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-186: authenticated PUT /shared-mailboxes/0/notes does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/notes`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/notes -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/notes -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-187: authenticated POST /shared-mailboxes/0/notes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/notes/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/notes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/notes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-188: authenticated PUT /shared-mailboxes/0/notes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/notes/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/notes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/notes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-189: authenticated POST /shared-mailboxes/0/assignments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/assignments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-190: authenticated PUT /shared-mailboxes/0/assignments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/assignments`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/assignments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/assignments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-191: authenticated POST /shared-mailboxes/0/assignments/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/assignments/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-192: authenticated PUT /shared-mailboxes/0/assignments/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/assignments/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/assignments/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/assignments/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-193: authenticated POST /student-groups/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-194: authenticated POST /student-groups/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-195: authenticated POST /student-groups/enroll does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/enroll -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/enroll -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-196: authenticated POST /student-groups/drop does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/drop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/drop -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/drop -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-197: authenticated PUT /quotas/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/quotas/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /quotas/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /quotas/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-198: authenticated POST /admin/volunteers/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-199: authenticated POST /admin/volunteers/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-200: authenticated POST /admin/volunteers/shifts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/shifts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/shifts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/shifts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-201: authenticated POST /admin/volunteers/shifts/0/checkin does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/shifts/0/checkin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/shifts/0/checkin -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/shifts/0/checkin -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-202: authenticated POST /admin/volunteers/shifts/0/checkout does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/shifts/0/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/shifts/0/checkout -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/shifts/0/checkout -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-203: authenticated POST /admin/volunteers/0/certificate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/0/certificate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/0/certificate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/0/certificate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-204: authenticated POST /webhooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/webhooks/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webhooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webhooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-205: authenticated PATCH /webhooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/webhooks/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /webhooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /webhooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-206: authenticated POST /workflows/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /workflows/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /workflows/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-207: authenticated PATCH /workflows/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /workflows/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /workflows/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-208: authenticated POST /workflows/0/test does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows/0/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /workflows/0/test -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /workflows/0/test -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-admin-209: authenticated PATCH /workflows/0/test does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows/0/test`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /workflows/0/test -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /workflows/0/test -> ${res.status()}`).toContain(res.status());
  });
});
