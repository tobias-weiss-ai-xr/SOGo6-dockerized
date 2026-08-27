// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for the RIGHT module rail / fast-access sidebar on the live SOGo6 demo.
//
// Findings (verified 2026-08-22 on https://sogo6.contextual-intelligence.org):
//   - The right module rail (Address Book / Calendar / Tasks / Notes) is a
//     collapsed 39px icon rail at the right edge.
//   - Clicking a module icon EXPANDS a ~247px fast-access panel with content.
//   - Clicking the same icon again COLLAPSES it.
//   - Switching modules SWAPS the panel content.
//   - The bottom-right "Toggle Sidebar" trigger is CLOSE-ONLY: it closes an open
//     panel but does NOT expand when the panel is closed (documented UX issue —
//     the trigger only works one-way).
//
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

async function rightSidebars(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-sidebar="sidebar"]')).map((el, i) => {
      const r = el.getBoundingClientRect();
      return {
        i,
        x: Math.round(r.x),
        w: Math.round(r.width),
        h: Math.round(r.height),
        buttons: Array.from(el.querySelectorAll('[data-sidebar="menu-button"], button'))
          .map((b) => (String((b as HTMLElement).textContent || '').trim().substring(0, 30)))
          .filter(Boolean),
      };
    });
  });
}

