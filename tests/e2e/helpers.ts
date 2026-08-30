// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Shared test utilities and fixtures for SOGo E2E tests.

import { test as base, expect as baseExpect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// ── Minimal .env loader (no external dependency) ──────────────────────────
// Loads tests/e2e/.env (gitignored) so secrets never live in source code.
// Process env takes precedence over the file (CI-friendly).
function loadDotEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  const envPath = path.join(__dirname, '.env');
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/) ) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
  } catch {
    /* .env absent — fall through to process.env */
  }
  return vars;
}

const envFile = loadDotEnv();
function secret(key: string): string {
  return process.env[key] ?? envFile[key] ?? '';
}


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
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
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

// ── Remote (live demo) helpers for Tier-0 / SOTA coverage ──────────────────
// These are used by the six-sigma Tier-0 spec files. They rely on the shared
// Playwright context and are safe to use in addition to the local helpers above.

export const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
export const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
export const ADMIN_API = 'https://sogo6.contextual-intelligence.org/api/admin/v1';

// Credentials are loaded from tests/e2e/.env (gitignored) — never commit
// real secrets to source. If they are missing, tests that need live login
// will report a clear error instead of silently using stale values.
export const REMOTE_CREDENTIALS = {
  user: {
    email: secret('REMOTE_USER_EMAIL'),
    password: secret('REMOTE_USER_PASSWORD'),
  },
  admin: {
    username: secret('REMOTE_ADMIN_USERNAME'),
    password: secret('REMOTE_ADMIN_PASSWORD'),
  },
};

if (!REMOTE_CREDENTIALS.user.email || !REMOTE_CREDENTIALS.user.password) {
  console.warn('[helpers] REMOTE user credentials missing — set REMOTE_USER_EMAIL/REMOTE_USER_PASSWORD in tests/e2e/.env');
}

/**
 * Intercept /env and prefill the remote credentials so the login form is
 * pre-filled (one Enter on the email step is usually enough).
 */
export async function remoteEnvInterception(page: any) {
  await page.route('**/env', async (route: any) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = REMOTE_CREDENTIALS.user.email;
    body.LOGIN_PREFILL_PASSWORD = REMOTE_CREDENTIALS.user.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

/** Log into the live demo as the regular test user. */
export async function loginRemoteUser(page: any) {
  await remoteEnvInterception(page);
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  await emailInput.fill(REMOTE_CREDENTIALS.user.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(REMOTE_CREDENTIALS.user.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

/** Read the JWT out of sessionStorage (sogo_auth JSON blob). */
export async function remoteUserToken(page: any): Promise<string | null> {
  return await page.evaluate(() => {
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) return parsed.token;
      } catch {
        /* ignore */
      }
    }
    return null;
  });
}

/** Admin login via the v1 admin API; returns the jwt_token (or null). */
export async function loginRemoteAdmin(page: any): Promise<string | null> {
  try {
    const res = await page.request.post(`${ADMIN_API}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { username: REMOTE_CREDENTIALS.admin.username, password: REMOTE_CREDENTIALS.admin.password },
    });
    const body = await res.json().catch(() => ({}));
    return body?.data?.jwt_token ?? body?.data?.token ?? null;
  } catch {
    return null;
  }
}

/** Local admin password: env override first (CI-friendly), then the gitignored
 * vault file (secrets/sogo6.vault.env). Returns '' when unavailable so specs
 * can skip cleanly. */
export function adminPassword(): string {
  if (process.env.SOGO_ADMIN_PASSWORD) return process.env.SOGO_ADMIN_PASSWORD;
  try {
    const vault = fs.readFileSync(
      path.join(__dirname, '..', '..', 'secrets', 'sogo6.vault.env'),
      'utf8',
    );
    for (const line of vault.split(/\r?\n/)) {
      const m = line.match(/^SOGO_P_ADMIN_PWD\s*=\s*(.+)$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* vault file absent on other machines */
  }
  return '';
}

/** Convenience: standard auth headers for API calls. */
export function bearer(token: string | null, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

// ── Local-mail seeding ────────────────────────────────────────────────────
// Stalwart refuses foreign TLS connections (empty banner), so test mail must
// be injected from its OWN network namespace. These helpers shell out to a
// small python tool that runs inside `container:sogo6-stalwart` and log into
// IMAPS on localhost:993 (the trusted, app-equivalent path). Local-only.

const SEED_SCRIPT = path.join(__dirname, 'scripts', 'mail-seed.py');
export const LOCAL_MAIL_MARKER = '[local-e2e] ';

export interface SeedResult {
  ok: boolean;
  out: string;
}

/** Run a mail-seed.py command inside the stalwart network namespace. */
export function localMailSeed(cmd: string): SeedResult {
  try {
    const out = execSync(
      `docker run --rm -v "${SEED_SCRIPT}":/s.py --network container:sogo6-stalwart ` +
        `python:3.12-slim python /s.py ${cmd}`,
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, shell: '/bin/sh' },
    ).toString();
    return { ok: true, out };
  } catch (e: any) {
    return { ok: false, out: String(e?.stdout || e?.message || e) };
  }
}

/** Append a unique message to the local INBOX (subject is marker-prefixed). */
export function seedLocalMail(subject: string, opts: { seen?: boolean; flagged?: boolean } = {}): SeedResult {
  const flags = `${opts.seen ? ' --seen' : ''}${opts.flagged ? ' --flagged' : ''}`;
  return localMailSeed(`append --subject "${subject}"${flags}`);
}

/**
 * Append several marker-prefixed messages over a SINGLE IMAP session.
 * entries: {name, seen?, flagged?}[] — one session = far less stalwart churn
 * (fresh connections can transiently see stale SELECT counts after appends).
 */
export function seedLocalMailBatch(entries: Array<{ name: string; seen?: boolean; flagged?: boolean }>): SeedResult {
  const items = entries
    .map((e) => `${e.name}${e.seen ? ':seen' : ''}${e.flagged ? ':flagged' : ''}`)
    .join(',');
  return localMailSeed(`batch --subjects "${items}"`);
}

/** Delete + expunge every locally-seeded (marker-prefixed) message. */
export function cleanupLocalMail(): SeedResult {
  return localMailSeed('cleanup');
}

/**
 * Role login via the v1 API (LDAP user bind). Accepts any directory user and
 * returns the real JWT. Used by the role/persona epic suites.
 */
export async function apiLogin(
  request: { post: (u: string, o?: any) => Promise<{ json: () => Promise<any>; status: () => number }> },
  username: string,
  password: string,
  base: string = REMOTE_API,
): Promise<string | null> {
  try {
    const res = await request.post(`${base}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { username, password },
    });
    const body = await res.json().catch(() => ({}));
    return body?.data?.jwt_token ?? body?.data?.token ?? body?.data?.access_token ?? null;
  } catch {
    return null;
  }
}

