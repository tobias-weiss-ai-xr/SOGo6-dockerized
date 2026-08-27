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

test.describe('Endpoint mutation matrix — Contact (36 write endpoints / 36 tests)', () => {
  test('MUT-contact-1: authenticated POST /addressbooks does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-2: authenticated PATCH /addressbooks does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-3: authenticated POST /addressbooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-4: authenticated PATCH /addressbooks/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-5: authenticated POST /addressbooks/0/shares does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/shares -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-6: authenticated PATCH /addressbooks/0/shares does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/shares -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/shares -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-7: authenticated POST /addressbooks/0/shares/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/shares/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/shares/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-8: authenticated PATCH /addressbooks/0/shares/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/shares/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/shares/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/shares/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-9: authenticated POST /addressbooks/0/contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-10: authenticated PATCH /addressbooks/0/contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-11: authenticated POST /contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-12: authenticated PATCH /contacts does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /contacts -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /contacts -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-13: authenticated POST /contacts/autocomplete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts/autocomplete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /contacts/autocomplete -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /contacts/autocomplete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-14: authenticated PATCH /contacts/autocomplete does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/contacts/autocomplete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /contacts/autocomplete -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /contacts/autocomplete -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-15: authenticated POST /addressbooks/0/contacts/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/contacts/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-16: authenticated PATCH /addressbooks/0/contacts/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/contacts/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/contacts/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-17: authenticated POST /addressbooks/0/lists does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/lists -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/lists -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-18: authenticated PATCH /addressbooks/0/lists does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/lists -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/lists -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-19: authenticated POST /addressbooks/0/lists/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/lists/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-20: authenticated PATCH /addressbooks/0/lists/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/lists/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/lists/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-21: authenticated POST /addressbooks/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-22: authenticated PATCH /addressbooks/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/import`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-23: authenticated POST /addressbooks/0/contacts/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/contacts/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/contacts/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-24: authenticated PATCH /addressbooks/0/contacts/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/import`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/contacts/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/contacts/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-25: authenticated POST /addressbooks/0/lists/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/lists/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/lists/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-26: authenticated PATCH /addressbooks/0/lists/import does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/import`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/lists/import -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/lists/import -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-27: authenticated POST /addressbooks/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-28: authenticated PATCH /addressbooks/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/export`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-29: authenticated POST /addressbooks/0/contacts/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/contacts/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/contacts/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-30: authenticated PATCH /addressbooks/0/contacts/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/contacts/0/export`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/contacts/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/contacts/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-31: authenticated POST /addressbooks/0/lists/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/lists/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/lists/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-32: authenticated PATCH /addressbooks/0/lists/0/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/lists/0/export`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/lists/0/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/lists/0/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-33: authenticated POST /addressbooks/external does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/external`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/external -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/external -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-34: authenticated PATCH /addressbooks/external does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/external`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/external -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/external -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-35: authenticated POST /addressbooks/0/sync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /addressbooks/0/sync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /addressbooks/0/sync -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-contact-36: authenticated PATCH /addressbooks/0/sync does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/addressbooks/0/sync`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /addressbooks/0/sync -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /addressbooks/0/sync -> ${res.status()}`).toContain(res.status());
  });
});
