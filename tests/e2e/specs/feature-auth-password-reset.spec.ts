// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for self-service password reset on the live SOGo6 demo site.
 * Tests run against https://sogo6.contextual-intelligence.org
 *
 * All endpoints are PUBLIC (no JWT required). Tests exercise only
 * non-destructive paths — no real reset is ever triggered (garbage tokens).
 */

import { test, expect } from '../helpers';

const API = 'https://sogo6.contextual-intelligence.org/api/user/v1';

test.describe('Feature: Password Reset', () => {
  test.describe('Request reset', () => {
    test('missing username is rejected with 400 (schema validation)', async ({ request }) => {
      const res = await request.post(`${API}/auth/password-reset/request`, {
        data: {},
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      const jsonErrors = body[0].data.errors.json ?? {};
      expect(jsonErrors.username).toBeTruthy();
    });

    test('unknown username does not leak account existence (returns requested)', async ({ request }) => {
      const res = await request.post(`${API}/auth/password-reset/request`, {
        data: { username: 'definitely-not-a-user-xyz@example.org' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      // Generic success — must not reveal whether the account exists
      expect(body.requested).toBe(true);
    });
  });

  test.describe('Verify token', () => {
    test('missing token param is rejected with 400', async ({ request }) => {
      const res = await request.get(`${API}/auth/password-reset/verify`);
      expect([400, 422]).toContain(res.status());
    });

    test('garbage token is reported as invalid (no 5xx)', async ({ request }) => {
      const res = await request.get(`${API}/auth/password-reset/verify?token=garbage-token`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(false);
      expect(body.user_uid).toBe('');
    });
  });

  test.describe('Complete reset', () => {
    test('missing token/new_password is rejected with 400', async ({ request }) => {
      const res = await request.post(`${API}/auth/password-reset/reset`, {
        data: {},
      });
      expect(res.status()).toBe(400);
    });

    test('garbage token cannot complete a reset (returns reset=false, no 5xx)', async ({ request }) => {
      const res = await request.post(`${API}/auth/password-reset/reset`, {
        data: { token: 'garbage-token', new_password: 'FreshPass2026!q' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.reset).toBe(false);
    });
  });
});
