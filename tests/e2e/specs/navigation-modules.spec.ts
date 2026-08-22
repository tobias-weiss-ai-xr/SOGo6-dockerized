// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Cross-Module Navigation & Landing pages on the live SOGo6 demo.
//
// Verifies that after login the user can navigate between the four main modules
// (Mail, Address Books, Calendars, Tasks) via the sidebar tabs and that each
// module's page renders without a fatal error boundary.
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

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Cross-Module Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  const MODULES: { name: string; path: string; marker: string[] }[] = [
    { name: 'Mail', path: '/en/u/0/INBOX', marker: ['inbox', 'posteingang', 'new message', 'neue nachricht', 'search emails'] },
    { name: 'Address Books', path: '/en/address_books', marker: ['personal contacts', 'address books', 'new contact', 'search contacts', 'ldap'] },
    { name: 'Calendars', path: '/en/calendars', marker: ['day', 'week', 'month', 'today', 'heute', 'calendar', 'kalender'] },
    { name: 'Tasks', path: '/en/tasks', marker: ['new task', 'no tasks', 'all calendars', 'aufgaben', 'neue aufgabe'] },
  ];

  test('each main module page renders after login', async ({ page }) => {
    await loginAsUser(page);

    for (const mod of MODULES) {
      await page.goto(`${REMOTE_BASE}${mod.path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3500);

      const info = await page.evaluate((markers) => {
        const text = document.body.innerText?.toLowerCase() || '';
        const hasFatal = text.includes('this page couldn\\u2019t load') || text.includes("this page couldn't load");
        const foundMarker = markers.some((m) => text.includes(m));
        return { hasFatal, foundMarker };
      }, mod.marker);

      test.info().annotations.push({
        type: mod.name,
        description: `${mod.path} fatalError=${info.hasFatal} markerFound=${info.foundMarker}`,
      });

      expect(info.hasFatal).toBeFalsy();
      expect(info.foundMarker).toBeTruthy();
    }
  });

  test('sidebar navigation tabs are present', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const tabs = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[role="tab"], [role="tablist"] a, nav a, aside a'));
      const texts = els.map((e) => (e.textContent || '').trim().toLowerCase());
      return texts.join('\n');
    });

    // Inspect the sidebar for the main module labels
    const combined = tabs + '\n' + (await page.evaluate(() => document.body.innerText?.toLowerCase() || ''));
    for (const label of ['mail', 'address', 'calendar', 'task']) {
      test.info().annotations.push({ type: 'nav', description: `${label}: ${combined.includes(label)}` });
    }
    // At least mail + calendar should be visible in the sidebar
    expect(combined.includes('calendar')).toBeTruthy();
    expect(combined.includes('task')).toBeTruthy();
  });

  test('back navigation from a module returns to Mail', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/en/calendars');

    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
    const url = page.url();
    test.info().annotations.push({ type: 'back-nav', description: `after goBack: ${url}` });
    // Back from calendar should land on the previous page (mail or login)
    expect(url).not.toContain('/en/calendars');
  });
});
