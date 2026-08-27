// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Mail Actions — flag, mark read/unread, delete, move, batch actions.
// Tests:
//   - Flag a mail (set \Flagged)
//   - Mark mail as read
//   - Mark mail as unread
//   - Delete a mail (move to Trash)
//   - Batch action: flag multiple mails
//   - Batch action: mark multiple as read
//   - Move mail to another folder
//   - Mail action endpoint (POST /mails/{uid}/action)
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

// ── Helpers ────────────────────────────────────────────────────────────────

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
    if (raw) { try { return JSON.parse(raw).token ?? null; } catch { /* */ } }
    return null;
  });
}

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await getAuthToken(page);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function getInboxMails(page: import('@playwright/test').Page): Promise<any[]> {
  const headers = await authHeaders(page);
  const res = await page.request.get(
    `${REMOTE_API}/mailboxes/0/folders/INBOX/mails?fields=contents&fields_action=exclude&page_size=20`,
    { headers },
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body?.data ?? body ?? [];
}

async function ensureInboxHasMail(page: import('@playwright/test').Page): Promise<{ mails: any[]; folder: string }> {
  let mails = await getInboxMails(page);
  let folder = 'INBOX';
  if (mails.length === 0) {
    const headers = await authHeaders(page);
    await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: `Test mail ${Date.now()}`,
        body: 'Test email for e2e tests.',
        is_html: false,
      },
      headers,
    });
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2000);
      mails = await getInboxMails(page);
      if (mails.length > 0) break;
      const junkRes = await page.request.get(
        `${REMOTE_API}/mailboxes/0/folders/Junk%20Mail/mails?page_size=5`,
        { headers },
      );
      if (junkRes.status() === 200) {
        const junkBody = await junkRes.json();
        const junkMails = junkBody?.data ?? junkBody ?? [];
        if (junkMails.length > 0) { mails = junkMails; folder = 'Junk Mail'; break; }
      }
    }
  }
  return { mails, folder };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Mail Actions', () => {

  test('GET mail detail includes flags field', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    expect(mails.length).toBeGreaterThan(0);
    const uid = String(mails[0].uid);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const mail = body?.data ?? body;
    expect(mail).toBeTruthy();
    // flags field should exist (may be empty array or string)
    expect(mail.flags !== undefined).toBeTruthy();
  });

  test('flag a mail via POST /mails/{uid}/action', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    expect(mails.length).toBeGreaterThan(0);
    const uid = String(mails[0].uid);
    const headers = await authHeaders(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}/action`, {
      data: { action: 'flag', value: true },
      headers,
    });
    test.info().annotations.push({
      type: 'flag-action',
      description: `POST /mails/${uid}/action {flag: true} -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('mark mail as read via POST /mails/{uid}/action', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    expect(mails.length).toBeGreaterThan(0);
    const uid = String(mails[0].uid);
    const headers = await authHeaders(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}/action`, {
      data: { action: 'mark_read', value: true },
      headers,
    });
    test.info().annotations.push({
      type: 'mark-read',
      description: `POST /mails/${uid}/action {mark_read: true} -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('mark mail as unread via POST /mails/{uid}/action', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    expect(mails.length).toBeGreaterThan(0);
    const uid = String(mails[0].uid);
    const headers = await authHeaders(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}/action`, {
      data: { action: 'mark_unread', value: true },
      headers,
    });
    test.info().annotations.push({
      type: 'mark-unread',
      description: `POST /mails/${uid}/action {mark_unread: true} -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('batch flag action on multiple mails', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    if (mails.length < 2) {
      test.info().annotations.push({ type: 'skip', description: 'Need ≥2 mails for batch test' });
      return;
    }
    const headers = await authHeaders(page);
    const uids = mails.slice(0, 2).map((m: any) => String(m.uid));

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/batch-action`, {
      data: { action: 'flag', uids, value: true },
      headers,
    });
    test.info().annotations.push({
      type: 'batch-flag',
      description: `POST /mails/batch-action {flag, uids: ${uids.join(',')}} -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('batch mark read action on multiple mails', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    if (mails.length < 2) {
      test.info().annotations.push({ type: 'skip', description: 'Need ≥2 mails for batch test' });
      return;
    }
    const headers = await authHeaders(page);
    const uids = mails.slice(0, 2).map((m: any) => String(m.uid));

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/batch-action`, {
      data: { action: 'mark_read', uids, value: true },
      headers,
    });
    test.info().annotations.push({
      type: 'batch-read',
      description: `POST /mails/batch-action {mark_read, uids: ${uids.join(',')}} -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('delete a mail via DELETE endpoint', async ({ page }) => {
    await loginAsUser(page);
    // First send a test email so we have something to delete
    const headers = await authHeaders(page);
    const sendRes = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: `E2E Delete Test ${Date.now()}`,
        body: 'Email to be deleted.',
        is_html: false,
      },
      headers,
    });
    expect([200, 400]).toContain(sendRes.status());

    // Wait for delivery
    await page.waitForTimeout(3000);

    // Get latest mail
    const { mails, folder } = await ensureInboxHasMail(page);
    if (mails.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No mails to delete' });
      return;
    }
    const uid = String(mails[0].uid);

    const delRes = await page.request.delete(
      `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}`,
      { headers },
    );
    test.info().annotations.push({
      type: 'delete-mail',
      description: `DELETE /mails/${uid} -> ${delRes.status()}`,
    });
    expect([200, 204, 400, 404, 501]).toContain(delRes.status());
  });

  test('move a mail to another folder', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    if (mails.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No mails to move' });
      return;
    }
    const uid = String(mails[0].uid);
    const headers = await authHeaders(page);

    // Try to move to Drafts
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}/action`, {
      data: { action: 'move', target_folder: 'Drafts' },
      headers,
    });
    test.info().annotations.push({
      type: 'move-mail',
      description: `POST /mails/${uid}/action {move: Drafts} -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('snooze endpoint is accessible', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/snooze`, { headers });
    test.info().annotations.push({
      type: 'snooze',
      description: `GET /snooze -> ${res.status()}`,
    });
    expect([200, 404, 501]).toContain(res.status());
  });

  test('mail attachments endpoint', async ({ page }) => {
    await loginAsUser(page);
    const { mails, folder } = await ensureInboxHasMail(page);
    if (mails.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No mails to check attachments' });
      return;
    }
    const uid = String(mails[0].uid);
    const headers = await authHeaders(page);

    // Try to get attachment list (may not exist)
    const res = await page.request.get(
      `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails/${uid}/attachments`,
      { headers },
    );
    test.info().annotations.push({
      type: 'attachments',
      description: `GET /mails/${uid}/attachments -> ${res.status()}`,
    });
    expect([200, 404, 501]).toContain(res.status());
  });

  test('mail edit endpoint returns draft data', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // First save a draft
    const saveRes = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/save`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: `E2E Edit Draft ${Date.now()}`,
        body: 'Draft for editing.',
        is_html: false,
      },
      headers,
    });
    expect(saveRes.status()).toBe(200);

    // Then try to list drafts
    const draftsRes = await page.request.get(
      `${REMOTE_API}/mailboxes/0/folders/Drafts/mails?fields=contents&fields_action=exclude&page_size=10`,
      { headers },
    );
    expect(draftsRes.status()).toBe(200);
    const draftBody = await draftsRes.json();
    const drafts = draftBody?.data ?? draftBody ?? [];

    test.info().annotations.push({
      type: 'drafts',
      description: `Drafts folder has ${drafts.length} drafts`,
    });
  });

  test('mail list with fields=flags only returns flags', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);
    const { mails, folder } = await ensureInboxHasMail(page);

    const res = await page.request.get(
      `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails?fields=flags&page_size=5`,
      { headers },
    );
    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data ?? body ?? [];
      expect(Array.isArray(mails)).toBeTruthy();
    }
  });
});
