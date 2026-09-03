// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// @local
// Drafts: save a draft through the real v1 API, verify it lands in the DRAFT
// folder ("Drafts"), is openable (GET detail 200), and renders in the UI.
//
// Real contract (grounded against the live backend):
//   POST   /api/user/v1/mailboxes/{account_id}/mail/save   -> creates a draft
//   GET    /api/user/v1/mailboxes/0/folders/Drafts/mails/{uid}   -> detail 200
//   DELETE /api/user/v1/mailboxes/0/folders/Drafts/mails/{uid}   -> cleanup
//
//   npx playwright test local-mail-drafts-open.spec.ts

import { test, expect } from '../helpers';
import { setupEnvInterception, loginAsUser } from '../helpers';
import type { Page } from '@playwright/test';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };
const STAMP = Date.now();
const SUBJECT = `[local-e2e] draft ${STAMP}`;

let token = '';
let createdUid = '';

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

test.describe('@local drafts open', () => {
  test('saves a draft via the v1 API and it appears in the Drafts folder', async ({ request }) => {
    const res = await request.post(`${API}/api/user/v1/mailboxes/0/mail/save`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: {
        to: ['someone@example.org'],
        subject: SUBJECT,
        body: 'draft body for local e2e',
        is_html: false,
      },
    });
    expect(res.status(), `save draft must succeed (got ${res.status()})`).toBe(200);
    const resp = await res.json();
    createdUid = String(resp?.data?.uid ?? '');
    expect(createdUid, 'save response reports the new draft uid').toBeTruthy();

    // The folder tree must list a DRAFT-type folder selectable as "Drafts".
    const folders = await request.get(`${API}/api/user/v1/mailboxes/0/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tree = await folders.json();
    const drafts = (tree?.data ?? []).find((f: any) => f.type === 'DRAFT');
    expect(drafts, 'folder tree contains a DRAFT-type folder').toBeTruthy();
    expect(drafts.path, 'DRAFT folder path').toBe('Drafts');
    expect(drafts.selectable, 'Drafts must be selectable').toBe(true);

    // The draft is listed with our subject.
    const list = await request.get(
      `${API}/api/user/v1/mailboxes/0/folders/Drafts/mails?fields_action=exclude&fields=contents&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await list.json();
    const mails = Array.isArray(data?.data) ? data.data : [];
    const mine = mails.find((m: any) => String(m.uid) === createdUid);
    expect(mine, 'draft listed under its uid').toBeTruthy();
    expect(mine.subject, 'draft subject round-trips').toBe(SUBJECT);
  });

  test('open (GET detail) of the saved draft returns the full body', async ({ request }) => {
    expect(createdUid, 'draft must exist from prior test').toBeTruthy();
    const res = await request.get(
      `${API}/api/user/v1/mailboxes/0/folders/Drafts/mails/${createdUid}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status(), `draft detail must be 200 (got ${res.status()})`).toBe(200);
    const body = await res.json();
    const detail = body?.data ?? body;
    const subject = detail?.subject ?? '';
    expect(subject, 'detail subject matches').toBe(SUBJECT);
    // The composed body is stored in contents.
    const contents = JSON.stringify(detail?.contents ?? []);
    expect(contents, 'draft body content present').toContain('draft body for local e2e');
  });

  test('renders the saved draft in the UI Drafts folder', async ({ page }) => {
    expect(createdUid, 'draft must exist from prior test').toBeTruthy();
    // Quiet SSE (backend /sse is 404 — keep the UI calm).
    await page.route('**/api/sse', async (route) => {
      const stream = new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('retry: 2000\n\n')); },
      });
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: stream });
    });

    await setupEnvInterception(page);
    await loginAsUser(page);
    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
    await clickFolder(page, 'Drafts');
    await page.waitForTimeout(1500);

    const text = await page.evaluate(() => document.body.innerText);
    expect(text, 'navigated into the Drafts folder').toContain('Drafts');
    expect(text, `draft subject rendered in the Drafts list`).toContain(SUBJECT);
  });

  test('cleanup deletes the draft', async ({ request }) => {
    expect(createdUid, 'draft must exist from prior test').toBeTruthy();
    const del = await request.delete(
      `${API}/api/user/v1/mailboxes/0/folders/Drafts/mails/${createdUid}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(del.status(), `delete draft should be 2xx (got ${del.status()})`).toBeLessThan(300);

    await new Promise((r) => setTimeout(r, 1000));
    const list = await request.get(
      `${API}/api/user/v1/mailboxes/0/folders/Drafts/mails?fields_action=exclude&fields=contents&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await list.json();
    const mails = Array.isArray(data?.data) ? data.data : [];
    expect(
      mails.some((m: any) => String(m.uid) === createdUid),
      'draft removed after delete',
    ).toBeFalsy();
  });
});
