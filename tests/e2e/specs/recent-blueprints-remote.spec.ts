// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Recently-wired user blueprints on the LIVE SOGo6 demo. These endpoints were
// 404 before the demo was updated (they existed in source but were never
// registered): now that the fixed server image is deployed they must be live.
// Guards the deployment, not just the local stack (see recent-blueprints.spec.ts
// for the equivalent local checks).
//
// All assertions are read-only.
//
//   npx playwright test recent-blueprints-remote.spec.ts

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const API = `${REMOTE_BASE}/api/user/v1`;

let token = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/auth/login`, {
    data: {
      username: REMOTE_CREDENTIALS.user.email,
      password: REMOTE_CREDENTIALS.user.password,
    },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();
});

test.describe('recently-wired blueprints on the live demo @remote', () => {
  test('oauth clients list is served', async ({ request }) => {
    const res = await request.get(`${API}/oauth/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data?.clients)).toBe(true);
  });

  test('push VAPID public key is served', async ({ request }) => {
    const res = await request.get(`${API}/push/vapid-public-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.public_key).toBe('string');
    expect((body.public_key ?? '').length).toBeGreaterThan(20);
  });
});
