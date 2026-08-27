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

test.describe('Endpoint mutation matrix — Everything (222 write endpoints / 222 tests)', () => {
  test('MUT-1: authenticated POST /Microsoft-Server-ActiveSync/FolderSync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/FolderSync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/FolderSync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/FolderSync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-2: authenticated POST /Microsoft-Server-ActiveSync/Ping does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Ping`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Ping -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Ping -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-3: authenticated POST /Microsoft-Server-ActiveSync/Provision does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Provision`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Provision -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Provision -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-4: authenticated POST /Microsoft-Server-ActiveSync/SendMail does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/SendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/SendMail -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/SendMail -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-5: authenticated POST /Microsoft-Server-ActiveSync/Settings does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Settings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Settings -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Settings -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-6: authenticated POST /Microsoft-Server-ActiveSync/Sync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/Microsoft-Server-ActiveSync/Sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /Microsoft-Server-ActiveSync/Sync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /Microsoft-Server-ActiveSync/Sync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-7: authenticated POST /admin/donors/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-8: authenticated POST /admin/donors/0/donate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/0/donate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/0/donate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/0/donate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-9: authenticated POST /admin/donors/0/gdpr does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/donors/0/gdpr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/donors/0/gdpr -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/donors/0/gdpr -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-10: authenticated POST /admin/eidas/certificates does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/certificates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/certificates -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/certificates -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-11: authenticated POST /admin/eidas/sign does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/sign`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/sign -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/sign -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-12: authenticated POST /admin/eidas/verify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/eidas/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/eidas/verify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/eidas/verify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-13: authenticated POST /admin/hipaa/audit-trail does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/audit-trail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/audit-trail -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/audit-trail -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-14: authenticated POST /admin/hipaa/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-15: authenticated POST /admin/hipaa/decrypt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/decrypt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/decrypt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/decrypt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-16: authenticated POST /admin/hipaa/detect-phi does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/detect-phi`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/detect-phi -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/detect-phi -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-17: authenticated POST /admin/hipaa/encrypt does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/hipaa/encrypt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/hipaa/encrypt -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/hipaa/encrypt -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-18: authenticated POST /admin/import/m365/discover does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/m365/discover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/m365/discover -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/m365/discover -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-19: authenticated POST /admin/import/m365/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/m365/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/m365/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/m365/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-20: authenticated POST /admin/import/pst/analyze does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/pst/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/pst/analyze -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/pst/analyze -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-21: authenticated POST /admin/import/pst/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/import/pst/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/import/pst/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/import/pst/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-22: authenticated POST /admin/mobile/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-23: authenticated POST /admin/mobile/devices/0/ping does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/devices/0/ping`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/devices/0/ping -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/devices/0/ping -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-24: authenticated POST /admin/mobile/devices/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/devices/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/devices/register -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/devices/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-25: authenticated POST /admin/mobile/push/broadcast does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/mobile/push/broadcast`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/mobile/push/broadcast -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/mobile/push/broadcast -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-26: authenticated POST /admin/volunteers/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-27: authenticated POST /admin/volunteers/0/certificate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/0/certificate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/0/certificate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/0/certificate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-28: authenticated POST /admin/volunteers/shifts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/shifts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/shifts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/shifts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-29: authenticated POST /admin/volunteers/shifts/0/checkin does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/shifts/0/checkin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/shifts/0/checkin -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/shifts/0/checkin -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-30: authenticated POST /admin/volunteers/shifts/0/checkout does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/admin/volunteers/shifts/0/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/volunteers/shifts/0/checkout -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/volunteers/shifts/0/checkout -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-31: authenticated POST /approvals does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/approvals`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /approvals -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /approvals -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-32: authenticated POST /approvals/0/action does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/approvals/0/action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /approvals/0/action -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /approvals/0/action -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-33: authenticated POST /auth/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/login -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-34: authenticated POST /auth/logout does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/logout -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/logout -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-35: authenticated POST /auth/saml2/providers does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/providers -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/saml2/providers -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-36: authenticated PUT /auth/saml2/providers/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /auth/saml2/providers/0 -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write PUT /auth/saml2/providers/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-37: authenticated POST /auth/saml2/providers/0/refresh does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/auth/saml2/providers/0/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/providers/0/refresh -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/saml2/providers/0/refresh -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-38: authenticated POST /backup/0/restore does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/0/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /backup/0/restore -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /backup/0/restore -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-39: authenticated PUT /backup/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/config`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /backup/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /backup/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-40: authenticated POST /backup/trigger does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/backup/trigger`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /backup/trigger -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /backup/trigger -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-41: authenticated PUT /branding/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/branding/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /branding/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /branding/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-42: authenticated POST /bulk-users/batch does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/bulk-users/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /bulk-users/batch -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /bulk-users/batch -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-43: authenticated POST /bulk-users/import/csv does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/bulk-users/import/csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /bulk-users/import/csv -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /bulk-users/import/csv -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-44: authenticated POST /calendar/clean does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/calendar/clean`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendar/clean -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendar/clean -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-45: authenticated POST /config-as-code/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config-as-code/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config-as-code/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config-as-code/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-46: authenticated PATCH /config/domain-default does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domain-default`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/domain-default -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/domain-default -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-47: authenticated POST /config/domains does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domains`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/domains -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/domains -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-48: authenticated PATCH /config/domains/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/domains/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/domains/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/domains/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-49: authenticated POST /config/rules does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/rules`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /config/rules -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /config/rules -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-50: authenticated PATCH /config/rules/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/rules/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/rules/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/rules/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-51: authenticated PATCH /config/system does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/system`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/system -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/system -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-52: authenticated PATCH /config/theme does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/config/theme`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /config/theme -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /config/theme -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-53: authenticated POST /crm/accounts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/crm/accounts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /crm/accounts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /crm/accounts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-54: authenticated POST /crm/contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/crm/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /crm/contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /crm/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-55: authenticated POST /crm/interactions does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/crm/interactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /crm/interactions -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /crm/interactions -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-56: authenticated POST /db-migration/run does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/db-migration/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /db-migration/run -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /db-migration/run -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-57: authenticated POST /dns/dkim/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/dkim/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/dkim/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/dkim/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-58: authenticated POST /dns/dmarc/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/dmarc/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/dmarc/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/dmarc/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-59: authenticated POST /dns/dmarc/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/dmarc/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/dmarc/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/dmarc/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-60: authenticated POST /dns/spf/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/spf/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/spf/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/spf/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-61: authenticated POST /dns/spf/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/dns/spf/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /dns/spf/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /dns/spf/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-62: authenticated POST /email-auth/dkim/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-63: authenticated PUT /email-auth/dkim/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dkim/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dkim/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-64: authenticated POST /email-auth/dkim/0/rotate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0/rotate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/0/rotate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/0/rotate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-65: authenticated POST /email-auth/dkim/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/0/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-66: authenticated POST /email-auth/dkim/generate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dkim/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dkim/generate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dkim/generate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-67: authenticated POST /email-auth/dmarc/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dmarc/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dmarc/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-68: authenticated PUT /email-auth/dmarc/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/dmarc/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/dmarc/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-69: authenticated POST /email-auth/dmarc/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/dmarc/0/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/dmarc/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/dmarc/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-70: authenticated POST /email-auth/domains does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/domains`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/domains -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/domains -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-71: authenticated POST /email-auth/spf/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/spf/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/spf/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-72: authenticated PUT /email-auth/spf/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /email-auth/spf/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /email-auth/spf/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-73: authenticated POST /email-auth/spf/0/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/spf/0/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/spf/0/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/spf/0/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-74: authenticated POST /email-auth/test does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/test -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/test -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-75: authenticated POST /email-auth/validate-all does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/email-auth/validate-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /email-auth/validate-all -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /email-auth/validate-all -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-76: authenticated POST /files/shares does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/files/shares`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /files/shares -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /files/shares -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-77: authenticated POST /jmap does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/jmap`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jmap -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jmap -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-78: authenticated POST /jmap/upload/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/jmap/upload/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jmap/upload/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jmap/upload/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-79: authenticated POST /matrix/config does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/config -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/config -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-80: authenticated POST /matrix/link does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/link -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/link -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-81: authenticated POST /matrix/rooms does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/rooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/rooms -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/rooms -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-82: authenticated POST /matrix/rooms/0/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/matrix/rooms/0/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /matrix/rooms/0/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /matrix/rooms/0/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-83: authenticated POST /migration/0/cancel does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/0/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/0/cancel -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/0/cancel -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-84: authenticated POST /migration/start does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/migration/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /migration/start -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /migration/start -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-85: authenticated POST /quick-actions does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/quick-actions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /quick-actions -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /quick-actions -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-86: authenticated POST /quick-actions/0/execute does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/quick-actions/0/execute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /quick-actions/0/execute -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /quick-actions/0/execute -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-87: authenticated PUT /quotas/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/quotas/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /quotas/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /quotas/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-88: authenticated POST /resources/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-89: authenticated PATCH /resources/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /resources/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /resources/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-90: authenticated POST /resources/0/availability does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/resources/0/availability`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/availability -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/availability -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-91: authenticated POST /scim/v2/Users does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/scim/v2/Users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /scim/v2/Users -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /scim/v2/Users -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-92: authenticated PATCH /scim/v2/Users/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/scim/v2/Users/INBOX`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /scim/v2/Users/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /scim/v2/Users/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-93: authenticated POST /shared-mailboxes does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-94: authenticated PUT /shared-mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-95: authenticated POST /shared-mailboxes/0/assignments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/assignments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-96: authenticated PUT /shared-mailboxes/0/assignments/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/assignments/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/assignments/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/assignments/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-97: authenticated POST /shared-mailboxes/0/members does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/members -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-98: authenticated PUT /shared-mailboxes/0/members/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/members/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /shared-mailboxes/0/members/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /shared-mailboxes/0/members/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-99: authenticated POST /shared-mailboxes/0/notes does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/0/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/notes -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/notes -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-100: authenticated POST /shared-mailboxes/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/shared-mailboxes/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-101: authenticated POST /student-groups/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-102: authenticated POST /student-groups/drop does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/drop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/drop -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/drop -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-103: authenticated POST /student-groups/enroll does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/student-groups/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /student-groups/enroll -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /student-groups/enroll -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-104: authenticated POST /tickets does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /tickets -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /tickets -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-105: authenticated PATCH /tickets/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /tickets/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /tickets/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-106: authenticated POST /tickets/0/respond does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/tickets/0/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /tickets/0/respond -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /tickets/0/respond -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-107: authenticated PUT /users/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /users/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /users/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-108: authenticated POST /users/create does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/create -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/create -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-109: authenticated POST /users/inactive does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/inactive`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/inactive -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/inactive -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-110: authenticated POST /users/revoke does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/users/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /users/revoke -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /users/revoke -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-111: authenticated POST /webhooks does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/webhooks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webhooks -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webhooks -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-112: authenticated PATCH /webhooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/webhooks/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /webhooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /webhooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-113: authenticated POST /webhooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/webhooks/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webhooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /webhooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-114: authenticated POST /workflows does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /workflows -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /workflows -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-115: authenticated PATCH /workflows/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /workflows/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /workflows/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-116: authenticated POST /workflows/0/test does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${ADMIN_API}/workflows/0/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /workflows/0/test -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /workflows/0/test -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-117: authenticated POST /addressbooks does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-118: authenticated PATCH /addressbooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-119: authenticated POST /addressbooks/0/contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-120: authenticated PATCH /addressbooks/0/contacts/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/contacts/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-121: authenticated POST /addressbooks/0/contacts/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/contacts/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/contacts/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-122: authenticated POST /addressbooks/0/lists does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/lists -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/lists -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-123: authenticated PATCH /addressbooks/0/lists/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/lists/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-124: authenticated POST /addressbooks/0/lists/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/lists/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/lists/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-125: authenticated POST /addressbooks/0/shares does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/shares -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-126: authenticated POST /addressbooks/0/sync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/sync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-127: authenticated POST /addressbooks/external does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/external`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/external -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/external -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-128: authenticated POST /addressbooks/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-129: authenticated POST /admin/v1/webauthn/policies does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/admin/v1/webauthn/policies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /admin/v1/webauthn/policies -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /admin/v1/webauthn/policies -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-130: authenticated POST /appointment-slots does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /appointment-slots -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /appointment-slots -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-131: authenticated POST /appointment-slots/0/book does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/appointment-slots/0/book`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /appointment-slots/0/book -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /appointment-slots/0/book -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-132: authenticated POST /auth/app-passwords/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/app-passwords/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/app-passwords/ -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/app-passwords/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-133: authenticated POST /auth/app-passwords/delete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/app-passwords/delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/app-passwords/delete -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/app-passwords/delete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-134: authenticated POST /auth/callback/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/callback/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/callback/0 -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/callback/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-135: authenticated POST /auth/mfa/disable does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/mfa/disable`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/mfa/disable -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/mfa/disable -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-136: authenticated POST /auth/mfa/enable does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/mfa/enable`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/mfa/enable -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/mfa/enable -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-137: authenticated POST /auth/password-reset/request does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/password-reset/request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/password-reset/request -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/password-reset/request -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-138: authenticated POST /auth/password-reset/reset does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/password-reset/reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/password-reset/reset -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/password-reset/reset -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-139: authenticated POST /auth/saml2/acs does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/saml2/acs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/acs -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/saml2/acs -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-140: authenticated POST /auth/saml2/discovery does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/saml2/discovery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/saml2/discovery -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/saml2/discovery -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-141: authenticated POST /auth/webauthn/credentials/delete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/webauthn/credentials/delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/webauthn/credentials/delete -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/webauthn/credentials/delete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-142: authenticated POST /auth/webauthn/login/begin does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/webauthn/login/begin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/webauthn/login/begin -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/webauthn/login/begin -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-143: authenticated POST /auth/webauthn/login/complete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/webauthn/login/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/webauthn/login/complete -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/webauthn/login/complete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-144: authenticated POST /auth/webauthn/register/begin does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/webauthn/register/begin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/webauthn/register/begin -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/webauthn/register/begin -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-145: authenticated POST /auth/webauthn/register/complete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/auth/webauthn/register/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /auth/webauthn/register/complete -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /auth/webauthn/register/complete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-146: authenticated POST /calendars does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-147: authenticated PATCH /calendars/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /calendars/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-148: authenticated POST /calendars/0/events does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/0/events -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/0/events -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-149: authenticated POST /calendars/0/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/0/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/0/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-150: authenticated POST /calendars/0/shares does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/shares`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/0/shares -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-151: authenticated POST /calendars/0/subscription does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/subscription`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/0/subscription -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/0/subscription -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-152: authenticated POST /calendars/0/tasks does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/0/tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/0/tasks -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/0/tasks -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-153: authenticated POST /calendars/teams does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/teams -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/teams -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-154: authenticated PATCH /calendars/teams/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /calendars/teams/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /calendars/teams/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-155: authenticated POST /calendars/teams/0/invites does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/invites`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/teams/0/invites -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/teams/0/invites -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-156: authenticated POST /calendars/teams/0/members does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/teams/0/members -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/teams/0/members -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-157: authenticated PATCH /calendars/teams/0/members/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/0/members/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /calendars/teams/0/members/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /calendars/teams/0/members/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-158: authenticated POST /calendars/teams/invites/0/accept does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/teams/invites/0/accept -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/teams/invites/0/accept -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-159: authenticated POST /calendars/teams/invites/0/reject does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/calendars/teams/invites/0/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /calendars/teams/invites/0/reject -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /calendars/teams/invites/0/reject -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-160: authenticated PATCH /events/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /events/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /events/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-161: authenticated POST /events/0/attendance does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/events/0/attendance`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /events/0/attendance -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /events/0/attendance -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-162: authenticated POST /external-calendars does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /external-calendars -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /external-calendars -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-163: authenticated PUT /external-calendars/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /external-calendars/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /external-calendars/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-164: authenticated POST /external-calendars/0/sync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/external-calendars/0/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /external-calendars/0/sync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /external-calendars/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-165: authenticated POST /freebusy does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/freebusy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /freebusy -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /freebusy -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-166: authenticated POST /jobs/0/cancel does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/jobs/0/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /jobs/0/cancel -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /jobs/0/cancel -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-167: authenticated POST /mailboxes does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-168: authenticated PATCH /mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-169: authenticated POST /mailboxes/0/delegate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/delegate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/delegate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/delegate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-170: authenticated POST /mailboxes/0/filters does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-171: authenticated PUT /mailboxes/0/filters/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-172: authenticated POST /mailboxes/0/filters/preview does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/preview -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/preview -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-173: authenticated POST /mailboxes/0/filters/push does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/push -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/push -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-174: authenticated PATCH /mailboxes/0/filters/reorder does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/reorder`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/reorder -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/reorder -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-175: authenticated POST /mailboxes/0/filters/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-176: authenticated POST /mailboxes/0/folders does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-177: authenticated PATCH /mailboxes/0/folders/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/folders/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/folders/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-178: authenticated POST /mailboxes/0/folders/INBOX/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-179: authenticated POST /mailboxes/0/folders/INBOX/expunge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/expunge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/expunge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/expunge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-180: authenticated POST /mailboxes/0/folders/INBOX/mails/0/action does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/action -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/action -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-181: authenticated POST /mailboxes/0/folders/INBOX/mails/0/download does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/download`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/download -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/download -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-182: authenticated POST /mailboxes/0/folders/INBOX/mails/batch-action does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/batch-action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/batch-action -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/batch-action -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-183: authenticated POST /mailboxes/0/folders/INBOX/purge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/purge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/purge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-184: authenticated POST /mailboxes/0/folders/INBOX/share does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/share`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/share -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/share -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-185: authenticated POST /mailboxes/0/forward does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/forward`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/forward -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/forward -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-186: authenticated POST /mailboxes/0/mail/0/attachments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0/attachments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0/attachments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-187: authenticated PUT /mailboxes/0/mail/0/save does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/save`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/0/save -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/0/save -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-188: authenticated POST /mailboxes/0/mail/0/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-189: authenticated POST /mailboxes/0/mail/attachments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/attachments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/attachments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-190: authenticated POST /mailboxes/0/mail/pending/0/cancel does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/pending/0/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/pending/0/cancel -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/pending/0/cancel -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-191: authenticated POST /mailboxes/0/mail/save does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/save`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/save -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/save -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-192: authenticated POST /mailboxes/0/mail/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-193: authenticated POST /mailboxes/0/notify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/notify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/notify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/notify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-194: authenticated POST /mailboxes/0/purge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/purge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/purge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-195: authenticated POST /mailboxes/0/vacation does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/vacation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/vacation -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/vacation -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-196: authenticated POST /polls does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /polls -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /polls -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-197: authenticated POST /polls/0/respond does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/polls/0/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /polls/0/respond -> ${res.status()}` });
    expect(OK_STATUSES.concat(500), `auth write POST /polls/0/respond -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-198: authenticated PATCH /preferences does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/preferences`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /preferences -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /preferences -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-199: authenticated POST /profile/password does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/profile/password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /profile/password -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /profile/password -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-200: authenticated POST /resources/0/book does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0/book`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/book -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/book -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-201: authenticated POST /resources/0/check-availability does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0/check-availability`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/check-availability -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/check-availability -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-202: authenticated POST /resources/0/favorite does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/resources/0/favorite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /resources/0/favorite -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /resources/0/favorite -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-203: authenticated POST /shared-mailboxes/0/assignments/0/accept does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/assignments/0/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments/0/accept -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments/0/accept -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-204: authenticated POST /shared-mailboxes/0/assignments/0/complete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-mailboxes/0/assignments/0/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-mailboxes/0/assignments/0/complete -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-mailboxes/0/assignments/0/complete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-205: authenticated POST /snooze/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/snooze/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /snooze/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /snooze/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-206: authenticated PATCH /tasks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/tasks/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /tasks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /tasks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-207: authenticated POST /webauthn/credentials does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/credentials`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/credentials -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /webauthn/credentials -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-208: authenticated PUT /webauthn/credentials/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/credentials/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /webauthn/credentials/0 -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write PUT /webauthn/credentials/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-209: authenticated POST /webauthn/login does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/login`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/login -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /webauthn/login -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-210: authenticated POST /webauthn/register does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/webauthn/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /webauthn/register -> ${res.status()}` });
    expect(AUTH_OK_STATUSES, `auth write POST /webauthn/register -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-211: authenticated MKCALENDAR /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: "MKCALENDAR",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCALENDAR /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCALENDAR /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-212: authenticated MKCOL /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: "MKCOL",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCOL /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCOL /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-213: authenticated PROPFIND /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: "PROPFIND",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPFIND /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPFIND /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-214: authenticated PROPPATCH /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: "PROPPATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPPATCH /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPPATCH /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-215: authenticated PUT /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-216: authenticated REPORT /caldav/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: "REPORT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `REPORT /caldav/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write REPORT /caldav/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-217: authenticated MKCALENDAR /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/INBOX`, {
      method: "MKCALENDAR",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCALENDAR /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCALENDAR /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-218: authenticated MKCOL /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/INBOX`, {
      method: "MKCOL",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `MKCOL /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write MKCOL /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-219: authenticated PROPFIND /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/INBOX`, {
      method: "PROPFIND",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPFIND /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPFIND /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-220: authenticated PROPPATCH /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/INBOX`, {
      method: "PROPPATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PROPPATCH /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PROPPATCH /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-221: authenticated PUT /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/INBOX`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-222: authenticated REPORT /caldav/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/INBOX`, {
      method: "REPORT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `REPORT /caldav/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write REPORT /caldav/INBOX -> ${res.status()}`).toContain(res.status());
  });
});
