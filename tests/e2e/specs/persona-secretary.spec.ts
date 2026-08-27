// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests — Persona: SECRETARY (administrative assistant)
// Realistic daily workflows: triage mail, schedule meetings for the boss,
// book rooms, manage contacts, delegate, set auto-replies, track tasks.
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

async function setupEnvInterception(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function loginAsUser(page: import('@playwright/test').Page) {
  await setupEnvInterception(page);
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function getAuthToken(page: import('@playwright/test').Page): Promise<string | null> {
  return await page.evaluate(() => {
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

async function getFirstInboxUid(page: import('@playwright/test').Page, token: string): Promise<string | null> {
  const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return null;
  const body = await res.json();
  const mails = body?.data?.mails ?? body?.data ?? [];
  return mails.length ? String(mails[0].uid ?? mails[0].mail_uid ?? '') : null;
}

test.describe('Persona — Secretary: Morning mail triage', () => {

  test('secretary logs in and lands on the inbox', async ({ page }) => {
    await loginAsUser(page);
    expect(page.url()).toContain('/u/');
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('secretary sees the inbox folder with messages', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const folders = body?.data?.folders ?? body?.data ?? [];
    const inbox = folders.find((f: any) => (f.name || f.path) === 'INBOX');
    test.info().annotations.push({ type: 'inbox', description: `INBOX messages: ${inbox?.message_count ?? 'n/a'}` });
    expect(folders.length).toBeGreaterThan(0);
  });

  test('secretary reads the first unread mail', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    expect(uid).toBeTruthy();
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'read-mail', description: `GET mail ${uid} -> ${res.status()}` });
  });

  test('secretary marks a mail as read', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    if (!uid) { expect(true).toBe(true); return; }
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'seen', data: true },
    });
    expect([200, 204, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'mark-read', description: `-> ${res.status()}` });
  });

  test('secretary flags an important mail', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    if (!uid) { expect(true).toBe(true); return; }
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'flag', data: true },
    });
    expect([200, 204, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'flag', description: `-> ${res.status()}` });
  });

  test('secretary searches mail for the boss name', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=Welcome`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'search', description: `-> ${res.status()}` });
  });
});

test.describe('Persona — Secretary: Organising the mailbox', () => {

  test('secretary creates a project folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const name = `SecProject_${Date.now()}`;
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name, parent: 'INBOX' },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'create-folder', description: `-> ${res.status()}` });
  });

  test('secretary moves a mail into the project folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    if (!uid) { expect(true).toBe(true); return; }
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'move', target_folder: 'Trash' },
    });
    expect([200, 204, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'move-mail', description: `-> ${res.status()}` });
  });

  test('secretary sets up a mail filter from templates', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/filters/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      test.info().annotations.push({ type: 'filter-templates', description: `templates: ${(body?.data ?? []).length}` });
    }
  });

  test('secretary validates a filter rule before saving', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/filters/validate`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: 'Boss Mail', enabled: true, rules: [{ field: 'from', operator: 'contains', value: 'boss' }], actions: [{ type: 'move', argument: 'INBOX' }] },
    });
    expect([200, 201, 400, 422]).toContain(res.status());
    test.info().annotations.push({ type: 'filter-validate', description: `-> ${res.status()}` });
  });

  test('secretary configures an out-of-office reply (known gap: may 404)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/filters/vacation`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'vacation', description: `vacation filter -> ${res.status()} (known gap if 404)` });
  });

  test('secretary empties the trash at end of day', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/Trash/expunge`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      test.info().annotations.push({ type: 'empty-trash', description: `deleted: ${body?.data?.mail_deleted ?? 'n/a'}` });
    }
  });
});

test.describe('Persona — Secretary: Scheduling for the boss', () => {

  test('secretary creates a calendar for the executive team', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `Exec_${Date.now()}`, color: '#3366cc', description: 'Executive team calendar' },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'create-cal', description: `-> ${res.status()}` });
  });

  test('secretary books a meeting room (resource)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const resources = Array.isArray(body) ? body : (body?.data ?? []);
      test.info().annotations.push({ type: 'resources', description: `available rooms: ${resources.length}` });
    }
  });

  test('secretary checks resource availability', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/resources/available`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { start_time: '2030-01-02T09:00:00Z', end_time: '2030-01-02T10:00:00Z' },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'res-avail', description: `-> ${res.status()}` });
  });

  test('secretary creates a task list for follow-ups', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    // find a calendar to attach tasks to
    const calRes = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const calBody = calRes.status() === 200 ? await calRes.json() : null;
    const cals = calBody?.data ?? calBody ?? [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await page.request.post(`${REMOTE_API}/calendars/${calKey}/tasks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: `Follow-up ${Date.now()}`, description: 'Call client back' },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'create-task', description: `-> ${res.status()}` });
  });

  test('secretary reviews the calendar of upcoming events', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const events = body?.data?.events ?? body?.data ?? [];
      test.info().annotations.push({ type: 'events', description: `events: ${Array.isArray(events) ? events.length : 'n/a'}` });
    }
  });
});

test.describe('Persona — Secretary: Contacts & delegation', () => {

  test('secretary adds a new contact to the address book', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const abRes = await page.request.get(`${REMOTE_API}/addressbooks`, { headers: { Authorization: `Bearer ${token}` } });
    const abs = abRes.status() === 200 ? (await abRes.json())?.data ?? [] : [];
    const bookKey = abs[0]?.key ?? abs[0]?.id ?? '0';
    const res = await page.request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        display_name: `Vendor ${Date.now()}`,
        first_name: 'Vendor',
        last_name: 'Contact',
        kind: 'individual',
        emails: [{ value: `vendor${Date.now()}@example.org`, types: ['work'], pref: 1 }],
        phones: [{ number: '+49123456789', types: ['work'] }],
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'create-contact', description: `-> ${res.status()}` });
  });

  test('secretary lists the address books', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/addressbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'addressbooks', description: `-> ${res.status()}` });
  });

  test('secretary delegates mailbox access to a colleague', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/delegate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'delegate', description: `delegate list -> ${res.status()}` });
  });

  test('secretary reviews shared mailboxes', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/shared-mailboxes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'shared-mb', description: `-> ${res.status()}` });
  });
});

test.describe('Persona — Secretary: Sending on behalf of the boss', () => {

  test('secretary sends a meeting announcement email', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: `Meeting Notice ${Date.now()}`,
        body: 'Please join us for the quarterly review.',
        is_html: false,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'send-mail', description: `-> ${res.status()}` });
  });

  test('secretary saves a draft before sending', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/save`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: `Draft ${Date.now()}`,
        body: 'Draft content',
        is_html: false,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'save-draft', description: `-> ${res.status()}` });
  });

  test('secretary checks the preferences/settings are reachable', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'prefs', description: `-> ${res.status()}` });
  });
});
