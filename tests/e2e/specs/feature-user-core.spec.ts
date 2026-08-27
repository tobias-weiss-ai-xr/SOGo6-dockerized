// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for core user-facing endpoints on the live SOGo6 demo site.
 * Tests run against https://sogo6.contextual-intelligence.org
 * Credentials: see tests/e2e/.env (gitignored)
 */

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';
import { apiLogin, REMOTE_API, bearer } from '../helpers';

const BASE = REMOTE_API.replace('/api/user/v1', '');

// ── Helpers ────────────────────────────────────────────────────────────────

let token: string | null = null;
async function getToken(request: any): Promise<string> {
  if (!token) {
    token = await apiLogin(request, REMOTE_CREDENTIALS.user.email, REMOTE_CREDENTIALS.user.password, REMOTE_API);
  }
  return token;
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('User Core Features', () => {

  test.describe('User Profile API', () => {
    test('GET /profile returns user profile with mailboxes and preferences', async ({ request }) => {
      const token = await getToken(request);
      expect(token).toBeTruthy();

      const res = await request.get(`${BASE}/api/user/v1/profile`, {
        headers: bearer(token),
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('mailboxes');
      expect(Array.isArray(body.data.mailboxes)).toBe(true);
      expect(body.data).toHaveProperty('prefs');
      expect(typeof body.data.prefs).toBe('object');
    });

    test('GET /preferences returns user preferences', async ({ request }) => {
      const token = await getToken(request);
      expect(token).toBeTruthy();

      const res = await request.get(`${BASE}/api/user/v1/preferences`, {
        headers: bearer(token),
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    });
  });

  test.describe('User Customization API', () => {
    test('GET /customization/themes returns theme CSS variables', async ({ request }) => {
      const token = await getToken(request);
      expect(token).toBeTruthy();

      const res = await request.get(`${BASE}/api/user/v1/customization/themes`, {
        headers: bearer(token),
      });

      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(typeof body).toBe('string');
      // Expect CSS variables
      expect(body).toContain(':root');
      expect(body).toContain('--background');
    });
  });

  test.describe('Global Search API', () => {
    test('GET /search/global requires query parameter', async ({ request }) => {
      const token = await getToken(request);
      expect(token).toBeTruthy();

      const res = await request.get(`${BASE}/api/user/v1/search/global`, {
        headers: bearer(token),
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      // Response is an array [data, status]
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toHaveProperty('data');
      expect(body[0].data).toHaveProperty('errors');
    });

    test('GET /search/global with query returns results', async ({ request }) => {
      const token = await getToken(request);
      expect(token).toBeTruthy();

      const res = await request.get(`${BASE}/api/user/v1/search/global?q=test`, {
        headers: bearer(token),
      });

      // Accept 200 or 404 (no results)
      expect([200, 404]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('data');
      }
    });
  });
});
