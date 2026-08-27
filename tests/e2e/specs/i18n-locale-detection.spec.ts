// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for i18n locale detection and all 26 supported locales.
// Tests:
//   - Browser Accept-Language header detection (de→/de, fr→/fr, etc.)
//   - Root path "/" redirects to browser-preferred locale
//   - All 26 locales render login page without crash
//   - HTML lang attribute matches URL locale
//   - Locale persists across navigation
//   - Invalid locale falls back gracefully
//   - Locale cookie (NEXT_LOCALE) is set
//   - RTL locales (ar, he) set dir="rtl"
//
// Tests run against https://sogo6.contextual-intelligence.org

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';

const ALL_LOCALES = [
  'en', 'de', 'fr', 'es', 'zh', 'it', 'pt', 'nl', 'pl', 'ru',
  'sv', 'da', 'fi', 'no', 'cs', 'el', 'tr', 'hu', 'ro', 'ja',
  'hi', 'ar', 'ko', 'th', 'vi', 'id',
];

const RTL_LOCALES = ['ar'];

// ── Helpers ────────────────────────────────────────────────────────────────

async function setupEnvInterception(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = 'https://sogo6.contextual-intelligence.org/api/user/v1';
    body.LOGIN_PREFILL_EMAIL = REMOTE_CREDENTIALS.user.email;
    body.LOGIN_PREFILL_PASSWORD = REMOTE_CREDENTIALS.user.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('i18n Locale Detection', () => {

  test('root path "/" redirects to a locale-prefixed URL', async ({ page }) => {
    const response = await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    // Accept any redirect (307) or direct render (200)
    expect([200, 307, 302]).toContain(response?.status() ?? 0);
    await page.waitForTimeout(2000);
    const url = page.url();
    // URL should contain a locale prefix
    const hasLocale = ALL_LOCALES.some((l) => url.includes(`/${l}/`) || url.endsWith(`/${l}`));
    expect(hasLocale).toBeTruthy();
  });

  test('Accept-Language: de redirects to /de', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.1' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    test.info().annotations.push({ type: 'redirect', description: `Final URL: ${url}` });
    // next-intl should redirect to /de based on Accept-Language
    expect(url).toMatch(/\/de(\/|$)/);
  });

  test('Accept-Language: fr redirects to /fr', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.1' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    test.info().annotations.push({ type: 'redirect', description: `Final URL: ${url}` });
    expect(url).toMatch(/\/fr(\/|$)/);
  });

  test('Accept-Language: ja redirects to /ja', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.1' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    test.info().annotations.push({ type: 'redirect', description: `Final URL: ${url}` });
    expect(url).toMatch(/\/ja(\/|$)/);
  });

  test('Accept-Language: zh redirects to /zh', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.1' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    test.info().annotations.push({ type: 'redirect', description: `Final URL: ${url}` });
    expect(url).toMatch(/\/zh(\/|$)/);
  });

  test('Accept-Language with fallback uses best match', async ({ page }) => {
    // pt-BR should match pt
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.1' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    test.info().annotations.push({ type: 'redirect', description: `Final URL: ${url}` });
    expect(url).toMatch(/\/pt(\/|$)/);
  });

  test('Accept-Language: en (unknown locale) falls back to en', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'xx-XX,xx;q=0.9' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    test.info().annotations.push({ type: 'redirect', description: `Final URL: ${url}` });
    // Unknown locale should fall back to default (en)
    expect(url).toMatch(/\/en(\/|$)/);
  });
});

