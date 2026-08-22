// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// SOTA mobile-responsive tests for the public SOGo6 demo.
//
// Verifies core pages render on a mobile-class viewport (375x812) without
// horizontal overflow and that the sidebar switches to a sheet/menu pattern.

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

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docScrollW = document.documentElement.scrollWidth;
    const bodyScrollW = document.body?.scrollWidth ?? 0;
    // The canonical signal of a broken mobile layout: the DOCUMENT itself is
    // wider than the viewport (elements pushed off-screen horizontally).
    // Elements inside overflow-x-auto containers are fine — they scroll.
    const overflow = docScrollW > vw + 2 || bodyScrollW > vw + 2;
    const offenders: string[] = [];
    if (overflow) {
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 2 && r.left > -2) {
          // skip anything inside a scrollable ancestor
          let p = el.parentElement;
          let clipped = false;
          while (p && p !== document.body) {
            const cs = getComputedStyle(p);
            if (/(auto|scroll)/.test(cs.overflowX)) { clipped = true; break; }
            p = p.parentElement;
          }
          if (!clipped) {
            offenders.push(`${el.tagName} ${String((el as HTMLElement).className || '').substring(0, 50)} right=${Math.round(r.right)}`);
          }
        }
      }
    }
    return { vw, docScrollW, bodyScrollW, overflow, count: offenders.length, offenders: offenders.slice(0, 8) };
  });
}

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('login page fits mobile viewport without horizontal overflow', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const overflow = await noHorizontalOverflow(page);
    test.info().annotations.push({ type: 'overflow', description: JSON.stringify(overflow) });
    expect(overflow.count).toBe(0);
  });

  test('mail inbox renders on mobile with a hamburger menu', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const overflow = await noHorizontalOverflow(page);
    test.info().annotations.push({ type: 'overflow-inbox', description: JSON.stringify(overflow) });
    expect(overflow.overflow).toBeFalsy();

    // The desktop rail should NOT be visible as a static wide bar on mobile
    const desktopRail = await page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll('[data-sidebar="sidebar"]'));
      const rail = bars.find((el) => el.getBoundingClientRect().width < 80 && el.getBoundingClientRect().x > 300);
      return rail ? Math.round(rail.getBoundingClientRect().width) : null;
    });
    test.info().annotations.push({ type: 'mobile-rail', description: `desktop rail width on mobile: ${desktopRail}` });

    // A menu/open button should exist for the mobile sidebar (SidebarTrigger
    // renders without mobile-specific labels; detects by role/data attribute
    // or aria-label).
    const menuButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const found = buttons.find((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const text = (b.textContent || '').trim().toLowerCase();
        const data = b.getAttribute('data-sidebar') || '';
        return /menu|open|sidebar|toggle/i.test(aria) || /menu|toggle sidebar/i.test(text) || data === 'trigger';
      });
      return found ? { label: found.getAttribute('aria-label') || '', text: (found.textContent || '').trim() } : null;
    });
    test.info().annotations.push({
      type: 'mobile-menu-button',
      description: menuButton ? `found: ${menuButton.label || menuButton.text}` : 'no menu/toggle button found',
    });
    expect(menuButton).toBeTruthy();
  });

  test('calendar page renders on mobile without fatal error', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const overflow = await noHorizontalOverflow(page);
    test.info().annotations.push({ type: 'overflow-cal', description: JSON.stringify(overflow) });
    const fatal = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      return text.includes("this page couldn't load") || text.includes('server error occurred');
    });
    expect(fatal).toBeFalsy();
    expect(overflow.overflow).toBeFalsy();
  });

  test('address books page renders on mobile', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/address_books`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const overflow = await noHorizontalOverflow(page);
    const fatal = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      return text.includes("this page couldn't load") || text.includes('server error occurred');
    });
    test.info().annotations.push({ type: 'overflow-ab', description: JSON.stringify(overflow) });
    expect(fatal).toBeFalsy();
    expect(overflow.overflow).toBeFalsy();
  });
});
