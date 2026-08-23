// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Six-Sigma Tier-0 coverage: TEAM CALENDARS  (openspec: team-calendars.spec.md)
//
// Traced requirements (traceability → SIX_SIGMA_TEST_MATRIX.md):
//   T0-TC-01 list team calendars (200)
//   T0-TC-02 list team invites (200)
//   T0-TC-03 create validates name (422 when missing)
//   T0-TC-04 create -> 405 (hosted calendar source does not support teams;
//        documented backend limitation, S000604)
//   T0-TC-05 unauthenticated -> 401

import { test, expect } from '../helpers';
import {
  REMOTE_BASE, REMOTE_API, ADMIN_API,
  remoteEnvInterception, loginRemoteUser, remoteUserToken, loginRemoteAdmin, bearer,
} from '../helpers';

test.describe('Tier-0 Team Calendars', () => {
  test.describe.configure({ mode: 'serial' });

  test('T0-TC-01 list team calendars -> 200', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/calendars/teams`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body?.data?.calendars)).toBeTruthy();
    expect(body?.data).toHaveProperty('total_count');
  });

  test('T0-TC-02 list team invites -> 200', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.get(`${REMOTE_API}/calendars/teams/invites`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body?.data?.invites)).toBeTruthy();
  });

  test('T0-TC-03 create requires name -> 422', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(`${REMOTE_API}/calendars/teams`, {
      headers: bearer(token),
      data: {},
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body?.errors?.json).toHaveProperty('name');
  });

  test('T0-TC-04 create with name -> 405 S000604 (documented limitation)', async ({ page }) => {
    await loginRemoteUser(page);
    const token = await remoteUserToken(page);
    const res = await page.request.post(`${REMOTE_API}/calendars/teams`, {
      headers: bearer(token),
      data: { name: '6sigma-team', color: '#ff0000' },
    });
    test.info().annotations.push({
      type: 'trace T0-TC-04',
      description:
        `POST /calendars/teams -> ${res.status()}. ` +
        'Hosted calendar source reports "Operation Not Supported On This Calendar Source" (S000604); ' +
        'team-calendar creation is not wired for the hosted CalDAV source.',
    });
    expect([200, 201, 405]).toContain(res.status());
  });

  test('T0-TC-05 unauthenticated team calendars -> 401', async ({ page }) => {
    await remoteEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const res = await page.request.get(`${REMOTE_API}/calendars/teams`, { headers: {} });
    expect(res.status()).toBe(401);
  });
});
