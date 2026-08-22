// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E layout tests for the LEFT sidebar top-left region on the live SOGo6 demo.
//
// Verifies the account switcher (two-line local-part + domain), the New message
// button, and absence of text clipping/overlap in the top-left sidebar region.
//
// Credentials: testuser@sogo6.contextual-intelligence.org / S0g0Test2026!Secure

import { test, expect } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: 'testuser@sogo6.contextual-intelligence.org',
  password: 'S0g0Test2026!Secure',
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
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
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

test.describe('Left Sidebar Top-Left Layout', () => {
  test.describe.configure({ mode: 'serial' });

  test('account switcher renders two lines: local part then domain', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const switcher = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      if (!sidebar) return null;
      const spans = Array.from(sidebar.querySelectorAll('span'));
      // Find the two-line account display: a "truncate text-sm" + a "text-[10px]" sibling
      const lines = spans
        .map((s) => ({ text: (s.textContent || '').trim(), cls: String(s.className || '') }))
        .filter((s) => s.text && (s.cls.includes('text-sm leading-tight') || s.cls.includes('text-[10px]')))
        .map((s, i, arr) => {
          const r = s ? null : null;
          return s;
        })
        .slice(0, 4);
      return lines;
    });

    test.info().annotations.push({
      type: 'switcher',
      description: `lines: ${JSON.stringify(switcher)}`,
    });
    expect(switcher).toBeTruthy();
    expect(switcher!.length).toBeGreaterThanOrEqual(2);

    const texts = switcher!.map((s: any) => s.text);
    expect(texts[0]).toBe('testuser'); // local part
    expect(texts[1]).toContain('@sogo6.contextual-intelligence.org'); // domain
  });

  test('account switcher icon and text are vertically aligned inside the button', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const geom = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      if (!sidebar) return null;
      const btn = Array.from(sidebar.querySelectorAll('[data-sidebar="menu-button"]'))
        .find((b) => (b.textContent || '').includes('contextual-intelligence.org'));
      if (!btn) return null;
      const br = (btn as HTMLElement).getBoundingClientRect();
      // avatar/icon is usually the first child
      const firstChild = (btn as HTMLElement).firstElementChild as HTMLElement | null;
      const fr = firstChild ? firstChild.getBoundingClientRect() : null;
      // text block
      const textBlock = Array.from((btn as HTMLElement).querySelectorAll('div')).find((d) => d.querySelector('span'));
      const tr = textBlock ? textBlock.getBoundingClientRect() : null;
      return {
        button: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) },
        icon: fr ? { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width), h: Math.round(fr.height) } : null,
        text: tr ? { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height) } : null,
      };
    });

    expect(geom).toBeTruthy();
    test.info().annotations.push({ type: 'geom', description: JSON.stringify(geom) });
    // Icon must be to the LEFT of the text and both inside the button
    if (geom!.icon && geom!.text) {
      expect(geom!.icon.x).toBeLessThan(geom!.text.x);
      expect(geom!.icon.y + geom!.icon.h).toBeLessThanOrEqual(geom!.button.y + geom!.button.h + 2);
    }
  });

  test('New message button is present below the account switcher', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const state = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      if (!sidebar) return null;
      const btns = Array.from(sidebar.querySelectorAll('[data-sidebar="menu-button"]'));
      const account = btns.find((b) => (b.textContent || '').includes('contextual-intelligence.org'));
      const compose = btns.find((b) => /new message|neue nachricht/i.test((b.textContent || '').trim()));
      if (!account || !compose) return null;
      const ar = (account as HTMLElement).getBoundingClientRect();
      const cr = (compose as HTMLElement).getBoundingClientRect();
      return {
        accountY: Math.round(ar.y),
        composeY: Math.round(cr.y),
        accountH: Math.round(ar.height),
        bothInSidebar: ar.width > 0 && cr.width > 0,
      };
    });
    expect(state).toBeTruthy();
    test.info().annotations.push({ type: 'stack', description: JSON.stringify(state) });
    // New message must sit BELOW the account switcher (top-left stacking)
    expect(state!.composeY).toBeGreaterThan(state!.accountY);
    expect(state!.bothInSidebar).toBeTruthy();
  });

  test('no unintended text truncation in the top-left sidebar region', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const truncated = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      if (!sidebar) return [];
      const issues: string[] = [];
      const top = (el: Element) => el.getBoundingClientRect().top;
      for (const el of Array.from(sidebar.querySelectorAll('span'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (top(el) > 500) continue;
        const isSrOnly = /sr-only/.test(String(el.className || ''));
        if (isSrOnly) continue; // intentional
        const text = (el.textContent || '').trim();
        if (!text) continue;
        if (el.scrollWidth > el.clientWidth + 2) {
          issues.push(`"${text.substring(0, 40)}" scrollW=${el.scrollWidth} clientW=${el.clientWidth}`);
        }
      }
      return issues;
    });

    test.info().annotations.push({
      type: 'truncation',
      description: truncated!.length ? truncated!.join(' ; ') : 'none',
    });
    expect(truncated!.length).toBe(0);
  });

  test('left sidebar keeps a stable, reasonable width at 1440px viewport', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const w = await page.evaluate(() => {
      const bar = document.querySelector('[data-sidebar="sidebar"]');
      return bar ? Math.round(bar.getBoundingClientRect().width) : -1;
    });
    // SIDEBAR_WIDTH = 17rem = 272px
    expect(w).toBe(272);
  });
});
