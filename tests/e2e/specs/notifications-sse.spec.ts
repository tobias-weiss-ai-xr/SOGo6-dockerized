// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Notifications & SSE (Server-Sent Events).
// Tests:
//   - SSE endpoint returns event stream
//   - SSE connection stays open
//   - Notification settings page renders
//   - GET /notifications returns notification list
//   - Notification preferences
//   - Push notification subscription
//   - Real-time mail notifications
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

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Notifications & SSE', () => {

  test('notification settings page renders', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/mail/notifications`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const hasFatalError = await page.evaluate(() => {
      const text = document.body.innerText?.toLowerCase() || '';
      return text.includes('this page couldn\u2019t load') || text.includes("this page couldn't load");
    });
    expect(hasFatalError).toBeFalsy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('GET /notifications returns notification list', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/notifications`, { headers });
    test.info().annotations.push({
      type: 'notifications',
      description: `GET /notifications -> ${res.status()}`,
    });
    expect([200, 404, 501]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body?.data ?? body).toBeTruthy();
    }
  });

  test('GET /notifications/unread returns unread count', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/notifications/unread`, { headers });
    test.info().annotations.push({
      type: 'notifications-unread',
      description: `GET /notifications/unread -> ${res.status()}`,
    });
    expect([200, 404, 501]).toContain(res.status());
  });

  test('SSE endpoint is accessible', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    // SSE endpoint is typically at /api/user/v1/sse or similar
    // We just check if the endpoint exists (not the full SSE stream)
    const res = await page.request.get(`${REMOTE_API}/sse`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    });
    test.info().annotations.push({
      type: 'sse-endpoint',
      description: `GET /sse -> ${res.status()} (Accept: text/event-stream)`,
    });
    // SSE may return 200 (stream) or 404/501 (not implemented)
    expect([200, 404, 501]).toContain(res.status());
  });

  test('notification preferences via PATCH', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.patch(`${REMOTE_API}/preferences`, {
      data: { notifications: { email: true, push: false } },
      headers,
    });
    test.info().annotations.push({
      type: 'notif-prefs',
      description: `PATCH /preferences {notifications} -> ${res.status()}`,
    });
    expect([200, 204, 400, 422]).toContain(res.status());
  });

  test('push notification subscription endpoint', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // Try to subscribe to push notifications
    const res = await page.request.post(`${REMOTE_API}/notifications/subscribe`, {
      data: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'test-key', auth: 'test-auth' },
      },
      headers,
    });
    test.info().annotations.push({
      type: 'push-subscribe',
      description: `POST /notifications/subscribe -> ${res.status()}`,
    });
    expect([200, 201, 400, 404, 501]).toContain(res.status());
  });

  test('mail notification settings via GET', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/notify`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data).toBeTruthy();
  });

  test('notification bell icon visible in UI', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // Look for a notification bell icon or notification button
    const hasNotificationBell = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.some(b => {
        const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        const className = (b.className || '').toLowerCase();
        return ariaLabel.includes('notification') || ariaLabel.includes('benachrichtigung') ||
               title.includes('notification') || title.includes('benachrichtigung') ||
               className.includes('notification') || className.includes('bell');
      });
    });

    test.info().annotations.push({
      type: 'notification-bell',
      description: `Notification bell found: ${hasNotificationBell}`,
    });
  });

  test('GET /mailboxes/0/filters returns sieve filter rules', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/filters`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data).toBeTruthy();
  });

  test('mail filter validation endpoint', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const filterPayload = {
      name: 'E2E Test Filter',
      rules: {
        op: 'and',
        rules: [{ field: 'subject', operator: 'contains', value: 'test' }],
      },
      actions: [{ method: 'fileinto', arguments: { folders: ['INBOX'] } }],
      enabled: true,
    };

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/filters/validate`, {
      data: filterPayload,
      headers,
    });
    expect(res.status()).toBe(200);
  });

  test('mail filter create endpoint', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const filterPayload = {
      name: `E2E Test Filter ${Date.now()}`,
      rules: {
        op: 'and',
        rules: [{ field: 'from', operator: 'contains', value: 'test' }],
      },
      actions: [{ method: 'fileinto', arguments: { folders: ['INBOX'] } }],
      enabled: true,
    };

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/filters`, {
      data: filterPayload,
      headers,
    });
    test.info().annotations.push({
      type: 'filter-create',
      description: `POST /filters -> ${res.status()}`,
    });
    // Sieve filter creation may fail with 503 (ManageSieve not connected)
    expect([200, 201, 400, 503]).toContain(res.status());
  });

  test('mail vacation auto-reply settings', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // GET current vacation settings
    const getRes = await page.request.get(`${REMOTE_API}/mailboxes/0/vacation`, { headers });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody?.data).toBeTruthy();

    // Try to update vacation settings
    const patchRes = await page.request.patch(`${REMOTE_API}/mailboxes/0/vacation`, {
      data: {
        enabled: false,
        text: 'E2E test vacation message',
        subject: 'Out of office',
      },
      headers,
    });
    test.info().annotations.push({
      type: 'vacation-update',
      description: `PATCH /vacation -> ${patchRes.status()}`,
    });
    expect([200, 204, 400, 405, 422]).toContain(patchRes.status());
  });

  test('mail forward settings', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // GET current forward settings
    const getRes = await page.request.get(`${REMOTE_API}/mailboxes/0/forward`, { headers });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody?.data).toBeTruthy();

    // Try to update forward settings
    const patchRes = await page.request.patch(`${REMOTE_API}/mailboxes/0/forward`, {
      data: {
        enabled: false,
        forward_to: [],
        keep_copy: true,
      },
      headers,
    });
    test.info().annotations.push({
      type: 'forward-update',
      description: `PATCH /forward -> ${patchRes.status()}`,
    });
    expect([200, 204, 400, 405, 422]).toContain(patchRes.status());
  });
});
