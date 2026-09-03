// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// @local
// Sent-folder visibility (Bug #46): a mail sent through the real v1 send API
// must land in the account's SENT folder ("Sent Items") and be visible there
// in the UI. Earlier drafts of this spec used a fictional
// `/api/user/v1/mail/send` endpoint and a `/en-US/` locale that never existed;
// the real contract is:
//
//   POST /api/user/v1/mailboxes/{account_id}/mail/send
//        body: { from, to[], subject, body, is_html }
//   SENT folder -> { type: "SENT", path: "Sent Items" } in the folder tree
//   cleanup:     DELETE /api/user/v1/mailboxes/0/folders/Sent%20Items/mails/{uid}
//
//   npx playwright test local-mail-sent-folder.spec.ts

import { test, expect } from '../helpers';
import { setupEnvInterception, loginAsUser } from '../helpers';
import type { Page } from '@playwright/test';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };
const STAMP = Date.now();
const SUBJECT = `[local-e2e] sent folder ${STAMP}`;

let token = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/user/v1/auth/login`, {
    data: { username: USER.email, password: USER.password },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();
});

/** DOM-level sidebar folder click (reliable while SSE is open). */
async function clickFolder(page: Page, label: string) {
  // Poll for the sidebar button: the app shell may still be mounting when we
  // land after login, so a single query can legitimately come up empty.
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) {
    ok = await page.evaluate((l) => {
      const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
      const b =
        btns.find((x) => (x.getAttribute('title') || '') === l) ||
        btns.find((x) => (x.textContent || '').trim() === l);
      if (b) { b.click(); return true; }
      return false;
    }, label);
    if (!ok) await page.waitForTimeout(500);
  }
  expect(ok, `sidebar button "${label}" must exist`).toBeTruthy();
  await page.waitForTimeout(900);
}

test.describe('@local sent folder visibility', () => {
  test('sends a real mail which lands in the SENT folder ("Sent Items")', async ({ request }) => {
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/send`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: {
        from: USER.email,
        to: [USER.email],
        subject: SUBJECT,
        body: 'sent-folder verification body',
        is_html: false,
      },
    });
    expect(res.status(), `send must succeed (got ${res.status()})`).toBe(200);
    const body = await res.json();
    expect(body?.error_code, 'no api error on send').toBe('S000000');

    // Poll until the mail is visible in the SENT folder (Stalwart sync lag).
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const list = await request.get(
        `${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent('Sent Items')}/mails?fields_action=exclude&fields=contents&page_size=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await list.json();
      const mails = Array.isArray(data?.data) ? data.data : [];
      found = mails.some((m: any) => m.subject === SUBJECT);
    }
    expect(found, `sent mail "${SUBJECT}" appears in Sent Items`).toBeTruthy();

    // Folder tree must declare the SENT folder with the UI-visible path.
    const folders = await request.get(`${API}/api/user/v1/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tree = await folders.json();
    const sent = (tree?.data ?? []).find((f: any) => f.type === 'SENT');
    expect(sent, 'folder tree contains a SENT-type folder').toBeTruthy();
    expect(sent.path, 'SENT folder path').toBe('Sent Items');
    expect(sent.selectable, 'SENT folder must be selectable in the UI').toBe(true);
  });

  test('renders the sent mail in the UI Sent Items folder', async ({ page }) => {
    // Keep the SSE connection quiet (backend /sse is 404) so the UI stays calm.
    await page.route('**/api/sse', async (route) => {
      const stream = new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('retry: 2000\n\n')); },
      });
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: stream });
    });

    await setupEnvInterception(page);
    await loginAsUser(page);
    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
    await clickFolder(page, 'Sent');
    await page.waitForTimeout(1200);

    const text = await page.evaluate(() => document.body.innerText);
    expect(text, 'sidebar navigated into Sent Items').toContain('Sent Items');
    expect(text, `sent mail subject rendered in the list`).toContain(SUBJECT);
  });

  test('cleanup removes the sent mail', async ({ request }) => {
    // Locate the mail by subject, then delete it (marks deleted + expunges).
    const list = await request.get(
      `${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent('Sent Items')}/mails?fields_action=exclude&fields=contents&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await list.json();
    const mails = Array.isArray(data?.data) ? data.data : [];
    const target = mails.find((m: any) => m.subject === SUBJECT);
    if (target) {
      const del = await request.delete(
        `${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent('Sent Items')}/mails/${target.uid}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(del.status(), `delete sent mail should be 2xx (got ${del.status()})`).toBeLessThan(300);
    }

    // Give Stalwart a moment, then confirm it is gone.
    await new Promise((r) => setTimeout(r, 1000));
    const list2 = await request.get(
      `${API}/api/user/v1/mailboxes/0/folders/${encodeURIComponent('Sent Items')}/mails?fields_action=exclude&fields=contents&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const after = await list2.json();
    const mails2 = Array.isArray(after?.data) ? after.data : [];
    expect(mails2.some((m: any) => m.subject === SUBJECT), 'sent mail cleaned up').toBeFalsy();
  });
});
