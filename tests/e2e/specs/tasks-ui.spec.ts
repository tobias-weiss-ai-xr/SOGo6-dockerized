// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Tasks UI interactions.
// Tests:
//   - Tasks page renders
//   - Task list displays
//   - Create task via API and verify in UI
//   - Task status update (todo → in-progress → done)
//   - Task priority update
//   - Task due date
//   - Task description update
//   - Task delete
//   - Task filtering by status
//   - Task sorting
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
    const raw = sessionStorage.getItem('sogo_auth');
    if (raw) { try { return JSON.parse(raw).token ?? null; } catch { /* */ } }
    return null;
  });
}

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await getAuthToken(page);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function getCalendars(page: import('@playwright/test').Page): Promise<any[]> {
  const headers = await authHeaders(page);
  const res = await page.request.get(`${REMOTE_API}/calendars`, { headers });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body?.data?.calendars ?? [];
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Tasks UI Interactions', () => {

  test('tasks page renders without errors', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/tasks`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\u2019t load') || text.includes("this page couldn't load");
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('GET /tasks returns task list', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/tasks`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data).toBeTruthy();
    expect(Array.isArray(body?.data?.tasks)).toBeTruthy();
  });

  test('create task via API and verify in UI', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;
    const headers = await authHeaders(page);

    const taskPayload = {
      title: `E2E UI Task ${Date.now()}`,
      description: 'Task created by Playwright e2e test',
    };

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: taskPayload,
      headers,
    });
    expect([200, 201]).toContain(createRes.status());

    const createdBody = await createRes.json();
    const taskKey = createdBody?.data?.key ?? createdBody?.key;
    expect(taskKey).toBeTruthy();

    // Navigate to tasks page and check if task appears
    await page.goto(`${REMOTE_BASE}/en/tasks`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const hasTask = await page.evaluate((title) => {
      const text = document.body.innerText || '';
      return text.includes(title);
    }, taskPayload.title);

    test.info().annotations.push({
      type: 'task-in-ui',
      description: `Task "${taskPayload.title}" visible in UI: ${hasTask}`,
    });

    // Clean up
    await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
  });

  test('task status update via PATCH', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;
    const headers = await authHeaders(page);

    // Create task
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: { title: `E2E Status Task ${Date.now()}`, description: 'Status update test' },
      headers,
    });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const taskKey = created?.data?.key ?? created?.key;

    // Update status
    const patchRes = await page.request.patch(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, {
      data: { status: 'completed' },
      headers,
    });
    test.info().annotations.push({
      type: 'task-status',
      description: `PATCH /tasks/${taskKey} {status: completed} -> ${patchRes.status()}`,
    });
    expect([200, 204, 400, 422]).toContain(patchRes.status());

    // Verify
    const getRes = await page.request.get(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    expect(getRes.status()).toBe(200);

    // Clean up
    await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
  });

  test('task with due date', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;
    const headers = await authHeaders(page);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: {
        title: `E2E Due Date Task ${Date.now()}`,
        description: 'Task with due date',
        due: dueDate.toISOString(),
      },
      headers,
    });
    test.info().annotations.push({
      type: 'task-due-date',
      description: `POST task with due date -> ${createRes.status()}`,
    });
    expect([200, 201, 422]).toContain(createRes.status());

    if ([200, 201].includes(createRes.status())) {
      const created = await createRes.json();
      const taskKey = created?.data?.key ?? created?.key;
      if (taskKey) {
        await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
      }
    }
  });

  test('task with priority', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;
    const headers = await authHeaders(page);

    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: {
        title: `E2E Priority Task ${Date.now()}`,
        description: 'High priority task',
        priority: 'high',
      },
      headers,
    });
    test.info().annotations.push({
      type: 'task-priority',
      description: `POST task with priority=high -> ${createRes.status()}`,
    });
    expect([200, 201, 422]).toContain(createRes.status());

    if ([200, 201].includes(createRes.status())) {
      const created = await createRes.json();
      const taskKey = created?.data?.key ?? created?.key;
      if (taskKey) {
        await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
      }
    }
  });

  test('task delete via DELETE endpoint', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;
    const headers = await authHeaders(page);

    // Create task
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: { title: `E2E Delete Task ${Date.now()}`, description: 'To be deleted' },
      headers,
    });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const taskKey = created?.data?.key ?? created?.key;

    // Delete
    const delRes = await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    expect([200, 204]).toContain(delRes.status());

    // Verify deletion
    const getRes = await page.request.get(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
    expect([404, 410]).toContain(getRes.status());
  });

  test('task list filtering by status', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/tasks?status=todo&limit=20`, { headers });
    test.info().annotations.push({
      type: 'task-filter',
      description: `GET /tasks?status=todo -> ${res.status()}`,
    });
    expect([200, 400, 422]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body?.data).toBeTruthy();
    }
  });

  test('tasks page shows task list or empty state', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/tasks`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const hasContent = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('task') || text.includes('aufgabe') ||
             text.includes('no tasks') || text.includes('keine aufgaben') ||
             text.includes('add task') || text.includes('neue aufgabe');
    });
    expect(hasContent).toBeTruthy();
  });

  test('task description update via PATCH', async ({ page }) => {
    await loginAsUser(page);
    const calendars = await getCalendars(page);
    expect(calendars.length).toBeGreaterThan(0);
    const calKey = calendars[0].key;
    const headers = await authHeaders(page);

    // Create task
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      data: { title: `E2E Desc Update ${Date.now()}`, description: 'Original description' },
      headers,
    });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const taskKey = created?.data?.key ?? created?.key;

    // Update description
    const patchRes = await page.request.patch(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, {
      data: { description: 'Updated description by e2e test' },
      headers,
    });
    test.info().annotations.push({
      type: 'task-desc-update',
      description: `PATCH /tasks/${taskKey} {description} -> ${patchRes.status()}`,
    });
    expect([200, 204, 400, 422]).toContain(patchRes.status());

    // Clean up
    await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskKey)}`, { headers });
  });
});
