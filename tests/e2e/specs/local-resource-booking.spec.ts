// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Resource booking surface (@local): browse, favorite, check availability,
// book, my-bookings, cancel. Regressions for round-12 bugs #23-#25, #27-#31.
// Owner: testuser@example.org creates bookings on an admin-seeded resource.

import { test, expect, adminPassword } from '../helpers';

const ADMIN_API = process.env.E2E_LOCAL_BASE_URL ?? 'http://localhost:5001/api/admin/v1';
const USER_API = process.env.E2E_LOCAL_USER_API ?? 'http://localhost:5001/api/user/v1';

const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const BOOKING_TITLE = `[local-e2e] RB booking ${STAMP}`;
const RESOURCE = {
  name: `[local-e2e] Boardroom ${STAMP}`,
  email: `e2e-boardroom-${STAMP}@example.org`,
  resource_type: 'room',
  capacity: 6,
  location: 'Floor 3',
  features: ['whiteboard'],
  booking_policy: 'open',
  auto_accept: true,
};

let adminToken = '';
let userToken = '';
let resourceId = '';

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
const userAuth = () => ({ Authorization: `Bearer ${userToken}` });
const json = () => ({ ...userAuth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const ADMIN_PWD = adminPassword();
  test.skip(!ADMIN_PWD, 'no local admin password (set SOGO_ADMIN_PASSWORD or secrets/sogo6.vault.env)');
  const login = await request.post(`${ADMIN_API}/auth/login`, {
    data: { username: 'admin', password: ADMIN_PWD },
  });
  expect(login.status()).toBe(200);
  adminToken = (await login.json()).data.jwt_token;

  const ulogin = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(ulogin.status()).toBe(200);
  userToken = (await ulogin.json()).data.jwt_token;

  // self-healing: drop a leftover resource with this email, then (re)create
  const pre = await request.get(`${ADMIN_API}/resources/`, { headers: adminAuth() });
  const existing = ((await pre.json()).data ?? {}).resources ?? [];
  const stale = existing.find((r: any) => r.email === RESOURCE.email);
  if (stale) {
    await request.delete(`${ADMIN_API}/resources/${stale.id}`, { headers: adminAuth() });
  }
  const create = await request.post(`${ADMIN_API}/resources/`, {
    headers: { ...adminAuth(), 'Content-Type': 'application/json' },
    data: RESOURCE,
  });
  expect(create.status(), `resource seed: ${await create.text()}`).toBe(200);
  resourceId = ((await create.json()).data ?? {}).resource.id;
  expect(resourceId).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  if (userToken) {
    // remove this run's booking events (cancel marks cancelled; DELETE removes)
    const list = await request.get(`${USER_API}/resources/my-bookings`, { headers: userAuth() });
    const bookings = ((await list.json()).data ?? {}).bookings ?? [];
    for (const b of bookings) {
      if (b.title === BOOKING_TITLE && b.event_key) {
        await request.delete(`${USER_API}/events/${b.event_key}`, { headers: userAuth() });
      }
    }
  }
  if (resourceId && adminToken) {
    await request.delete(`${ADMIN_API}/resources/${resourceId}`, { headers: adminAuth() });
  }
});

