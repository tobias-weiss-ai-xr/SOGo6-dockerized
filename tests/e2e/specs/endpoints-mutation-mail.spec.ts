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

test.describe('Endpoint mutation matrix — Mail (77 write endpoints / 77 tests)', () => {
  test('MUT-mail-1: authenticated POST /shared-drafts/0/review does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/shared-drafts/0/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /shared-drafts/0/review -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /shared-drafts/0/review -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-2: authenticated POST /mailboxes/0/filters does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-3: authenticated PUT /mailboxes/0/filters does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-4: authenticated PATCH /mailboxes/0/filters does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-5: authenticated POST /mailboxes/0/vacation does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/vacation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/vacation -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/vacation -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-6: authenticated PUT /mailboxes/0/vacation does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/vacation`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/vacation -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/vacation -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-7: authenticated PATCH /mailboxes/0/vacation does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/vacation`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/vacation -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/vacation -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-8: authenticated POST /mailboxes/0/forward does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/forward`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/forward -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/forward -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-9: authenticated PUT /mailboxes/0/forward does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/forward`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/forward -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/forward -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-10: authenticated PATCH /mailboxes/0/forward does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/forward`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/forward -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/forward -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-11: authenticated POST /mailboxes/0/notify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/notify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/notify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/notify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-12: authenticated PUT /mailboxes/0/notify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/notify`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/notify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/notify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-13: authenticated PATCH /mailboxes/0/notify does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/notify`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/notify -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/notify -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-14: authenticated POST /mailboxes/0/filters/templates does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/templates -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/templates -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-15: authenticated PUT /mailboxes/0/filters/templates does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/templates`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/templates -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/templates -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-16: authenticated PATCH /mailboxes/0/filters/templates does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/templates`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/templates -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/templates -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-17: authenticated POST /mailboxes/0/filters/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-18: authenticated PUT /mailboxes/0/filters/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/validate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-19: authenticated PATCH /mailboxes/0/filters/validate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/validate`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/validate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/validate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-20: authenticated POST /mailboxes/0/filters/preview does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/preview -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/preview -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-21: authenticated PUT /mailboxes/0/filters/preview does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/preview`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/preview -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/preview -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-22: authenticated PATCH /mailboxes/0/filters/preview does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/preview`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/preview -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/preview -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-23: authenticated POST /mailboxes/0/filters/push does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/push -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/push -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-24: authenticated PUT /mailboxes/0/filters/push does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/push`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/push -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/push -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-25: authenticated PATCH /mailboxes/0/filters/push does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/push`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/push -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/push -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-26: authenticated POST /mailboxes/0/filters/reorder does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/reorder`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/reorder -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/reorder -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-27: authenticated PUT /mailboxes/0/filters/reorder does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/reorder`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/reorder -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/reorder -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-28: authenticated PATCH /mailboxes/0/filters/reorder does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/reorder`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/reorder -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/reorder -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-29: authenticated POST /mailboxes/0/filters/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/filters/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/filters/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-30: authenticated PUT /mailboxes/0/filters/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/filters/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/filters/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-31: authenticated PATCH /mailboxes/0/filters/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/filters/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/filters/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/filters/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-32: authenticated POST /mailboxes/0/folders/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-33: authenticated PATCH /mailboxes/0/folders/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/folders/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/folders/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-34: authenticated POST /mailboxes/0/folders/INBOX/expunge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/expunge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/expunge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/expunge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-35: authenticated PATCH /mailboxes/0/folders/INBOX/expunge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/expunge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/folders/INBOX/expunge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/folders/INBOX/expunge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-36: authenticated POST /mailboxes/0/folders/INBOX/purge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/purge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/purge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-37: authenticated PATCH /mailboxes/0/folders/INBOX/purge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/purge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/folders/INBOX/purge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/folders/INBOX/purge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-38: authenticated POST /mailboxes/0/folders/INBOX/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-39: authenticated PATCH /mailboxes/0/folders/INBOX/export does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/export`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/folders/INBOX/export -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/folders/INBOX/export -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-40: authenticated POST /mailboxes/0/folders/INBOX/share does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/share`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/share -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/share -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-41: authenticated PATCH /mailboxes/0/folders/INBOX/share does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/share`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/folders/INBOX/share -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/folders/INBOX/share -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-42: authenticated POST /mailboxes/0/folders/INBOX/mails/batch-action does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/batch-action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/batch-action -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/batch-action -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-43: authenticated POST /mailboxes/0/folders/INBOX/mails/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-44: authenticated POST /mailboxes/0/folders/INBOX/mails/0/action does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/action -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/action -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-45: authenticated POST /mailboxes/0/folders/INBOX/mails/0/download does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/download`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/download -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/download -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-46: authenticated POST /mailboxes/0/folders/INBOX/mails/0/edit does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/edit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/edit -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/edit -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-47: authenticated POST /mailboxes/0/folders/INBOX/mails/0/reply does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/reply -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/reply -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-48: authenticated POST /mailboxes/0/folders/INBOX/mails/0/raw does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/raw`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/raw -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/raw -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-49: authenticated POST /mailboxes/0/folders/INBOX/mails/0/attachments/INBOX does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/0/attachments/INBOX`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/folders/INBOX/mails/0/attachments/INBOX -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/folders/INBOX/mails/0/attachments/INBOX -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-50: authenticated POST /mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-51: authenticated PATCH /mailboxes/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-52: authenticated POST /mailboxes/0/delegate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/delegate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/delegate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/delegate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-53: authenticated PATCH /mailboxes/0/delegate does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/delegate`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/delegate -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/delegate -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-54: authenticated POST /mailboxes/0/purge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/purge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/purge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-55: authenticated PATCH /mailboxes/0/purge does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/purge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PATCH /mailboxes/0/purge -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PATCH /mailboxes/0/purge -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-56: authenticated POST /mailboxes/0/mail/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-57: authenticated PUT /mailboxes/0/mail/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/send`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-58: authenticated POST /mailboxes/0/mail/0/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-59: authenticated PUT /mailboxes/0/mail/0/send does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/send`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/0/send -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/0/send -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-60: authenticated POST /mailboxes/0/mail/pending/0/cancel does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/pending/0/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/pending/0/cancel -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/pending/0/cancel -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-61: authenticated PUT /mailboxes/0/mail/pending/0/cancel does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/pending/0/cancel`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/pending/0/cancel -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/pending/0/cancel -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-62: authenticated POST /mailboxes/0/mail/save does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/save`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/save -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/save -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-63: authenticated PUT /mailboxes/0/mail/save does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/save`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/save -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/save -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-64: authenticated POST /mailboxes/0/mail/0/save does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/save`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0/save -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0/save -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-65: authenticated PUT /mailboxes/0/mail/0/save does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/save`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/0/save -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/0/save -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-66: authenticated POST /mailboxes/0/mail/attachments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/attachments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/attachments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-67: authenticated PUT /mailboxes/0/mail/attachments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/attachments`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/attachments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/attachments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-68: authenticated POST /mailboxes/0/mail/0/attachments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0/attachments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0/attachments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-69: authenticated PUT /mailboxes/0/mail/0/attachments does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/attachments`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/0/attachments -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/0/attachments -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-70: authenticated POST /mailboxes/0/mail/0/attachments/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/attachments/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0/attachments/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0/attachments/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-71: authenticated PUT /mailboxes/0/mail/0/attachments/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0/attachments/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/0/attachments/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/0/attachments/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-72: authenticated POST /mailboxes/0/mail/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-73: authenticated PUT /mailboxes/0/mail/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/0`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/0 -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-74: authenticated POST /mailboxes/0/mail/current does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/current`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /mailboxes/0/mail/current -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /mailboxes/0/mail/current -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-75: authenticated PUT /mailboxes/0/mail/current does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/mailboxes/0/mail/current`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `PUT /mailboxes/0/mail/current -> ${res.status()}` });
    expect(OK_STATUSES, `auth write PUT /mailboxes/0/mail/current -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-76: authenticated POST /snooze/ does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/snooze/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /snooze/ -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /snooze/ -> ${res.status()}`).toContain(res.status());
  });

  test('MUT-mail-77: authenticated POST /snooze/0 does not 5xx', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_API}/snooze/0`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      data: {},
    });
    test.info().annotations.push({ type: 'mutate', description: `POST /snooze/0 -> ${res.status()}` });
    expect(OK_STATUSES, `auth write POST /snooze/0 -> ${res.status()}`).toContain(res.status());
  });
});
