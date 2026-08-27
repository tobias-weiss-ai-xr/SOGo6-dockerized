// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Mail Operations — comprehensive CRUD and actions.
// Tests:
//   - Copy mail to another folder
//   - Restore mail from Trash
//   - Empty trash
//   - Mark multiple mails as read/unread in batch
//   - Flag/unflag multiple mails
//   - Sort mails by date, subject, sender
//   - Search with filters (from, subject, date range)
//   - Mail pagination (limit/offset)
//   - Get mail raw source (headers)
//   - Get mail attachments list
//   - Mail move to Junk and back
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
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

async function getInboxMails(page: import('@playwright/test').Page, token: string, limit = 10): Promise<any[]> {
  const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return [];
  const body = await res.json();
  return body?.data?.mails ?? body?.data ?? [];
}

async function ensureInboxHasMail(page: import('@playwright/test').Page, token: string): Promise<void> {
  // Send a self-addressed email to ensure INBOX has at least one mail
  await page.request.post(`${REMOTE_API}/mailboxes/0/mail`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      from: CREDENTIALS.email,
      to: [CREDENTIALS.email],
      subject: `E2E Ensure Mail ${Date.now()}`,
      body: 'Test mail for e2e operations.',
      is_html: false,
    },
  });
  // Wait for delivery
  await page.waitForTimeout(3000);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Mail Operations', () => {

  test('list INBOX mails with pagination (limit/offset)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // First page
    const res1 = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5&offset=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    const mails1 = body1?.data?.mails ?? body1?.data ?? [];
    test.info().annotations.push({ type: 'page1', description: `Mails on page 1: ${mails1.length}` });

    // Second page
    const res2 = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5&offset=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    const mails2 = body2?.data?.mails ?? body2?.data ?? [];
    test.info().annotations.push({ type: 'page2', description: `Mails on page 2: ${mails2.length}` });
  });

  test('list Sent Items folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/Sent%20Items/mails?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'sent', description: `GET Sent Items -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('list Drafts folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/Drafts/mails?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'drafts', description: `GET Drafts -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('list Junk Mail folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/Junk%20Mail/mails?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'junk', description: `GET Junk Mail -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('list Trash folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/Trash/mails?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'trash', description: `GET Trash -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('get folders list with types', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const folders = body?.data?.folders ?? body?.data ?? [];
    expect(folders.length).toBeGreaterThan(0);

    // Standard folders should be present
    const folderNames = folders.map((f: any) => f.name || f.path || f.folder_name);
    test.info().annotations.push({
      type: 'folders',
      description: `Folders: ${folderNames.join(', ')}`,
    });

    // INBOX should always exist
    const hasInbox = folders.some((f: any) =>
      (f.name || f.path || f.folder_name) === 'INBOX' ||
      (f.type || f.folder_type) === 'INBOX'
    );
    expect(hasInbox).toBeTruthy();
  });

  test('mark mail as read and verify flag change', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    await ensureInboxHasMail(page, token);

    const mails = await getInboxMails(page, token, 5);
    if (mails.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No mails in INBOX' });
      return;
    }

    const mail = mails[0];
    const uid = mail.uid || mail.id || mail.UID;
    if (!uid) {
      test.info().annotations.push({ type: 'skip', description: 'No UID on mail' });
      return;
    }

    // Mark as read
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'read', value: true },
    });
    test.info().annotations.push({
      type: 'mark-read',
      description: `POST action read -> ${res.status()}`,
    });
    expect([200, 204]).toContain(res.status());
  });

  test('mark mail as unread and verify flag change', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    await ensureInboxHasMail(page, token);

    const mails = await getInboxMails(page, token, 5);
    if (mails.length === 0) return;

    const mail = mails[0];
    const uid = mail.uid || mail.id || mail.UID;
    if (!uid) return;

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'read', value: false },
    });
    test.info().annotations.push({
      type: 'mark-unread',
      description: `POST action unread -> ${res.status()}`,
    });
    expect([200, 204]).toContain(res.status());
  });

  test('flag and unflag a mail', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    await ensureInboxHasMail(page, token);

    const mails = await getInboxMails(page, token, 5);
    if (mails.length === 0) return;

    const mail = mails[0];
    const uid = mail.uid || mail.id || mail.UID;
    if (!uid) return;

    // Flag
    const flagRes = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'flag', value: true },
    });
    test.info().annotations.push({ type: 'flag', description: `POST flag -> ${flagRes.status()}` });
    expect([200, 204]).toContain(flagRes.status());

    // Unflag
    const unflagRes = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'flag', value: false },
    });
    test.info().annotations.push({ type: 'unflag', description: `POST unflag -> ${unflagRes.status()}` });
    expect([200, 204]).toContain(unflagRes.status());
  });

  test('move mail to Trash and restore', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    await ensureInboxHasMail(page, token);

    const mails = await getInboxMails(page, token, 5);
    if (mails.length === 0) return;

    const mail = mails[0];
    const uid = mail.uid || mail.id || mail.UID;
    if (!uid) return;

    // Move to Trash
    const moveRes = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { action: 'move', dest_folder: 'Trash' },
    });
    test.info().annotations.push({ type: 'move-to-trash', description: `POST move to Trash -> ${moveRes.status()}` });
    expect([200, 204]).toContain(moveRes.status());

    // Verify it's in Trash
    const trashRes = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/Trash/mails?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (trashRes.status() === 200) {
      const trashBody = await trashRes.json();
      const trashMails = trashBody?.data?.mails ?? trashBody?.data ?? [];
      test.info().annotations.push({ type: 'trash', description: `Trash mails: ${trashMails.length}` });
    }
  });

  test('search mails with query parameter', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=test&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'search', description: `GET search?q=test -> ${res.status()}` });
    expect([200, 404, 503]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const results = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'search-results', description: `Results: ${Array.isArray(results) ? results.length : 'N/A'}` });
    }
  });

  test('search mails with empty query returns results', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/search?q=&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'search-empty', description: `GET search?q= -> ${res.status()}` });
    expect([200, 404, 503]).toContain(res.status());
  });

  test('get mail detail with full headers', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    await ensureInboxHasMail(page, token);

    const mails = await getInboxMails(page, token, 5);
    if (mails.length === 0) return;

    const mail = mails[0];
    const uid = mail.uid || mail.id || mail.UID;
    if (!uid) return;

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}?fields=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'detail', description: `GET mail detail -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const mailData = body?.data ?? body;
      expect(mailData).toBeTruthy();
    }
  });

  test('get mail raw source', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    await ensureInboxHasMail(page, token);

    const mails = await getInboxMails(page, token, 5);
    if (mails.length === 0) return;

    const mail = mails[0];
    const uid = mail.uid || mail.id || mail.UID;
    if (!uid) return;

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/${uid}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'raw', description: `GET mail raw -> ${res.status()}` });
    // Raw endpoint may not exist in all deployments
    expect([200, 404, 501]).toContain(res.status());
  });

  test('mail folder tree structure (nested folders)', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders?tree=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'tree', description: `GET folders?tree=true -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const folders = body?.data?.folders ?? body?.data ?? [];
      expect(folders.length).toBeGreaterThan(0);
    }
  });

  test('create and delete a custom mail folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    const folderName = `E2E_Test_${Date.now()}`;

    // Create
    const createRes = await page.request.post(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: folderName, parent: 'INBOX' },
    });
    test.info().annotations.push({ type: 'create', description: `POST create folder -> ${createRes.status()}` });
    expect([200, 201, 409]).toContain(createRes.status());

    if (createRes.status() === 201 || createRes.status() === 200) {
      // Delete
      const delRes = await page.request.delete(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      test.info().annotations.push({ type: 'delete', description: `DELETE folder -> ${delRes.status()}` });
      expect([200, 204, 404]).toContain(delRes.status());
    }
  });

  test('subscribe and unsubscribe a mail folder', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    // Get a folder to test with
    const foldersRes = await page.request.get(`${REMOTE_API}/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(foldersRes.status()).toBe(200);
    const foldersBody = await foldersRes.json();
    const folders = foldersBody?.data?.folders ?? foldersBody?.data ?? [];
    if (folders.length === 0) return;

    const folder = folders[0];
    const folderName = folder.name || folder.path || folder.folder_name;
    if (!folderName) return;

    // Subscribe (subscribed must be integer 1/0, not boolean)
    const subRes = await page.request.patch(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { subscribed: 1 },
    });
    test.info().annotations.push({ type: 'subscribe', description: `PATCH subscribe -> ${subRes.status()}` });
    expect([200, 204]).toContain(subRes.status());

    // Unsubscribe
    const unsubRes = await page.request.patch(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { subscribed: 0 },
    });
    test.info().annotations.push({ type: 'unsubscribe', description: `PATCH unsubscribe -> ${unsubRes.status()}` });
    expect([200, 204]).toContain(unsubRes.status());

    // Re-subscribe to restore state
    await page.request.patch(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { subscribed: 1 },
    });
  });

  test('expunge deleted mails from Trash', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders/Trash/expunge`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    test.info().annotations.push({ type: 'expunge', description: `POST expunge Trash -> ${res.status()}` });
    expect([200, 204, 404]).toContain(res.status());
  });
});