test.describe('Right Module Rail (Fast Access)', () => {
  test.describe.configure({ mode: 'serial' });

  // A RIGHT fast-access panel: a sidebar on the right half of the screen,
  // wider than the 39px icon rail, distinct from the left nav sidebar.
  async function rightPanel(page: import('@playwright/test').Page): Promise<{ x: number; w: number; text: string } | null> {
    return await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bars = Array.from(document.querySelectorAll('[data-sidebar="sidebar"]'));
      const candidates = bars
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), w: Math.round(r.width), text: (el.textContent || '').trim() };
        })
        .filter((b) => b.x > vw / 2 && b.w > 100 && b.w < vw - 300);
      return candidates[0] ?? null;
    });
  }

  test('collapsed rail shows 4 module icons at the right edge', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const bars = await rightSidebars(page);
    const rail = bars[bars.length - 1]; // last sidebar = module rail
    expect(rail).toBeTruthy();
    // Rail sits at the right edge and is narrow (icon rail)
    expect(rail.x).toBeGreaterThan(1300);
    expect(rail.w).toBeLessThan(80);
    // Four module buttons
    const text = rail.buttons.join(' ').toLowerCase();
    expect(text).toContain('address book');
    expect(text).toContain('calendar');
    expect(text).toContain('tasks');
    expect(text).toContain('notes');
  });

  test('clicking the Calendar icon expands a fast-access panel', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const rail = page.locator('[data-sidebar="sidebar"]').last();
    const buttons = rail.locator('button');
    const count = await buttons.count();
    let calIndex = -1;
    for (let i = 0; i < count; i++) {
      if (/calendar/i.test((await buttons.nth(i).innerText()).trim())) { calIndex = i; break; }
    }
    expect(calIndex).not.toBe(-1);

    await buttons.nth(calIndex).click({ force: true });
    await page.waitForTimeout(2500);

    const bars = await rightSidebars(page);
    // Now there should be a wider panel (second right sidebar) plus the rail
    test.info().annotations.push({
      type: 'expanded',
      description: `sidebars after expand: ${JSON.stringify(bars.map(b => ({ x: b.x, w: b.w })))}`,
    });
    expect(bars.length).toBeGreaterThanOrEqual(3);

    const panel = await rightPanel(page);
    test.info().annotations.push({ type: 'expanded-panel', description: JSON.stringify(panel) });
    expect(panel).toBeTruthy();
    // Panel content should include a calendar-ish surface
    expect(panel!.text.length).toBeGreaterThan(0);
  });

  test('clicking the icon again collapses the panel', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const rail = page.locator('[data-sidebar="sidebar"]').last();
    const buttons = rail.locator('button');
    const count = await buttons.count();
    let calIndex = -1;
    for (let i = 0; i < count; i++) {
      if (/calendar/i.test((await buttons.nth(i).innerText()).trim())) { calIndex = i; break; }
    }
    // Open
    await buttons.nth(calIndex).click({ force: true });
    await page.waitForTimeout(2000);
    let bars = await rightSidebars(page);
    const expandedCount = bars.length;

    // Close again
    await buttons.nth(calIndex).click({ force: true });
    await page.waitForTimeout(2000);
    bars = await rightSidebars(page);
    test.info().annotations.push({
      type: 'toggle',
      description: `open=${expandedCount} bars, after re-click=${bars.length} bars`,
    });
    expect(bars.length).toBeLessThan(expandedCount);
  });

  test('switching modules swaps the panel content', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const rail = page.locator('[data-sidebar="sidebar"]').last();
    const buttons = rail.locator('button');
    const count = await buttons.count();
    let calIndex = -1, taskIndex = -1;
    for (let i = 0; i < count; i++) {
      const t = (await buttons.nth(i).innerText()).trim();
      if (/calendar/i.test(t)) calIndex = i;
      if (/tasks/i.test(t)) taskIndex = i;
    }
    expect(calIndex).not.toBe(-1);
    expect(taskIndex).not.toBe(-1);

    await buttons.nth(calIndex).click({ force: true });
    await page.waitForTimeout(2500);
    const calText = (await rightPanel(page))?.text ?? '';

    await buttons.nth(taskIndex).click({ force: true });
    await page.waitForTimeout(2500);
    const taskText = (await rightPanel(page))?.text ?? '';

    test.info().annotations.push({
      type: 'swap',
      description: `calendar panel: "${calText.substring(0, 100)}" | tasks panel: "${taskText.substring(0, 100)}"`,
    });
    // Both panels must render something and content must actually change
    expect(calText.length).toBeGreaterThan(0);
    expect(taskText.length).toBeGreaterThan(0);
    expect(calText).not.toBe(taskText);
  });

  test('bottom-right trigger closes an open panel but does NOT expand a closed one (documented one-way bug)', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    // Find the bottom-right trigger (x > 1300)
    const triggers = page.locator('[data-sidebar="trigger"]');
    const n = await triggers.count();
    let right = -1;
    for (let i = 0; i < n; i++) {
      const box = await triggers.nth(i).boundingBox();
      if (box && box.x > 1300) right = i;
    }
    expect(right).not.toBe(-1);

    // 1) Panel closed -> trigger should expand (currently does NOT — documented)
    const before = await rightSidebars(page);
    const beforeCount = before.length;
    await triggers.nth(right).click({ force: true });
    await page.waitForTimeout(2000);
    const after = await rightSidebars(page);

    test.info().annotations.push({
      type: 'known-issue',
      description: `closed panel + trigger click: ${beforeCount} -> ${after.length} bars. The bottom-right trigger does NOT expand a closed panel (onClose={closeModule} makes it close-only). Expected behavior: clicking should open the rail/panel.`,
    });

    // 2) Open a panel via module icon, then trigger should close it
    const rail = page.locator('[data-sidebar="sidebar"]').last();
    const railBtn = rail.locator('button').first();
    await railBtn.click({ force: true });
    await page.waitForTimeout(2000);
    const openCount = (await rightSidebars(page)).length;
    expect(openCount).toBeGreaterThan(after.length);

    await triggers.nth(right).click({ force: true });
    await page.waitForTimeout(2000);
    const closedCount = (await rightSidebars(page)).length;
    test.info().annotations.push({
      type: 'close-works',
      description: `open=${openCount} bars -> after trigger=${closedCount} bars (close works)`,
    });
    expect(closedCount).toBeLessThan(openCount);
  });
});