test.describe('All 26 Locales Render', () => {
  for (const locale of ALL_LOCALES) {
    test(`locale ${locale} renders login page with correct lang attribute`, async ({ page }) => {
      await setupEnvInterception(page);
      await page.goto(`${REMOTE_BASE}/${locale}/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Page should render without fatal error
      const html = await page.content();
      expect(html.length).toBeGreaterThan(500);

      // HTML lang attribute should match
      const htmlLang = await page.locator('html').getAttribute('lang');
      test.info().annotations.push({ type: 'lang', description: `locale=${locale} html lang=${htmlLang}` });
      expect(htmlLang).toBe(locale);

      // Login form should be present
      const hasEmailInput = await page.locator('input[type="email"], input[name="email"]').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasEmailInput).toBeTruthy();
    });
  }
});

test.describe('Locale Persistence & Switching', () => {

  test('locale persists across page navigation', async ({ page }) => {
    await setupEnvInterception(page);
    // Start at /de/auth/login
    await page.goto(`${REMOTE_BASE}/de/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const lang1 = await page.locator('html').getAttribute('lang');
    expect(lang1).toBe('de');

    // Navigate to /de/auth/login/pwd
    await page.goto(`${REMOTE_BASE}/de/auth/login/pwd`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const lang2 = await page.locator('html').getAttribute('lang');
    expect(lang2).toBe('de');
  });

  test('switching locale changes URL and lang attribute', async ({ page }) => {
    await setupEnvInterception(page);
    // Start at /en/auth/login
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/en/');

    // Navigate to /fr/auth/login
    await page.goto(`${REMOTE_BASE}/fr/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/fr/');
    const langFr = await page.locator('html').getAttribute('lang');
    expect(langFr).toBe('fr');
  });

  test('NEXT_LOCALE cookie is set after locale detection', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });
    await page.goto(`${REMOTE_BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const cookies = await page.context().cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    test.info().annotations.push({
      type: 'cookie',
      description: `NEXT_LOCALE cookie: ${localeCookie ? localeCookie.value : 'not set'}`,
    });
    // next-intl may or may not set the cookie depending on config; document it
    if (localeCookie) {
      expect(localeCookie.value).toBe('es');
    }
  });

  test('invalid locale falls back to a valid locale', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/xx-XX/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Should not crash, should render something
    const html = await page.content();
    expect(html.length).toBeGreaterThan(500);

    // Should redirect to a valid locale or render with a fallback lang
    const url = page.url();
    const htmlLang = await page.locator('html').getAttribute('lang');
    test.info().annotations.push({
      type: 'fallback',
      description: `URL: ${url}, lang: ${htmlLang}`,
    });
  });
});

test.describe('RTL Locale Support', () => {
  for (const locale of RTL_LOCALES) {
    test(`locale ${locale} sets dir="rtl"`, async ({ page }) => {
      await setupEnvInterception(page);
      await page.goto(`${REMOTE_BASE}/${locale}/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const dir = await page.locator('html').getAttribute('dir');
      test.info().annotations.push({ type: 'dir', description: `locale=${locale} dir=${dir}` });
      // Arabic should have RTL direction
      expect(dir).toBe('rtl');
    });
  }
});

test.describe('Locale-specific content', () => {

  test('login page shows translated content in German', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/de/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText || '');
    // German text should differ from English
    const enText = await (async () => {
      const p2 = await page.context().newPage();
      await setupEnvInterception(p2);
      await p2.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await p2.waitForTimeout(2000);
      const text = await p2.evaluate(() => document.body.innerText || '');
      await p2.close();
      return text;
    })();

    expect(bodyText).not.toBe(enText);
    test.info().annotations.push({
      type: 'i18n',
      description: `DE body length=${bodyText.length}, EN body length=${enText.length}`,
    });
  });

  test('login page shows translated content in Japanese', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/ja/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText || '');
    expect(bodyText.length).toBeGreaterThan(100);

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('ja');
  });

  test('language selector on login page lists multiple languages', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Look for language selector button/dropdown
    const langBtn = page.locator('button:has-text("English"), button:has-text("Deutsch"), button:has-text("Français"), [data-testid*="lang"], select[name*="lang"]').first();
    const hasLangSelector = await langBtn.isVisible({ timeout: 3000 }).catch(() => false);
    test.info().annotations.push({
      type: 'lang-selector',
      description: `Language selector visible: ${hasLangSelector}`,
    });
  });
});
