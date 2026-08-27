// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only

/**
 * Feature tests for public system endpoints on the live SOGo6 demo site.
 * Tests run against https://sogo6.contextual-intelligence.org
 *
 * Covers: /system (public runtime flags) and RFC 9116 /security.txt
 * disclosure file.
 */

import { test, expect } from '../helpers';

const API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const BASE = 'https://sogo6.contextual-intelligence.org';

test.describe('Feature: Public System Endpoints', () => {
  test.describe('System info', () => {
    test('GET /system returns runtime config flags {data:{system:{...}}}', async ({ request }) => {
      const res = await request.get(`${API}/system`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.error_code).toBe('S000000');
      expect(body.data).toHaveProperty('system');
      expect(typeof body.data.system).toBe('object');
      // SOGO_S_DIRECT_LOGIN is a known boolean flag
      expect(typeof body.data.system.SOGO_S_DIRECT_LOGIN).toBe('boolean');
    });

    test('GET /system does not leak secrets (no keys contain PASSWORD/SECRET)', async ({ request }) => {
      const res = await request.get(`${API}/system`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      const json = JSON.stringify(body);
      expect(json).not.toMatch(/password|secret|token|api[_-]?key/i);
    });
  });

  test.describe('Security.txt (RFC 9116 / CRA Art. 14(2))', () => {
    test('GET /security.txt exposes coordinated disclosure contact', async ({ request }) => {
      const res = await request.get(`${API}/security.txt`);
      expect(res.status()).toBe(200);
      const text = await res.text();
      expect(text).toContain('Contact:');
      expect(text).toContain('Expires:');
      // Contact must be a valid https URL (advisories)
      expect(text).toMatch(/Contact: https:\/\//);
    });

    test('security.txt is served at the RFC 9116 well-known location', async ({ request }) => {
      const res = await request.get(`${BASE}/.well-known/security.txt`);
      expect(res.status()).toBe(200);
      const text = await res.text();
      expect(text).toContain('Contact:');
    });

    test('both routes expose the RFC 9116 required fields (Contact/Expires/Policy)', async ({ request }) => {
      const [r1, r2] = await Promise.all([
        request.get(`${API}/security.txt`),
        request.get(`${BASE}/.well-known/security.txt`),
      ]);
      expect(r1.status()).toBe(200);
      expect(r2.status()).toBe(200);
      const [t1, t2] = await Promise.all([r1.text(), r2.text()]);
      for (const text of [t1, t2]) {
        expect(text).toContain('Contact:');
        expect(text).toContain('Expires:');
        expect(text).toContain('Policy:');
      }
    });
  });
});
