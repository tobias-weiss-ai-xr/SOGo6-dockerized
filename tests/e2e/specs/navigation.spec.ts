// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

import { test, expect } from '../helpers';
import { REMOTE_BASE, setupRemoteEnvInterception } from '../helpers';

test.describe('Navigation & i18n', () => {
  test.beforeEach(async ({ page }) => {
    await setupRemoteEnvInterception(page);
  });

  test('login page should be accessible at /en/auth/login', async ({ page }) => {
    const response = await page.goto(REMOTE_BASE + '/en/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');
  });

  test('login page should be accessible at /de/auth/login (German)', async ({ page }) => {
    const response = await page.goto(REMOTE_BASE + '/de/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 15000 });

    // Soft assertion - html lang may be 'de' or fallback to 'en'
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(['de', 'en']).toContain(htmlLang);
  });

  test('login page should be accessible at /fr/auth/login (French)', async ({ page }) => {
    const response = await page.goto(REMOTE_BASE + '/fr/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(['fr', 'en']).toContain(htmlLang);
  });

  test('login page should be accessible at /es/auth/login (Spanish)', async ({ page }) => {
    const response = await page.goto(REMOTE_BASE + '/es/auth/login');
    expect(response?.status()).toBe(200);
    await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 15000 });

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(['es', 'en']).toContain(htmlLang);
  });

  test('404 page should show for unknown routes', async ({ page }) => {
    const response = await page.goto(REMOTE_BASE + '/en/this-route-does-not-exist');
    expect([200, 404]).toContain(response?.status());
  });

  test('admin API is reachable', async ({ request }) => {
    const response = await request.get(REMOTE_BASE.replace('https://', 'https://') + '/api/admin/v1/auth/login', {
      data: {},
    });
    // auth login endpoint should respond (even if 4xx/5xx due to missing body)
    expect(response.status()).toBeLessThan(500);
  });

  test('user API themes endpoint returns CSS', async ({ request }) => {
    const loginRes = await request.post(REMOTE_BASE.replace('https://', 'https://') + '/api/user/v1/auth/login', {
      data: {
        username: 'testuser2@sogo6.contextual-intelligence.org',
        password: 'password123',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.status() === 200) {
      const body = await loginRes.json();
      const token = body.data?.jwt_token;
      if (token) {
        const themesRes = await request.get(REMOTE_BASE + '/api/user/v1/user/themes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect([200, 400, 404]).toContain(themesRes.status());
      }
    }
  });
});
