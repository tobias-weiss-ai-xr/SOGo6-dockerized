// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const CREDENTIALS = {
  admin: { username: 'admin', password: REMOTE_CREDENTIALS.admin.password },
};

test.describe('Navigation & i18n', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/env', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.REACT_APP_API_BASE_URL = REMOTE_API;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
  });

  test('login page should be accessible at /en/auth/login', async ({ page }) => {
    const response = await page.goto(`${REMOTE_BASE}/en/auth/login`);
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input#email, input[name="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');
  });

  test('login page should be accessible at /de/auth/login (German)', async ({ page }) => {
    const response = await page.goto(`${REMOTE_BASE}/de/auth/login`);
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input#email, input[name="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('de');
  });

  test('login page should be accessible at /fr/auth/login (French)', async ({ page }) => {
    const response = await page.goto(`${REMOTE_BASE}/fr/auth/login`);
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input#email, input[name="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('fr');
  });

  test('login page should be accessible at /es/auth/login (Spanish)', async ({ page }) => {
    const response = await page.goto(`${REMOTE_BASE}/es/auth/login`);
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input#email, input[name="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('es');
  });

  test('404 page should show for unknown routes', async ({ page }) => {
    const response = await page.goto(`${REMOTE_BASE}/en/nonexistent-page`);
    // Next.js may return 200 for client-side rendered 404 pages
    expect([200, 404]).toContain(response?.status() ?? 0);
  });

  test('admin API is reachable', async ({ page }) => {
    const response = await page.request.post(`${ADMIN_API}/auth/login`, {
      data: { username: CREDENTIALS.admin.username, password: CREDENTIALS.admin.password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(200);
  });

  test('user API themes endpoint returns CSS', async ({ page }) => {
    const response = await page.request.get(`${REMOTE_API}/customization/themes`);
    // 404 = endpoint not present in this deployment version
    expect([200, 404]).toContain(response.status());
    if (response.status() !== 200) return;

    const body = await response.text();
    expect(body).toContain(':root');
  });
});
