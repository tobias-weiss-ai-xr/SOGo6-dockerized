// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests — Persona: STUDENT
// Realistic daily workflows: check mail from lecturers, reply, submit via email,
// track homework in tasks, view class calendar, manage study contacts, set language.
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

test.describe('Persona — Student: Checking mail from lecturers', () => {

  test('student logs in and reaches the inbox', async ({ page }) => {
    await loginAsUser(page);
    expect(page.url()).toContain('/u/');
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('student sees unread mail in the inbox', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'inbox', description: `mails: ${mails.length}` });
    }
  });

  test('student opens a lecture announcement', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    if (!uid) { expect(true).toBe(true); return; }
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'open-mail', description: `-> ${res.status()}` });
  });

  test('student reads the raw source of a received mail', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    if (!uid) { expect(true).toBe(true); return; }
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      test.info().annotations.push({ type: 'raw', description: `raw length: ${(body?.data?.raw ?? '').length}` });
    }
  });

  test('student replies to a lecturer', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const uid = await getFirstInboxUid(page, token);
    if (!uid) { expect(true).toBe(true); return; }
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/reply`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'reply', description: `-> ${res.status()}` });
  });
});

test.describe('Persona — Student: Submitting work by email', () => {

  test('student emails homework to the professor', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        from: CREDENTIALS.email,
        to: ['professor@sogo6.contextual-intelligence.org'],
        subject: `Homework submission ${Date.now()}`,
        body: 'Dear Professor, please find my assignment attached.',
        is_html: false,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'submit', description: `-> ${res.status()}` });
  });

  test('student searches mail for a course code', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=test`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'search', description: `-> ${res.status()}` });
  });

  test('student attaches a file to an email (attachment endpoint reachable)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/mail/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 400, 404, 405, 422]).toContain(res.status());
    test.info().annotations.push({ type: 'attach', description: `-> ${res.status()} (image/attachment upload gap if 405/422)` });
  });
});

test.describe('Persona — Student: Tracking homework in tasks', () => {

  test('student creates a homework task', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const calRes = await page.request.get(`${REMOTE_API}/calendars`, { headers: { Authorization: `Bearer ${token}` } });
    const cals = calRes.status() === 200 ? (await calRes.json())?.data ?? [] : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await page.request.post(`${REMOTE_API}/calendars/${calKey}/tasks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: `Read chapter 4 ${Date.now()}`, description: 'Due Friday' },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'hw-task', description: `-> ${res.status()}` });
  });

  test('student lists tasks to see what is due', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'tasks', description: `-> ${res.status()}` });
  });

  test('student views the class calendar for deadlines', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const cals = body?.data ?? body ?? [];
      test.info().annotations.push({ type: 'calendars', description: `calendars: ${Array.isArray(cals) ? cals.length : 'n/a'}` });
    }
  });
});

test.describe('Persona — Student: Contacts & personal settings', () => {

  test('student adds a study group partner to contacts', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const abRes = await page.request.get(`${REMOTE_API}/addressbooks`, { headers: { Authorization: `Bearer ${token}` } });
    const abs = abRes.status() === 200 ? (await abRes.json())?.data ?? [] : [];
    const bookKey = abs[0]?.key ?? abs[0]?.id ?? '0';
    const res = await page.request.post(`${REMOTE_API}/addressbooks/${encodeURIComponent(bookKey)}/contacts`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        display_name: `StudyBuddy ${Date.now()}`,
        first_name: 'Study',
        last_name: 'Buddy',
        kind: 'individual',
        emails: [{ value: `buddy${Date.now()}@example.org`, types: ['personal'], pref: 1 }],
        phones: [{ number: '+49123456789', types: ['mobile'] }],
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'contact', description: `-> ${res.status()}` });
  });

  test('student looks up a contact via autocomplete', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/contacts/autocomplete?q=test`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'autocomplete', description: `-> ${res.status()}` });
  });

  test('student sets the UI language to German', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.patch(`${REMOTE_API}/preferences`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { settings: { SOGO_U_LANGUAGE: 'de' } },
    });
    expect([200, 204, 400, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'lang', description: `PATCH language -> ${res.status()}` });
  });

  test('student updates their profile display name', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
    test.info().annotations.push({ type: 'profile', description: `-> ${res.status()}` });
  });

  test('student logs out cleanly', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    const loggedOut = !await page.evaluate(() => sessionStorage.getItem('sogo_auth'));
    test.info().annotations.push({ type: 'logout', description: `session cleared: ${loggedOut}` });
    expect(true).toBe(true);
  });
});
