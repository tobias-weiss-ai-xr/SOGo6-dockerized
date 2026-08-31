// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Appointment slots (@local): a user publishes bookable time-slot configs;
// external visitors book anonymously via the slot id (capability URL).
// Regressions for bug #35 (book endpoint required auth despite being the
// public booking path) and bug #36 (bookings never indexed -> owner's
// /bookings list always empty).

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;

const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let userToken = '';
let slotId = '';
let bookingId = '';

const auth = () => ({ Authorization: `Bearer ${userToken}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  userToken = (await login.json()).data.jwt_token;
});

test.afterAll(async ({ request }) => {
  // slots/bookings live in Redis with a 30d TTL; clean via redis is not
  // reachable from the spec, so leave the slot — it is overwritten by the
  // next run's unique title and harmless. Deleting is not exposed by API.
});

test.describe('local appointment slots @local @slots', () => {
  test('AS-01 create returns the slot config with booking capability', async ({ request }) => {
    const res = await request.post(`${USER_API}/appointment-slots`, {
      headers: json(),
      data: {
        title: `[local-e2e] office hours ${STAMP}`,
        description: 'spec probe',
        duration_minutes: 30,
        start_time: '09:00',
        end_time: '11:00',
        days_of_week: [1, 3],
        buffer_minutes: 10,
        max_bookings_per_day: 2,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const slot = (await res.json()).data;
    slotId = slot.id;
    expect(slot.title).toContain(STAMP);
    expect(slot.duration_minutes).toBe(30);
    expect(slot.days_of_week).toEqual([1, 3]);
    expect(slot.enabled).toBe(true);
    expect(slot.token).toBeTruthy();
    expect(slot.booking_url).toContain(`/book/${slotId}?token=`);
  });

  test('AS-02 the slot appears in the owner list', async ({ request }) => {
    const res = await request.get(`${USER_API}/appointment-slots`, { headers: auth() });
    expect(res.status()).toBe(200);
    const slots = (await res.json()).data.slots;
    expect(slots.some((s: any) => s.id === slotId)).toBe(true);
  });

  test('AS-03 create validation: short duration / bad weekday -> 422', async ({ request }) => {
    const short = await request.post(`${USER_API}/appointment-slots`, {
      headers: json(),
      data: { title: 'x', duration_minutes: 5, start_time: '09:00', end_time: '17:00', days_of_week: [1] },
    });
    expect(short.status()).toBe(422);
    const badDay = await request.post(`${USER_API}/appointment-slots`, {
      headers: json(),
      data: { title: 'x', duration_minutes: 30, start_time: '09:00', end_time: '17:00', days_of_week: [9] },
    });
    expect(badDay.status()).toBe(422);
    const missing = await request.post(`${USER_API}/appointment-slots`, {
      headers: json(),
      data: { title: 'x', duration_minutes: 30 },
    });
    expect(missing.status()).toBe(422);
  });

  test('AS-04 anonymous booking works without any token (bug #35)', async ({ request }) => {
    const res = await request.post(`${USER_API}/appointment-slots/${slotId}/book`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: `Visitor ${STAMP}`, email: `visitor.${STAMP}@example.org`, date: '2026-10-21', time: '09:30' },
    });
    expect(res.status(), await res.text()).toBe(201);
    const booking = (await res.json()).data;
    bookingId = booking.id;
    expect(booking.slot_id).toBe(slotId);
    expect(booking.email).toContain(STAMP);
    expect(booking.date).toBe('2026-10-21');
  });

  test('AS-05 booking validation: missing name -> 422; unknown slot -> 404', async ({ request }) => {
    const bad = await request.post(`${USER_API}/appointment-slots/${slotId}/book`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'x@example.org', date: '2026-10-21', time: '09:30' },
    });
    expect(bad.status()).toBe(422);
    const ghost = await request.post(`${USER_API}/appointment-slots/does-not-exist/book`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: 'x', email: 'x@example.org', date: '2026-10-21', time: '09:30' },
    });
    expect(ghost.status()).toBe(404);
  });

  test('AS-06 the owner sees the booking in /bookings (bug #36)', async ({ request }) => {
    const res = await request.get(`${USER_API}/appointment-slots/bookings`, { headers: auth() });
    expect(res.status()).toBe(200);
    const bookings = (await res.json()).data.bookings;
    const mine = bookings.find((b: any) => b.id === bookingId);
    expect(mine, 'freshly booked appointment must be listed').toBeTruthy();
    expect(mine.name).toContain(STAMP);
  });

  test('AS-07 unauthenticated slot list is rejected', async ({ request }) => {
    const res = await request.get(`${USER_API}/appointment-slots`);
    expect(res.status()).toBe(401);
  });
});
