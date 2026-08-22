// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Tasks functionality on the live SOGo6 demo site.
// Verified against real API responses:
//   - GET /tasks -> { data: { tasks: [], total_count: 0 } }
//   - POST /tasks -> create task
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

async function getAuthToken(page: import('@playwright/test').Page): Promise<string | null> {
  return await page.evaluate(() => {
    const sogoAuth = sessionStorage.getItem('sogo_auth');
    if (sogoAuth) {
      try {
        const parsed = JSON.parse(sogoAuth);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await getAuthToken(page);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Tasks Functionality', () => {
  test.describe.configure({ mode: 'serial' });

  test('GET /tasks returns task list', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/tasks`, { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body?.data).toBeTruthy();
    expect(Array.isArray(body?.data?.tasks)).toBeTruthy();
    // Fresh demo may have 0 tasks
  });

  test('POST + DELETE task lifecycle', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // Get a calendar to create the task in (POST /tasks is not defined;
    // task creation is at /calendars/{key}/tasks)
    const calRes = await page.request.get(`${REMOTE_API}/calendars`, { headers });
    expect(calRes.status()).toBe(200);
    const calBody = await calRes.json();
    const calendars = calBody?.data?.calendars ?? [];
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;

    // Only title + description are accepted (status/priority/enum fields cause 422
    // if values don't match the schema exactly)
    const taskPayload = {
      title: 'E2E Test Task',
      description: 'Created by Playwright e2e test',
    };

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: taskPayload,
      headers,
    });
    expect([200, 201]).toContain(createRes.status());

    const createdBody = await createRes.json();
    const taskKey = createdBody?.data?.key ?? createdBody?.key;
    expect(taskKey).toBeTruthy();

    // Fetch the created task
    const getRes = await page.request.get(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect((getBody?.data ?? getBody).title).toBe('E2E Test Task');

    // Delete the task
    const delRes = await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    expect([200, 204]).toContain(delRes.status());
  });

  test('tasks page loads in UI without errors', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/tasks`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\u2019t load') ||
             text.includes("this page couldn't load");
    });

    await expect(page.locator('body')).toBeVisible();
    expect(hasFatalError).toBeFalsy();
  });
});
