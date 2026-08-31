// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local user preferences (@local).
//
// GET /preferences returns the user's preference sections; PATCH accepts
// {settings: {SECTION: {KEY: value}}} and persists; unknown sections are
// silently ignored (200, not persisted — verified 2026-08-31).
//
//   npx playwright test local-user-preferences.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

async function getPrefs(request: any): Promise<any> {
  const res = await request.get(`${LOCAL_API}/preferences`, { headers: auth() });
  expect(res.status()).toBe(200);
  return (await res.json()).data ?? {};
}

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, LOCAL_API))!;
  expect(token).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  // restore the toggled preference so other suites see the default state
  await request.patch(`${LOCAL_API}/preferences`, {
    headers: json(),
    data: { settings: { USER_CALENDAR_GENERAL: { SOGO_U_BUSY_OFF_HOURS: false } } },
  });
});

test.describe('local user preferences @local @profile', () => {
  test('PREF-01 GET exposes the known preference sections', async ({ request }) => {
    const prefs = await getPrefs(request);
    for (const section of [
      'USER_CALENDAR_GENERAL',
      'USER_CALENDAR_CATEGORY',
      'USER_GENERAL',
      'USER_MAIL_GENERAL_SETTINGS',
    ]) {
      expect(prefs, `section ${section} present`).toHaveProperty(section);
    }
    expect(prefs.USER_CALENDAR_GENERAL).toHaveProperty('SOGO_U_BUSY_OFF_HOURS');
  });

  test('PREF-02 a patched preference persists and can be reverted', async ({ request }) => {
    const res = await request.patch(`${LOCAL_API}/preferences`, {
      headers: json(),
      data: { settings: { USER_CALENDAR_GENERAL: { SOGO_U_BUSY_OFF_HOURS: true } } },
    });
    expect(res.status(), `patch -> ${res.status()} ${await res.text()}`).toBe(200);

    let now: any;
    for (let i = 0; i < 5; i += 1) {
      const prefs = await getPrefs(request);
      now = prefs.USER_CALENDAR_GENERAL?.SOGO_U_BUSY_OFF_HOURS;
      if (now === true) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(now, 'toggled value persists').toBe(true);

    const revert = await request.patch(`${LOCAL_API}/preferences`, {
      headers: json(),
      data: { settings: { USER_CALENDAR_GENERAL: { SOGO_U_BUSY_OFF_HOURS: false } } },
    });
    expect(revert.status()).toBe(200);
    const prefs = await getPrefs(request);
    expect(prefs.USER_CALENDAR_GENERAL?.SOGO_U_BUSY_OFF_HOURS).toBe(false);
  });

  test('PREF-03 unknown sections are ignored (200, not persisted)', async ({ request }) => {
    const res = await request.patch(`${LOCAL_API}/preferences`, {
      headers: json(),
      data: { settings: { BOGUS_SECTION_E2E: { NOT_A_KEY: 1 } } },
    });
    expect(res.status(), 'unknown section is accepted silently').toBe(200);

    const prefs = await getPrefs(request);
    expect(prefs).not.toHaveProperty('BOGUS_SECTION_E2E');
  });
});
