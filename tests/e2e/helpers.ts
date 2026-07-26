// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Shared test utilities and fixtures for SOGo E2E tests.

import { test as base, expect as baseExpect } from '@playwright/test';
import path from 'path';

// Re-export full test and expect objects
export const test = base;
export const expect = baseExpect;

// ── Constants ──────────────────────────────────────────────
export const UI_BASE = 'http://localhost:3000';
export const API_BASE = 'http://localhost:5001';

export const CREDENTIALS = {
  user: {
    email: 'testuser@example.org',
    password: 'password123',
  },
  admin: {
    username: 'admin',
    password: 'admin',
  },
};

export const ROUTES = {
  login: '/en/auth/login',
  loginPwd: '/en/auth/login/pwd',
  adminPanel: '/en/admin_panel',
  adminSystem: '/en/admin_panel/system',
  adminTheme: '/en/admin_panel/theme',
  adminUsers: '/en/admin_panel/users',
  adminSessions: '/en/admin_panel/sessions',
  adminRules: '/en/admin_panel/rules',
  adminCustomDomains: '/en/admin_panel/domains/custom_domains',
  adminDomainDefault: '/en/admin_panel/domains/default',
  userSettings: '/en/user_settings',
  userProfile: '/en/user_settings/profile',
  userSecurity: '/en/user_settings/security',
  userGeneral: '/en/user_settings/general',
};

// ── Helpers ────────────────────────────────────────────────

/**
 * Intercept the /env endpoint to override the API base URL.
 * The default env response contains http://sogo6-server:5000 (Docker internal)
 * which is unreachable from the browser. We override it to localhost:5001.
 * Also preserves LOGIN_PREFILL_EMAIL/LOGIN_PREFILL_PASSWORD for tests.
 */
export async function setupEnvInterception(page: any) {
  await page.route('**/env', async (route: any) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = `${API_BASE}/api/user/v1`;
    // Ensure prefill values are set for tests
    if (!body.LOGIN_PREFILL_EMAIL) {
      body.LOGIN_PREFILL_EMAIL = CREDENTIALS.user.email;
    }
    if (!body.LOGIN_PREFILL_PASSWORD) {
      body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.user.password;
    }
    await route.fulfill({ response, body });
  });
}

/**
 * Perform login with the given user credentials.
 * Navigates through the two-step login flow:
 *   1. Enter email → submit
 *   2. Enter password → submit
 */
export async function loginAsUser(page: any) {
  await setupEnvInterception(page);
  await page.goto(ROUTES.login);
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });

  // Step 1: Enter email
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.user.email);
  await emailInput.press('Enter');

  // Wait for password step
  await page.waitForTimeout(2000);

  // Step 2: Enter password
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.user.password);
    await pwdInput.press('Enter');
  }

  // Wait for redirect to logged-in area
  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
}

/**
 * Navigate directly to the admin panel by logging in first.
 * The admin login uses POST to /api/admin/v1/auth/login, then stores the JWT
 * in localStorage for the UI to pick up.
 */
export async function loginAsAdmin(page: any) {
  // First set up env interception so the UI works
  await setupEnvInterception(page);

  // Login via API
  const response = await page.request.post(`${API_BASE}/api/admin/v1/auth/login`, {
    data: { username: CREDENTIALS.admin.username, password: CREDENTIALS.admin.password },
  });
  const body = await response.json();
  const token = body?.data?.jwt_token;
  if (!token) throw new Error(`Admin login failed: ${JSON.stringify(body)}`);

  // Store token in localStorage so the UI picks it up
  await page.goto(ROUTES.login);
  await page.evaluate((t) => {
    localStorage.setItem('admin_jwt_token', t);
    window.dispatchEvent(new Event('local-storage-admin-jwt'));
  }, token);

  // Navigate to admin panel
  await page.goto(ROUTES.adminPanel);
  await page.waitForTimeout(2000);
}

/**
 * Helper: wait for a toast notification to appear and check its text.
 */
export async function expectToast(page: any, text: string) {
  await page.waitForSelector('[role="status"], [role="alert"], .toast, [data-testid="toast"]', { timeout: 10000 });
  const toast = page.locator('[role="status"], [role="alert"], .toast, [data-testid="toast"]').first();
  await expect(toast).toContainText(text);
}
