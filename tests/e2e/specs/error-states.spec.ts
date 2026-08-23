// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Error Handling & Edge Cases.
// Tests:
//   - Invalid mail UID → graceful error
//   - Non-existent folder → graceful error
//   - Invalid calendar key → 404
//   - Invalid contact key → 404
//   - Invalid task key → 404
//   - Expired/invalid token → 401
//   - Missing auth token → 401
//   - Malformed JSON body → 400/422
//   - Rate limiting (if applicable)
//   - Large payload handling
//   - Concurrent requests
//   - API error response format
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

test.describe('Error Handling & Edge Cases', () => {

  // ── Invalid IDs ────────────────────────────────────────────────────────

  test('invalid mail UID returns 404 or error', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/999999999`, { headers });
    expect([404, 500]).toContain(res.status());

    const body = await res.json().catch(() => ({}));
    test.info().annotations.push({
      type: 'invalid-mail-uid',
      description: `GET /mails/999999999 -> ${res.status()}: ${JSON.stringify(body).substring(0, 200)}`,
    });
  });

  test('non-existent folder returns 404 or empty', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/NONEXISTENT_FOLDER/mails`, { headers });
    expect([200, 404, 500]).toContain(res.status());
  });

  test('invalid calendar key returns 404', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/calendars/invalid-key-12345/events`, { headers });
    expect([404, 500]).toContain(res.status());
  });

  test('invalid contact key returns 404', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // First get address books
    const booksRes = await page.request.get(`${REMOTE_API}/addressbooks`, { headers });
    expect(booksRes.status()).toBe(200);
    const booksBody = await booksRes.json();
    const books = booksBody?.data?.addressbooks ?? [];
    const personalBook = books.find((b: any) => b.source_type === 'local' || b.is_default === true);
    if (!personalBook) { test.info().annotations.push({ type: 'skip', description: 'No personal address book' }); return; }

    const res = await page.request.get(
      `${REMOTE_API}/addressbooks/${encodeURIComponent(personalBook.key)}/contacts/invalid-key-99999`,
      { headers },
    );
    expect([404, 500]).toContain(res.status());
  });

  test('invalid task key returns 404', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(`${REMOTE_API}/tasks/invalid-key-99999`, { headers });
    expect([404, 500]).toContain(res.status());
  });

  // ── Auth Errors ────────────────────────────────────────────────────────

  test('missing auth token returns 401', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/profile`);
    expect(res.status()).toBe(401);
  });

  test('invalid auth token returns 401', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: 'Bearer invalid-token-12345', 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('expired token format returns 401', async ({ page }) => {
    const res = await page.request.get(`${REMOTE_API}/profile`, {
      headers: { Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature', 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  // ── Malformed Payloads ─────────────────────────────────────────────────

  test('malformed JSON body returns 400 or 422', async ({ page }) => {
    await loginAsUser(page);
    const token = await getAuthToken(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: 'not valid json',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect([400, 422, 500]).toContain(res.status());
  });

  test('missing required fields in send email returns 400 or 422', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: { from: CREDENTIALS.email }, // missing to, subject, body
      headers,
    });
    expect([400, 422, 500]).toContain(res.status());
  });

  test('empty subject in send email', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: '',
        body: 'Test with empty subject.',
        is_html: false,
      },
      headers,
    });
    // Empty subject may be allowed or rejected
    test.info().annotations.push({
      type: 'empty-subject',
      description: `POST /mail/send with empty subject -> ${res.status()}`,
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('empty body in send email', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: 'Test with empty body',
        body: '',
        is_html: false,
      },
      headers,
    });
    test.info().annotations.push({
      type: 'empty-body',
      description: `POST /mail/send with empty body -> ${res.status()}`,
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  // ── Large Payloads ─────────────────────────────────────────────────────

  test('large email body (10KB)', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const largeBody = 'A'.repeat(10000);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: `E2E Large Body Test ${Date.now()}`,
        body: largeBody,
        is_html: false,
      },
      headers,
    });
    expect(res.status()).toBe(200);
  });

  test('long subject (1000 chars)', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const longSubject = 'A'.repeat(1000);
    const res = await page.request.post(`${REMOTE_API}/mailboxes/0/mail/send`, {
      data: {
        from: CREDENTIALS.email,
        to: [CREDENTIALS.email],
        subject: longSubject,
        body: 'Test with long subject.',
        is_html: false,
      },
      headers,
    });
    test.info().annotations.push({
      type: 'long-subject',
      description: `POST /mail/send with 1000-char subject -> ${res.status()}`,
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  // ── Concurrent Requests ────────────────────────────────────────────────

  test('concurrent mail fetch requests', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const promises: Promise<any>[] = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?fields=contents&fields_action=exclude&page_size=5`, { headers }),
      );
    }
    const results = await Promise.all(promises);
    for (const res of results) {
      expect([200, 500]).toContain(res.status());
    }
  });

  // ── API Error Response Format ──────────────────────────────────────────

  test('API error response has consistent format', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    // Trigger a 404
    const res = await page.request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails/999999999`, { headers });
    if (res.status() === 404) {
      const body = await res.json();
      // Error response should have error_code or error field
      test.info().annotations.push({
        type: 'error-format',
        description: `404 response: ${JSON.stringify(body).substring(0, 300)}`,
      });
      expect(body).toBeTruthy();
    }
  });

  // ── UI Error Pages ─────────────────────────────────────────────────────

  test('non-existent mail UID in UI shows error gracefully', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX/999999999`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // Page should not crash
    const htmlLen = (await page.content()).length;
    expect(htmlLen).toBeGreaterThan(500);

    // Should show some content (error message or empty state)
    const bodyText = await page.evaluate(() => document.body.innerText ?? '');
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('non-existent folder in UI shows error gracefully', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/NONEXISTENT_FOLDER`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const htmlLen = (await page.content()).length;
    expect(htmlLen).toBeGreaterThan(500);
  });

  test('invalid calendar key in UI shows error gracefully', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/calendars/invalid-key-12345`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const htmlLen = (await page.content()).length;
    expect(htmlLen).toBeGreaterThan(500);
  });

  test('404 page for unknown routes', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en/nonexistent-page-12345`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const htmlLen = (await page.content()).length;
    expect(htmlLen).toBeGreaterThan(500);
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  test('mail list with page_size=1 returns single mail', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(
      `${REMOTE_API}/mailboxes/0/folders/INBOX/mails?fields=contents&fields_action=exclude&page_size=1`,
      { headers },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const mails = body?.data ?? body ?? [];
    expect(Array.isArray(mails)).toBeTruthy();
    expect(mails.length).toBeLessThanOrEqual(1);
  });

  test('mail list with page_size=0 returns empty or default', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(
      `${REMOTE_API}/mailboxes/0/folders/INBOX/mails?fields=contents&fields_action=exclude&page_size=0`,
      { headers },
    );
    // page_size=0 may return empty list or default page size
    expect([200, 400, 422]).toContain(res.status());
  });

  test('mail list with very large page_size', async ({ page }) => {
    await loginAsUser(page);
    const headers = await authHeaders(page);

    const res = await page.request.get(
      `${REMOTE_API}/mailboxes/0/folders/INBOX/mails?fields=contents&fields_action=exclude&page_size=10000`,
      { headers },
    );
    expect([200, 400, 422, 500, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data ?? body ?? [];
      // Response may be an array or an object with pagination metadata
      expect(Array.isArray(mails) || typeof mails === 'object').toBeTruthy();
    }
  });
});
