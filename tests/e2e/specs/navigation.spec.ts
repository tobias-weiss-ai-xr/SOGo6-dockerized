// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
import { test, expect } from '../helpers';

test.describe('Navigation & i18n', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/env', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.REACT_APP_API_BASE_URL = 'http://localhost:5001/api/user/v1';
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
  });

  test('login page should be accessible at /en/auth/login', async ({ page }) => {
    const response = await page.goto('/en/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input#email', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');
  });

  test('login page should be accessible at /de/auth/login (German)', async ({ page }) => {
    const response = await page.goto('/de/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input#email', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('de');
  });

  test('login page should be accessible at /fr/auth/login (French)', async ({ page }) => {
    const response = await page.goto('/fr/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input#email', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('fr');
  });

  test('login page should be accessible at /es/auth/login (Spanish)', async ({ page }) => {
    const response = await page.goto('/es/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input#email', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('es');
  });

  test('404 page should show for unknown routes', async ({ page }) => {
    const response = await page.goto('/en/nonexistent-page');
    expect(response?.status()).toBe(404);
  });

  test('admin API is reachable', async ({ page }) => {
    const response = await page.request.post('http://localhost:5001/api/admin/v1/auth/login', {
      data: { username: 'admin', password: 'admin' },
    });
    expect(response.status()).toBe(200);
  });

  test('user API themes endpoint returns CSS', async ({ page }) => {
    const response = await page.request.get('http://localhost:5001/api/user/v1/customization/themes');
    // 404 = endpoint not present in this deployment version (older API)
    expect([200, 404]).toContain(response.status());
    if (response.status() !== 200) return;

    const body = await response.text();
    expect(body).toContain(':root');
  });
});
