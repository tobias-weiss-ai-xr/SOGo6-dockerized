// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// @local
// Live SSE notification storm: the app receives mail:received events over a
// single EventSource connection. Regression coverage for three real bugs that
// this found:
//
//   Bug #45 — "Mail dialog storm": each MailSSEListener mount created its own
//             SSE subscription, so N mount/unmount cycles -> N notifications.
//             Fixed via a singleton handler + registration registry.
//   Bug #48-A — SPA folder navigation threw `registration is not defined`
//             (cleanup referencing an effect-scope `const` that was only ever
//             bound inside the async setupListener) -> "This page couldn't
//             load" on every folder click.
//   Bug #48-B — mail:received never updated the RTK Query cache: the injected
//             thunk called `thunkApi.getState()` (redux-thunk hands thunks
//             positional args `(dispatch, getState)`, not an object), so the
//             cache walk died with `TypeError: e.getState is not a function`
//             and new mail never rendered.
//
// The SSE endpoint (`/api/user/v1/sse`) is 404 in the live backend (Bug #47 —
// ApiLiveUpdates is not registered), so these tests intercept `**/api/sse`
// and serve synthetic events. Two interception modes are proven to work:
//   - held-open ReadableStream: lets us count live connections precisely and
//     proves the app keeps exactly ONE stream across SPA navigation.
//   - finite-body fulfill with a low `retry:` — the browser EventSource
//     reconnects and re-serves the event many times (a real reconnect storm),
//     and the singleton dedupe guard must keep the rendered mail at exactly 1.
//
//   npx playwright test local-mail-notification-storm.spec.ts

import { test, expect, setupEnvInterception, loginAsUser } from '../helpers';
import type { Page } from '@playwright/test';

const STORM_SUBJECT = 'STORM XYZ MAIL';
const STORM_ID = 'storm-xyz';
const SSE_EVENT = (id: string, subject: string) =>
  `retry: 300\n\nevent: mail:received\ndata: ${JSON.stringify({
    id,
    subject,
    preview: 'storm payload',
    from: { name: 'Storm Sender', email: 'storm@example.org' },
    receivedAt: new Date().toISOString(),
  })}\n\n`;

/** Collect page errors + failed requests so we can assert on zero crashes. */
function collectProblems(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 120)));
  return pageErrors;
}

/** DOM-level sidebar folder click (actionability is flaky while SSE is open). */
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

test.describe('@local mail notification storm prevention', () => {
  test('keeps a single SSE connection across SPA folder navigation', async ({ page }) => {
    let connections = 0;
    // Held-open stream: no body, never closed. Lets us count EventSource
    // connections precisely (SPA navigation must NOT open new ones).
    await page.route('**/api/sse', async (route) => {
      connections++;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('retry: 2000\n\n'));
        },
      });
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: stream,
      });
    });

    const pageErrors = collectProblems(page);
    await setupEnvInterception(page);
    await loginAsUser(page);
    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    expect(connections, 'exactly one SSE stream after login').toBe(1);

    // Rapid SPA navigation previously crashed the page (Bug #48-A) and
    // spawned extra EventSources per mount (Bug #45).
    for (const f of ['Drafts', 'Inbox', 'Sent', 'Drafts', 'Inbox']) {
      await clickFolder(page, f);
    }

    expect(pageErrors, 'no page errors during navigation').toEqual([]);
    expect(page.url()).toMatch(/\/u\/0\/INBOX$/);
    expect(connections, 'still exactly one SSE stream after SPA navigation').toBe(1);
  });

  test('mail:received storm renders the mail exactly once (dedupe + singleton)', async ({ page }) => {
    // Finite body + low retry: every reconnect re-serves the same event, so
    // dozens of `mail:received` messages hit the single handler. The dedupe
    // guard in the cache recipe must collapse them into ONE rendered row.
    let served = 0;
    await page.route('**/api/sse', async (route) => {
      served++;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: SSE_EVENT(STORM_ID, STORM_SUBJECT),
      });
    });

    const pageErrors = collectProblems(page);
    await setupEnvInterception(page);
    await loginAsUser(page);
    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
    // Let the reconnect storm churn for a bit (roughly 3 serves/sec).
    await page.waitForTimeout(5000);

    const text = await page.evaluate(() => document.body.innerText);
    expect(pageErrors, 'no page errors under storm').toEqual([]);
    expect(served, 'the mock must actually serve the storm').toBeGreaterThanOrEqual(3);
    const count = (text.match(new RegExp(STORM_SUBJECT, 'g')) || []).length;
    expect(count, `"${STORM_SUBJECT}" rendered exactly once`).toBe(1);
  });

  test('storm + navigation stress: still exactly one rendered mail, no crash', async ({ page }) => {
    let served = 0;
    await page.route('**/api/sse', async (route) => {
      served++;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: SSE_EVENT(`${STORM_ID}-nav`, `${STORM_SUBJECT} NAV`),
      });
    });

    const pageErrors = collectProblems(page);
    await setupEnvInterception(page);
    await loginAsUser(page);
    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    for (const f of ['Drafts', 'Inbox', 'Sent', 'Drafts', 'Inbox', 'Sent', 'Inbox']) {
      await clickFolder(page, f);
    }
    await page.waitForTimeout(4000);

    const text = await page.evaluate(() => document.body.innerText);
    expect(pageErrors, 'no page errors during stress').toEqual([]);
    expect(page.url()).toMatch(/\/u\/0\/INBOX$/);
    expect(served, 'the mock must actually serve the storm').toBeGreaterThanOrEqual(5);
    const count = (text.match(new RegExp(`${STORM_SUBJECT} NAV`, 'g')) || []).length;
    expect(count, 'rendered exactly once despite storm during navigation').toBe(1);
  });
});
