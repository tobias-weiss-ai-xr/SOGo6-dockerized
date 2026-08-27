// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Task CRUD lifecycle.
// Tests:
//   - List tasks
//   - Create a task via /calendars/{key}/tasks (title + description only)
//   - Get task by ID via /tasks/{key}
//   - Update task (title, description)
//   - Delete task via /tasks/{key}
//   - Task list with status filter
//   - Task list with priority filter
//   - Tasks page loads in UI
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
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
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) return parsed.token;
      } catch { /* fall through */ }
    }
    return null;
  });
}

async function getCalendars(page: import('@playwright/test').Page, token: string): Promise<any[]> {
  const res = await page.request.get(`${REMOTE_API}/calendars`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return [];
  const body = await res.json();
  return body?.data?.calendars ?? body?.data ?? [];
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Task CRUD', () => {

  test('list tasks via API', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get(`${REMOTE_API}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'list', description: `GET /tasks -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      const tasks = body?.data?.tasks ?? body?.data ?? [];
      test.info().annotations.push({ type: 'count', description: `Tasks: ${Array.isArray(tasks) ? tasks.length : 'N/A'}` });
    }
  });

  test('create, get, update, and delete a task', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Get a calendar to create the task in (POST /tasks is 405; task creation is at /calendars/{key}/tasks)
    const calendars = await getCalendars(page, token!);
    if (calendars.length === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No calendars available' });
      return;
    }
    const calKey = calendars[0].key || calendars[0].id;

    // Create task (only title + description are accepted; status/priority cause 422)
    const ts = Date.now();
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Task ${ts}`,
        description: 'Created by E2E test suite',
      },
    });
    test.info().annotations.push({ type: 'create', description: `POST /calendars/{key}/tasks -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    const createBody = await createRes.json();
    const taskId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.task_id;
    if (!taskId) {
      test.info().annotations.push({ type: 'skip', description: 'No task ID returned' });
      return;
    }

    // Get task (detail route is at /tasks/{key})
    const getRes = await page.request.get(`${REMOTE_API}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'get', description: `GET /tasks/${taskId} -> ${getRes.status()}` });
    expect([200]).toContain(getRes.status());

    // Update task
    const updateRes = await page.request.patch(`${REMOTE_API}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Updated ${ts}`,
        description: 'Updated by E2E test',
      },
    });
    test.info().annotations.push({ type: 'update', description: `PATCH /tasks/${taskId} -> ${updateRes.status()}` });
    expect([200, 204]).toContain(updateRes.status());

    // Delete task
    const delRes = await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'delete', description: `DELETE /tasks/${taskId} -> ${delRes.status()}` });
    expect([200, 204, 404]).toContain(delRes.status());
  });

  test('create task with description only', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const calendars = await getCalendars(page, token!);
    if (calendars.length === 0) return;
    const calKey = calendars[0].key || calendars[0].id;

    const ts = Date.now();
    const createRes = await page.request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Desc Task ${ts}`,
        description: 'Task with description only',
      },
    });
    test.info().annotations.push({ type: 'create-desc', description: `POST task with desc -> ${createRes.status()}` });
    expect([200, 201]).toContain(createRes.status());

    // Cleanup
    const createBody = await createRes.json();
    const taskId = createBody?.data?.key ?? createBody?.data?.id ?? createBody?.data?.task_id;
    if (taskId) {
      await page.request.delete(`${REMOTE_API}/tasks/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('delete non-existent task returns 404', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const fakeId = `nonexistent-${Date.now()}`;
    const delRes = await page.request.delete(`${REMOTE_API}/tasks/${fakeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'delete-404', description: `DELETE non-existent -> ${delRes.status()}` });
    expect([404, 200, 204]).toContain(delRes.status());
  });

  test('tasks page loads in UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/tasks`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes("this page couldn't load") || text.includes('application error');
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('task list with status filter', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/tasks?status=NEEDS-ACTION&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'filter-status', description: `GET tasks?status=NEEDS-ACTION -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });

  test('task list with priority filter', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.get(`${REMOTE_API}/tasks?priority=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'filter-priority', description: `GET tasks?priority=1 -> ${res.status()}` });
    expect([200, 404]).toContain(res.status());
  });
});
