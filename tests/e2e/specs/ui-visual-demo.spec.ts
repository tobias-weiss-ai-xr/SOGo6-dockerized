// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// VISUAL regression of the SOGo6 UI on the LIVE demo.
//
// Screenshots are committed as baselines next to this spec
// (ui-visual-demo.spec.ts-snapshots/*.png). Refresh them deliberately:
//
//   npx playwright test specs/ui-visual-demo.spec.ts --update-snapshots
//
// The logged-in test doubles as a reproducible audit of the post-login
// notification dialogs: the demo account holds live drafts/mail, and a fresh
// session reopens the newest drafts as compose ("New message") windows. This is
// the "3 new message dialogs after login" phenomenon observed manually — this
// spec pins it visually and dumps the dialog texts as an annotation (audit,
// NOT a hard assertion, because the live draft set changes as tests run).
//
// Stability rules:
//   - animations disabled for screenshots; caret hidden for filled inputs
//   - explicit theme on the login page (non-Auto) for a deterministic baseline
//   - small maxDiffPixelRatio absorbs font-loading / anti-alias noise

import { test, expect, REMOTE_BASE, REMOTE_CREDENTIALS, loginRemoteUser } from '../helpers';

const hasRemoteCreds = !!REMOTE_CREDENTIALS.user.email && !!REMOTE_CREDENTIALS.user.password;

async function settleFonts(page: any) {
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
}

/**
 * Detect dialog-like UI: compose windows by their controls, plus any
 * role/class based toasts/modals. Returns their visible text.
 */
async function visibleDialogs(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const out = new Set<string>();
    const mark = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const text = ((el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ');
      if (text) out.add(text.slice(0, 300));
    };
    // Compose windows expose the editor controls regardless of their classes.
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const text = (el as HTMLElement).innerText || '';
      if (/Cc\s*\n?Bcc/.test(text) && /Send/.test(text) && /Minimize/.test(text)) {
        mark(el);
        continue;
      }
      const cls = (el.getAttribute('class') || '').toLowerCase();
      if (/toast|notification|popup|snackbar|modal|dialog/.test(cls)) mark(el);
    }
    return Array.from(out);
  });
}

test.describe('SOGo6 UI visual regression @visual @remote', () => {
  test.skip(!hasRemoteCreds, 'REMOTE credentials missing in tests/e2e/.env');

  test('login page renders (deterministic light theme)', async ({ page }) => {
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const emailInput = page
      .locator('input[type="email"], input[name="email"], input[id="email"]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 20000 });

    // Neutralize any persisted/auto theme so the baseline is deterministic.
    const light = page.getByRole('button', { name: 'Light' });
    if (await light.isVisible({ timeout: 3000 }).catch(() => false)) {
      await light.click();
    }
    await page.waitForTimeout(1000);
    await settleFonts(page);

    await expect(page.locator('body')).toHaveScreenshot('login-page.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('logged-in shell renders; draft compose dialogs audited & pinned', async ({ page }) => {
    await loginRemoteUser(page);
    await settleFonts(page);
    await page.waitForTimeout(2000);

    const dialogs = await visibleDialogs(page);
    const dump = JSON.stringify(dialogs, null, 2);
    console.log(`[dialogs] ${dump}`);
    test.info().annotations.push({ type: 'post-login dialogs', description: dump });

    // Full-shell baseline (pins mailbox pane + any open compose windows).
    await expect(page.locator('body')).toHaveScreenshot('logged-in-shell.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.03,
    });

    // Focused baseline of the bottom-right compose-window stack. The locator is
    // the app's fixed bottom-right dialog stack (Tailwind utilities).
    const stack = page.locator('div.fixed.right-14.bottom-0').first();
    if (await stack.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(stack).toHaveScreenshot('compose-dialogs.png', {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.03,
      });
    }
  });

  test('mail reading pane renders for a selected message', async ({ page }) => {
    await loginRemoteUser(page);
    await settleFonts(page);
    // Open a message from the inbox list (the welcome mail is stable demo data).
    const welcome = page.getByText('Welcome to SOGo6 Demo').first();
    await welcome.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (await welcome.isVisible().catch(() => false)) {
      await welcome.click();
      await page.waitForTimeout(2500);
      await settleFonts(page);
    }
    await expect(page.locator('body')).toHaveScreenshot('mail-reading-pane.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.03,
    });
  });
});
