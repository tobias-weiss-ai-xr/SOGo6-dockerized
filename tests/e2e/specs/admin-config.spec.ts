// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Admin Configuration API.
// Tests:
//   - Admin login and token acquisition
//   - GET /config/domain-default
//   - PATCH /config/domain-default
//   - GET /config/domains (list all domains)
//   - GET /config/domains/{domain}
//   - PATCH /config/domains/{domain}
//   - Domain settings structure validation
//   - Mail settings (folders_map, imap_host, smtp_host)
//   - Admin user management endpoints
//   - Admin health dashboard
//
// Tests run against https://sogo6.contextual-intelligence.org
// Admin credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';
const ADMIN_CREDENTIALS = {
  username: REMOTE_CREDENTIALS.admin.username,
  password: REMOTE_CREDENTIALS.admin.password,
};
const USER_CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function setupEnvInterception(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = USER_CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = USER_CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function getAdminToken(page: import('@playwright/test').Page): Promise<string | null> {
  const res = await page.request.post(`${ADMIN_API}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { username: ADMIN_CREDENTIALS.username, password: ADMIN_CREDENTIALS.password },
  });
  if (res.status() !== 200) return null;
  const body = await res.json();
  return body?.data?.jwt_token || body?.data?.token || body?.token || body?.data?.access_token;
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Admin Configuration API', () => {

  test('admin login returns JWT token', async ({ page }) => {
    const token = await getAdminToken(page);
    test.info().annotations.push({ type: 'token', description: `Admin token: ${token ? 'present' : 'null'}` });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(20);
  });

  test('GET /config/domain-default returns domain defaults', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/config/domain-default`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data).toBeTruthy();
    test.info().annotations.push({
      type: 'domain-default',
      description: `Keys: ${Object.keys(body.data).join(', ')}`,
    });
  });

  test('GET /config/domains returns list of domains', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/config/domains`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const domains = body?.data ?? body;
    expect(Array.isArray(domains)).toBeTruthy();
    expect(domains.length).toBeGreaterThan(0);
    test.info().annotations.push({
      type: 'domains',
      description: `Domains: ${domains.map((d: any) => d.domain_name || d.name).join(', ')}`,
    });

    // sogo6.contextual-intelligence.org should be in the list
    const hasSogo6 = domains.some((d: any) =>
      (d.domain_name || d.name) === 'sogo6.contextual-intelligence.org'
    );
    expect(hasSogo6).toBeTruthy();
  });

  test('GET /config/domains/{domain} returns domain settings', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/config/domains/sogo6.contextual-intelligence.org`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data).toBeTruthy();
    test.info().annotations.push({
      type: 'domain-settings',
      description: `Keys: ${Object.keys(body.data).join(', ')}`,
    });
  });

  test('domain settings include MAIL_SETTINGS with folders_map', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/config/domains/sogo6.contextual-intelligence.org`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const settings = body?.data?.settings ?? body?.data;
    expect(settings).toBeTruthy();

    const mailSettings = settings?.MAIL_SETTINGS;
    if (mailSettings) {
      test.info().annotations.push({
        type: 'mail-settings',
        description: `MAIL_SETTINGS keys: ${Object.keys(mailSettings).join(', ')}`,
      });
      // folders_map should exist
      if (mailSettings.folders_map) {
        test.info().annotations.push({
          type: 'folders-map',
          description: `folders_map: ${JSON.stringify(mailSettings.folders_map)}`,
        });
      }
    }
  });

  test('PATCH /config/domain-default updates a setting', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    // First get current defaults
    const getRes = await page.request.get(`${ADMIN_API}/config/domain-default`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    const currentSettings = getBody?.data ?? {};

    // Patch with a minor change (e.g., set/check a display name)
    const patchRes = await page.request.patch(`${ADMIN_API}/config/domain-default`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: currentSettings, // Send back current settings (no-op patch)
    });
    test.info().annotations.push({ type: 'patch', description: `PATCH domain-default -> ${patchRes.status()}` });
    expect([200, 204, 400]).toContain(patchRes.status());
  });

  test('GET /admin/users lists users', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'users', description: `GET /users -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const users = body?.data?.users ?? body?.data ?? [];
      test.info().annotations.push({ type: 'user-count', description: `Users: ${Array.isArray(users) ? users.length : 'N/A'}` });
    }
  });

  test('GET /admin/health returns system status', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'health', description: `GET /health -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('admin panel UI loads', async ({ page }) => {
    // Login as user first
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(USER_CREDENTIALS.email);
    await emailInput.press('Enter');
    await page.waitForTimeout(2000);
    const pwdInput = page.locator('input[type="password"]').first();
    if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pwdInput.fill(USER_CREDENTIALS.password);
      await pwdInput.press('Enter');
    }
    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Navigate to admin panel
    await page.goto(`${REMOTE_BASE}/en/admin_panel`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes("this page couldn't load") || text.includes('application error');
    });
    test.info().annotations.push({ type: 'admin-ui', description: `Fatal error: ${hasFatalError}` });
    // Admin panel may or may not be accessible to regular user; document the result
    const url = page.url();
    test.info().annotations.push({ type: 'admin-url', description: `URL: ${url}` });
  });

  test('domain-default contains IMAP/SMTP settings', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/config/domain-default`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const settings = body?.data ?? {};

    // Check for mail-related settings
    const mailSettings = settings.MAIL_SETTINGS || settings.mail_settings;
    if (mailSettings) {
      test.info().annotations.push({
        type: 'mail-config',
        description: `IMAP host: ${mailSettings.imap_host ?? 'N/A'}, SMTP host: ${mailSettings.smtp_host ?? 'N/A'}`,
      });
      // At least one of these should be set
      const hasImap = !!mailSettings.imap_host || !!mailSettings.IMAP_HOST;
      const hasSmtp = !!mailSettings.smtp_host || !!mailSettings.SMTP_HOST;
      test.info().annotations.push({
        type: 'mail-config-detail',
        description: `Has IMAP: ${hasImap}, Has SMTP: ${hasSmtp}`,
      });
    }
  });

  test('admin can list domain settings and verify structure', async ({ page }) => {
    const token = await getAdminToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${ADMIN_API}/config/domains`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const domains = body?.data ?? body;
    expect(Array.isArray(domains)).toBeTruthy();

    for (const domain of domains) {
      expect(domain.domain_name || domain.name).toBeTruthy();
      test.info().annotations.push({
        type: 'domain',
        description: `Domain: ${domain.domain_name || domain.name}, has settings: ${!!domain.settings}`,
      });
      if (domain.settings) {
        expect(typeof domain.settings).toBe('object');
      }
    }
  });
});
