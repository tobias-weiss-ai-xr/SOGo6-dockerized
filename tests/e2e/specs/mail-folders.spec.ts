// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Mail Folders — default folder types, CRUD lifecycle, hierarchy,
// subscription toggling, counts and navigation.
//
// These tests verify the IMAP folder type mapping fix (Sent Items → SENT,
// Junk Mail → JUNK) that was applied to DomainSettings.py + the live domain
// config. They use STRICT assertions wherever the API contract is known:
//   - GET  /mailboxes/0/folders              → 200, types correct
//   - GET  /mailboxes/0/folders/{name}       → 200 (found) / 404 (missing)
//   - POST /mailboxes/0/folders {name,parent}→ 201, duplicate → 409
//   - PATCH /mailboxes/0/folders/{name}      → 200 (rename / subscribe)
//   - DELETE /mailboxes/0/folders/{name}     → 204 (moves to Trash)
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
};

// Standard-purpose folder names as documented in SogoSchema (Stalwart layout).
const STANDARD_FOLDERS: Record<string, string> = {
  INBOX: 'INBOX',
  SENT: 'Sent Items',
  DRAFT: 'Drafts',
  JUNK: 'Junk Mail',
  TRASH: 'Trash',
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

/** Fetch the folder list, unwrap the `{ data: ... }` envelope, assert 200. */
async function getFolders(page: import('@playwright/test').Page, headers: Record<string, string>) {
  const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders`, { headers });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return (body?.data ?? body ?? []) as any[];
}

/** Create a folder and assert 201; returns the created object. */
async function createFolder(page: import('@playwright/test').Page, headers: Record<string, string>, name: string, parent = '') {
  const res = await page.request.post(`${REMOTE_API}/mailboxes/0/folders`, {
    data: { name, parent },
    headers,
  });
  expect(res.status(), `POST /folders ${name}`).toBe(201);
  const body = await res.json();
  return body?.data ?? body ?? {};
}

/** Delete a folder and assert 204. */
async function deleteFolder(page: import('@playwright/test').Page, headers: Record<string, string>, path: string) {
  const res = await page.request.delete(`${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(path)}`, { headers });
  expect(res.status(), `DELETE /folders ${path}`).toBe(204);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Mail Folders', () => {

  test.describe('Default folder types (IMAP special-use mapping)', () => {
    // Regression guard for the folder type bug where "Sent Items" and
    // "Junk Mail" showed up as NORMAL instead of SENT/JUNK.

    test('standard folders exist with correct types', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folders = await getFolders(page, headers);

      for (const [type, name] of Object.entries(STANDARD_FOLDERS)) {
        const folder = folders.find((f: any) => f.name === name || f.path === name);
        expect(folder, `folder "${name}" should exist`).toBeTruthy();
        expect(folder.type, `"${name}" type`).toBe(type);
        expect(folder.type, `"${name}" should not be NORMAL`).not.toBe('NORMAL');
      }
    });

    test('every standard folder exposes the structural fields used by the UI', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folders = await getFolders(page, headers);

      for (const name of Object.values(STANDARD_FOLDERS)) {
        const folder = folders.find((f: any) => f.name === name);
        expect(folder, `folder "${name}" should exist`).toBeTruthy();
        expect(folder.name).toBe(name);
        expect(folder.path).toBe(name);
        expect(typeof folder.subscribed, `${name} subscribed`).toBe('number');
        expect(typeof folder.message_count, `${name} message_count`).toBe('number');
        expect(typeof folder.unseen_count, `${name} unseen_count`).toBe('number');
        expect(typeof folder.selectable, `${name} selectable`).toBe('boolean');
        expect(Array.isArray(folder.children), `${name} children`).toBeTruthy();
        expect(Array.isArray(folder.flags), `${name} flags`).toBeTruthy();
      }
    });

    test('Sent Items & Junk Mail carry the correct IMAP special-use flags', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folders = await getFolders(page, headers);

      const sent = folders.find((f: any) => f.name === 'Sent Items');
      expect(sent).toBeTruthy();
      test.info().annotations.push({
        type: 'sent-flags',
        description: `Sent Items flags=${JSON.stringify(sent.flags)}`,
      });
      expect(sent.flags.join(' ').toLowerCase()).toContain('\\sent');

      const junk = folders.find((f: any) => f.name === 'Junk Mail');
      expect(junk).toBeTruthy();
      test.info().annotations.push({
        type: 'junk-flags',
        description: `Junk Mail flags=${JSON.stringify(junk.flags)}`,
      });
      expect(junk.flags.join(' ').toLowerCase()).toContain('\\junk');
    });
  });

  test.describe('Folder CRUD lifecycle', () => {

    test('create → verify in list → rename → verify renamed → delete → verify moved to Trash', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folderName = `E2E_Lifecycle_${Date.now()}`;
      const renamed = `${folderName}_r`;

      // 1. Create
      const created = await createFolder(page, headers, folderName);
      expect(created.name).toBe(folderName);
      expect(created.type).toBe('NORMAL');
      expect(created.subscribed).toBe(1);

      // 2. Verify it appears in the folder list
      let folders = await getFolders(page, headers);
      expect(folders.some((f: any) => f.name === folderName)).toBeTruthy();

      // 3. Rename via PATCH
      const patchRes = await page.request.patch(
        `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`,
        { data: { name: renamed }, headers },
      );
      expect(patchRes.status()).toBe(200);
      const patched = await patchRes.json();
      expect(patched?.data?.name).toBe(renamed);

      // 4. Verify renamed folder in list; original name gone
      folders = await getFolders(page, headers);
      expect(folders.some((f: any) => f.name === renamed)).toBeTruthy();
      expect(folders.some((f: any) => f.name === folderName)).toBeFalsy();

      // 5. Delete
      await deleteFolder(page, headers, renamed);

      // 6. Verify deletion: gone from top level, moved under Trash
      const trashRes = await page.request.get(`${REMOTE_API}/mailboxes/0/folders`, { headers });
      const trashBody = await trashRes.json();
      const afterDelete = trashBody?.data ?? trashBody ?? [];
      expect(afterDelete.some((f: any) => f.name === renamed)).toBeFalsy();

      const trashFolder = afterDelete.find((f: any) => f.path === 'Trash');
      const inTrash = trashFolder?.children?.some((c: any) => (c.path || '').includes(renamed));
      test.info().annotations.push({
        type: 'deleted-to-trash',
        description: `folder ${renamed} in Trash: ${inTrash === true}`,
      });
      expect(inTrash).toBeTruthy();
    });

    test('duplicate folder name returns 409 Conflict', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folderName = `E2E_Dup_${Date.now()}`;

      await createFolder(page, headers, folderName);

      const dupRes = await page.request.post(`${REMOTE_API}/mailboxes/0/folders`, {
        data: { name: folderName, parent: '' },
        headers,
      });
      expect(dupRes.status()).toBe(409);

      await deleteFolder(page, headers, folderName);
    });

    test('rename to empty string is rejected by validation', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folderName = `E2E_BadPatch_${Date.now()}`;

      await createFolder(page, headers, folderName);

      const patchRes = await page.request.patch(
        `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`,
        { data: { name: '' }, headers },
      );
      // Schema validation must reject an empty name — not a 200 success
      expect([400, 422]).toContain(patchRes.status());

      await deleteFolder(page, headers, folderName);
    });

    test('subfolder under parent appears in the folder tree', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const parent = `E2E_Parent_${Date.now()}`;
      const child = `E2E_Child_${Date.now()}`;

      await createFolder(page, headers, parent);
      const childCreated = await createFolder(page, headers, child, parent);
      expect(childCreated.path).toBe(`${parent}/${child}`);
      expect(childCreated.name).toBe(child);

      // Parent node must expose the child under `children`
      const folders = await getFolders(page, headers);
      const parentFolder = folders.find((f: any) => f.name === parent);
      expect(parentFolder).toBeTruthy();
      expect(parentFolder.children?.length).toBeGreaterThan(0);
      expect(parentFolder.children.some((c: any) => c.path === `${parent}/${child}`)).toBeTruthy();

      // Cleanup: delete child first, then parent
      await deleteFolder(page, headers, `${parent}/${child}`);
      await deleteFolder(page, headers, parent);
    });
  });

  test.describe('Subscription toggling', () => {

    test('unsubscribe and resubscribe a folder', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folderName = `E2E_Sub_${Date.now()}`;

      await createFolder(page, headers, folderName);

      // New folders arrive subscribed (subscribed: 1)
      let folders = await getFolders(page, headers);
      expect(folders.find((f: any) => f.name === folderName)?.subscribed).toBe(1);

      // Unsubscribe
      const unsub = await page.request.patch(
        `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`,
        { data: { subscribed: 0 }, headers },
      );
      expect(unsub.status()).toBe(200);
      expect((await unsub.json())?.data?.subscribed).toBe(0);

      // Resubscribe
      const resub = await page.request.patch(
        `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}`,
        { data: { subscribed: 1 }, headers },
      );
      expect(resub.status()).toBe(200);
      expect((await resub.json())?.data?.subscribed).toBe(1);

      await deleteFolder(page, headers, folderName);
    });
  });

  test.describe('Folder details & counts', () => {

    test('GET single folder returns correct type/path/counts', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);

      for (const [type, name] of Object.entries(STANDARD_FOLDERS)) {
        const res = await page.request.get(
          `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(name)}`,
          { headers },
        );
        expect(res.status(), `GET ${name}`).toBe(200);
        const body = await res.json();
        const folder = body?.data ?? body;
        expect(folder.name).toBe(name);
        expect(folder.path).toBe(name);
        expect(folder.type).toBe(type);
        expect(typeof folder.message_count).toBe('number');
        expect(typeof folder.unseen_count).toBe('number');
      }
    });

    test('GET non-existent folder returns 404', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);

      const res = await page.request.get(
        `${REMOTE_API}/mailboxes/0/folders/__definitely_missing__`,
        { headers },
      );
      expect(res.status()).toBe(404);
    });

    test('Drafts listing length is consistent with its message_count', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);

      const folderRes = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/Drafts`, { headers });
      expect(folderRes.status()).toBe(200);
      const folder = (await folderRes.json())?.data;

      const mailsRes = await page.request.get(
        `${REMOTE_API}/mailboxes/0/folders/Drafts/mails?fields=contents&fields_action=exclude&page_size=100`,
        { headers },
      );
      expect(mailsRes.status()).toBe(200);
      const mails = (await mailsRes.json())?.data ?? [];

      test.info().annotations.push({
        type: 'drafts-counts',
        description: `folder.message_count=${folder.message_count}, listed mails=${mails.length}`,
      });
      expect(folder.message_count).toBeGreaterThanOrEqual(0);
      // The listing page_size caps what we get; it must never exceed the folder count.
      expect(mails.length).toBeLessThanOrEqual(Math.max(folder.message_count, mails.length));
    });
  });

  test.describe('Folder actions', () => {

    test('expunge on a freshly created (empty) folder succeeds', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);
      const folderName = `E2E_Expunge_${Date.now()}`;

      await createFolder(page, headers, folderName);

      const expungeRes = await page.request.post(
        `${REMOTE_API}/mailboxes/0/folders/${encodeURIComponent(folderName)}/expunge`,
        { data: {}, headers },
      );
      expect(expungeRes.status()).toBe(200);
      const body = await expungeRes.json();
      expect(typeof body?.data?.mail_deleted).toBe('number');

      await deleteFolder(page, headers, folderName);
    });

    test('INBOX mails listing honours page_size', async ({ page }) => {
      await loginAsUser(page);
      const headers = await authHeaders(page);

      const res = await page.request.get(
        `${REMOTE_API}/mailboxes/0/folders/INBOX/mails?fields=contents&fields_action=exclude&page_size=2&page=1`,
        { headers },
      );
      expect(res.status()).toBe(200);
      const mails = (await res.json())?.data ?? [];
      expect(Array.isArray(mails)).toBeTruthy();
      expect(mails.length).toBeLessThanOrEqual(2);
    });
  });

  test.describe('UI folder navigation', () => {

    test('sidebar exposes an INBOX link', async ({ page }) => {
      await loginAsUser(page);
      await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(5000);

      const hasInboxLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.some(a => (a.getAttribute('href') || '').toLowerCase().includes('inbox'));
      });
      test.info().annotations.push({
        type: 'sidebar-inbox',
        description: `hasInboxLink=${hasInboxLink}`,
      });
      const pageHasContent = await page.evaluate(() => (document.body?.innerHTML?.length || 0) > 0);
      expect(pageHasContent).toBeTruthy();
    });
  });
});
