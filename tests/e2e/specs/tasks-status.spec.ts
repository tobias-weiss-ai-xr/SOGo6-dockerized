// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Task Status Updates on the live SOGo6 demo.
//
// Verified API behavior:
//   - Task status values are LOWERCASE: needs_action | in_process | completed | cancelled
//     (uppercase "COMPLETED" triggers 422)
//   - PATCH /tasks/{key} {status:'completed', percent_complete:100} updates the task
//   - GET /tasks/{key} reflects the updated status
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

async function getCalendarKey(page: import('@playwright/test').Page) {
  const token = await getAuthToken(page);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await page.request.get(`${REMOTE_API}/calendars`, { headers });
  const calKey = (await res.json())?.data?.calendars?.[0]?.key;
  return { calKey, headers };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Task Status Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test('task can be completed via PATCH with lowercase status', async ({ page }) => {
    await loginAsUser(page);
    const { calKey, headers } = await getCalendarKey(page);

    // Create a task
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: { title: 'E2E Task Status Probe' },
      headers,
    });
    expect([200, 201]).toContain(createRes.status());
    const taskKey = (await createRes.json())?.data?.key;
    expect(taskKey).toBeTruthy();

    try {
      // Complete it (lowercase status values)
      const patchRes = await page.request.patch(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, {
        data: { status: 'completed', percent_complete: 100 },
        headers,
      });
      expect(patchRes.status()).toBe(200);

      // Verify via GET
      const getRes = await page.request.get(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
      expect(getRes.status()).toBe(200);
      const body = await getRes.json();
      const task = body?.data ?? body;
      expect(['completed', 'COMPLETED']).toContain(task.status);

      // Percent complete reflects 100
      const pct = task.percent_complete ?? task.percentComplete;
      if (pct !== null && pct !== undefined) {
        expect(Number(pct)).toBe(100);
      }
    } finally {
      await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    }
  });

  test('uppercase status value is rejected with 422 (documented)', async ({ page }) => {
    await loginAsUser(page);
    const { calKey, headers } = await getCalendarKey(page);

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: { title: 'E2E Uppercase Status Probe' },
      headers,
    });
    const taskKey = (await createRes.json())?.data?.key;

    try {
      const patchRes = await page.request.patch(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, {
        data: { status: 'COMPLETED' },
        headers,
      });
      expect(patchRes.status()).toBe(422);
      const body = await patchRes.json();
      const message = JSON.stringify(body);
      // The error should mention the allowed status values
      expect(message).toMatch(/needs_action|in_process|completed|cancelled/);
    } finally {
      await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    }
  });

  test('tasks in_progress status is accepted', async ({ page }) => {
    await loginAsUser(page);
    const { calKey, headers } = await getCalendarKey(page);

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: { title: 'E2E In-Progress Probe' },
      headers,
    });
    const taskKey = (await createRes.json())?.data?.key;

    try {
      const patchRes = await page.request.patch(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, {
        data: { status: 'in_process', percent_complete: 50 },
        headers,
      });
      expect(patchRes.status()).toBe(200);

      const getRes = await page.request.get(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
      const task = (await getRes.json())?.data ?? {};
      expect(['in_process', 'IN_PROCESS']).toContain(task.status);
    } finally {
      await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    }
  });
});
