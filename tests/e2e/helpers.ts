// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

// Re-export Playwright test utilities
export { test, expect } from '@playwright/test';

// =============================================================================
// Constants - matching calendar-depth.spec.ts
// =============================================================================

export const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
export const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
export const API_BASE = 'https://sogo6.contextual-intelligence.org';

export const REMOTE_CREDENTIALS = {
  email: 'testuser2@sogo6.contextual-intelligence.org',
  password: 'password123',
};

export const CREDENTIALS = {
  user: REMOTE_CREDENTIALS,
  admin: {
    username: 'admin',
    password: '3fb7db8074230771',
  },
};

export const ROUTES = {
  login: '/en/auth/login',
  loginPwd: '/en/auth/login/pwd',
  adminPanel: '/en/admin_panel',
};

// /env response body (mirrors the live server response exactly)
export function envBody(): Record<string, unknown> {
  return {
    REACT_APP_API_BASE_URL: REMOTE_API,
    NEXT_PUBLIC_ADMIN_DOMAINS: 'contextual-intelligence.org',
    SSE_ENABLED: true,
    LOGIN_PREFILL_EMAIL: REMOTE_CREDENTIALS.email,
    LOGIN_PREFILL_PASSWORD: REMOTE_CREDENTIALS.password,
  };
}

// =============================================================================
// Route Interception - serves a static /env body (no route.fetch, so it is
// immune to "Response has been disposed" errors and never hits the live API)
// =============================================================================

export async function setupRemoteEnvInterception(page: any) {
  await page.route('**/env', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envBody()),
    });
  });
}

// Alias for backward compatibility
export const setupEnvInterception = setupRemoteEnvInterception;

// =============================================================================
// Login functions
// =============================================================================

export async function loginToRemote(page: any) {
  await setupRemoteEnvInterception(page);
  await page.goto(REMOTE_BASE + '/en/auth/login');
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });

  // Step 1: Enter email
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(REMOTE_CREDENTIALS.email);
  await emailInput.press('Enter');

  // Wait for password step
  await page.waitForTimeout(2000);

  // Step 2: Enter password
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(REMOTE_CREDENTIALS.password);
    await pwdInput.press('Enter');
  }

  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

export const loginAsUser = loginToRemote;

export async function loginAsAdmin(page: any) {
  await setupRemoteEnvInterception(page);
  await page.goto(REMOTE_BASE + '/en/auth/login');
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });

  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.admin.username + '@sogo6.contextual-intelligence.org');
  await emailInput.press('Enter');

  await page.waitForTimeout(2000);

  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.admin.password);
    await pwdInput.press('Enter');
  }

  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

// Token retrieval after UI login — token lives in sessionStorage under 'sogo_auth'
export async function getAuthToken(page: any): Promise<string> {
  const token = await page.evaluate(() => {
    return (
      sessionStorage.getItem('sogo_auth') ||
      localStorage.getItem('sogo_auth') ||
      ''
    );
  });
  if (!token) {
    throw new Error('Failed to extract auth token from browser storage');
  }
  return token;
}

export async function getAdminToken(page: any): Promise<string> {
  await loginAsAdmin(page);
  return getAuthToken(page);
}

export async function getUserToken(page: any): Promise<string> {
  await loginToRemote(page);
  return getAuthToken(page);
}