test.describe('local resource booking @local @resources', () => {
  test('RB-01 user list returns seeded resources with boolean flags (bug #23)', async ({ request }) => {
    const res = await request.get(`${USER_API}/resources`, { headers: userAuth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(Array.isArray(data.resources)).toBe(true);
    const mine = data.resources.find((r: any) => r.id === resourceId);
    expect(mine, 'seeded resource visible to user').toBeTruthy();
    expect(mine.name).toBe(RESOURCE.name);
    expect(typeof mine.is_active).toBe('boolean');
    expect(typeof mine.auto_accept).toBe('boolean');
    expect(mine.capacity).toBe(6);
  });

  test('RB-02 filters: search hit, capacity_min miss and hit', async ({ request }) => {
    const hit = await request.get(`${USER_API}/resources?search=${STAMP}`, { headers: userAuth() });
    expect(((await hit.json()).data ?? {}).resources ?? []).toHaveLength(1);
    const tooBig = await request.get(`${USER_API}/resources?capacity_min=1000`, { headers: userAuth() });
    expect(((await tooBig.json()).data ?? {}).total_count).toBe(0);
    const fits = await request.get(`${USER_API}/resources?capacity_min=4`, { headers: userAuth() });
    const names = (((await fits.json()).data ?? {}).resources ?? []).map((r: any) => r.name);
    expect(names).toContain(RESOURCE.name);
  });

  test('RB-03 resource detail (bug #23)', async ({ request }) => {
    const res = await request.get(`${USER_API}/resources/${resourceId}`, { headers: userAuth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.id).toBe(resourceId);
    expect(data.email).toBe(RESOURCE.email);
    expect(data.features).toContain('whiteboard');
  });

  test('RB-04 unknown resource detail -> 404 S000385', async ({ request }) => {
    const res = await request.get(`${USER_API}/resources/no-such-resource`, { headers: userAuth() });
    expect(res.status()).toBe(404);
    expect((await res.json()).error_code).toBe('S000385');
  });

  test('RB-05 favorite toggle works with an EMPTY body (bugs #23+#24), then lists', async ({ request }) => {
    const on = await request.post(`${USER_API}/resources/${resourceId}/favorite`, {
      headers: { ...userAuth(), 'Content-Type': 'application/json' },
      data: '',
    });
    expect(on.status(), `empty-body toggle: ${await on.text()}`).toBe(200);
    expect(((await on.json()).data ?? {}).is_favorite).toBe(true);

    const list = await request.get(`${USER_API}/resources/favorites`, { headers: userAuth() });
    expect(list.status()).toBe(200);
    const favs = ((await list.json()).data ?? {}).resources ?? [];
    expect(favs.some((r: any) => r.id === resourceId)).toBe(true);

    const off = await request.delete(`${USER_API}/resources/${resourceId}/favorite`, { headers: userAuth() });
    expect(off.status()).toBe(200);
    expect(((await off.json()).data ?? {}).is_favorite).toBe(false);

    const after = await request.get(`${USER_API}/resources/favorites`, { headers: userAuth() });
    expect((((await after.json()).data ?? {}).resources ?? []).some((r: any) => r.id === resourceId)).toBe(false);
  });

  test('RB-06 check-availability echoes window and returns available (bug #25)', async ({ request }) => {
    const res = await request.post(`${USER_API}/resources/${resourceId}/check-availability`, {
      headers: json(),
      data: { start_time: '2026-10-07T09:00:00Z', end_time: '2026-10-07T10:00:00Z' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const data = (await res.json()).data;
    expect(data.available).toBe(true);
    expect(data.resource_id).toBe(resourceId);
    expect(data.start_time.startsWith('2026-10-07T09:00:00')).toBe(true);
  });

  test('RB-07 available-in-window lists the resource (bug #23 decorator)', async ({ request }) => {
    const res = await request.get(
      `${USER_API}/resources/available?start_time=2026-10-07T09:00:00Z&end_time=2026-10-07T10:00:00Z`,
      { headers: userAuth() });
    expect(res.status()).toBe(200);
    const names = (((await res.json()).data ?? {}).resources ?? []).map((r: any) => r.name);
    expect(names).toContain(RESOURCE.name);
  });

  test('RB-08 book -> 201 with booking_id + event (bugs #27+#28)', async ({ request }) => {
    const res = await request.post(`${USER_API}/resources/${resourceId}/book`, {
      headers: json(),
      data: {
        start_time: '2026-10-07T09:00:00Z',
        end_time: '2026-10-07T10:00:00Z',
        title: BOOKING_TITLE,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const data = (await res.json()).data;
    expect(data.booking_id).toMatch(/[0-9a-f-]{36}/);
    expect(data.event_id).toBeTruthy();
  });

  test('RB-09 overlapping booking is rejected by conflict detection', async ({ request }) => {
    const res = await request.post(`${USER_API}/resources/${resourceId}/book`, {
      headers: json(),
      data: {
        start_time: '2026-10-07T09:30:00Z',
        end_time: '2026-10-07T09:45:00Z',
        title: `${BOOKING_TITLE} overlap`,
      },
    });
    expect([409, 500]).toContain(res.status());
    const body = await res.json();
    expect(body.error_code).not.toBe('S000000');
  });

  test('RB-10 my-bookings lists the booking with resource identity (bug #29)', async ({ request }) => {
    const res = await request.get(`${USER_API}/resources/my-bookings`, { headers: userAuth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.total_count).toBeGreaterThanOrEqual(1);
    const mine = data.bookings.find((b: any) => b.title === BOOKING_TITLE);
    expect(mine, `bookings: ${JSON.stringify(data.bookings.map((b: any) => b.title))}`).toBeTruthy();
    expect(mine.resource_name).toBe(RESOURCE.name);
    expect(mine.status).toBe('confirmed');
    expect(mine.id).toMatch(/[0-9a-f-]{36}/);
  });

  test('RB-11 booking detail resolves the listed id (bug #30)', async ({ request }) => {
    const list = await request.get(`${USER_API}/resources/my-bookings`, { headers: userAuth() });
    const mine = ((await list.json()).data ?? {}).bookings
      .find((b: any) => b.title === BOOKING_TITLE);
    expect(mine).toBeTruthy();

    const res = await request.get(`${USER_API}/resources/my-bookings/${mine.id}`, { headers: userAuth() });
    expect(res.status(), `detail for ${mine.id}`).toBe(200);
    const data = (await res.json()).data;
    expect(data.event_key).toBe(mine.event_key);
    expect(data.status).toBe('confirmed');
  });

  test('RB-12 cancel booking -> 200, then listed as cancelled (bugs #31 + import)', async ({ request }) => {
    const list = await request.get(`${USER_API}/resources/my-bookings`, { headers: userAuth() });
    const mine = ((await list.json()).data ?? {}).bookings
      .find((b: any) => b.title === BOOKING_TITLE);
    expect(mine).toBeTruthy();

    const cancel = await request.delete(`${USER_API}/resources/my-bookings/${mine.id}`, { headers: userAuth() });
    expect(cancel.status(), await cancel.text()).toBe(200);

    const after = await request.get(`${USER_API}/resources/my-bookings`, { headers: userAuth() });
    const cancelled = (((await after.json()).data ?? {}).bookings ?? [])
      .find((b: any) => b.id === mine.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  test('RB-13 cancel unknown booking -> 404 S000389', async ({ request }) => {
    const res = await request.delete(`${USER_API}/resources/my-bookings/does-not-exist`, { headers: userAuth() });
    expect(res.status()).toBe(404);
    expect((await res.json()).error_code).toBe('S000389');
  });
});
