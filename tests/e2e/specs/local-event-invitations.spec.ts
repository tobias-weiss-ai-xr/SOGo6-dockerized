// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Event invitations & RSVP (@local): attendee echo on create, attendee
// listing (RFC 5545 defaults), RSVP PUT (PARTSTAT persisted on the event),
// invite send (needs reachable SMTP — 503 S001400 locally), 404/422 traps.

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;
const CAL_KEY = '6abddb60-547b-41b0-8a3e-56e4309a5550'; // testuser personal calendar
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let token = '';
let eventKey = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  token = (await login.json()).data.jwt_token;
});

test.afterAll(async ({ request }) => {
  // Failure-safe: re-derive probe events by unique title.
  const list = await request.get(`${USER_API}/calendars/${CAL_KEY}/events`, { headers: auth() });
  const body = await list.json();
  const events = body?.data?.events ?? body?.data ?? [];
  for (const ev of Array.isArray(events) ? events : []) {
    if (ev.title && ev.title.includes(STAMP) && ev.key !== eventKey) {
      await request.delete(`${USER_API}/events/${ev.key}`, { headers: auth() });
    }
  }
  if (eventKey) {
    await request.delete(`${USER_API}/events/${eventKey}`, { headers: auth() });
  }
});

test.describe('local event invitations @local @event-invite', () => {
  test('INV-01 an event with attendees echoes the RFC 5545 defaults', async ({ request }) => {
    const res = await request.post(`${USER_API}/calendars/${CAL_KEY}/events`, {
      headers: json(),
      data: {
        title: `[local-e2e] inv ${STAMP}`,
        date_start: isoIn(2),
        date_end: isoIn(3),
        attendees: [
          { email: `guest1.${STAMP}@example.org` },
          { email: `guest2.${STAMP}@example.org` },
        ],
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    eventKey = (await res.json()).data.key;
  });

  test('INV-02 attendees are listed with cutype/role/rsvp/status defaults', async ({ request }) => {
    const res = await request.get(`${USER_API}/calendars/${CAL_KEY}/events/${eventKey}/attendees`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.total_count).toBe(2);
    const guest1 = data.attendees.find((a: any) => a.email.startsWith('guest1'));
    expect(guest1.cutype).toBe('individual');
    expect(guest1.role).toBe('required');
    expect(guest1.status).toBe('needs-action');
    expect(guest1.rsvp).toBe(false);
  });

  test('INV-03 RSVP PUT persists the PARTSTAT on the event', async ({ request }) => {
    const guest = `guest1.${STAMP}@example.org`;
    const res = await request.put(
      `${USER_API}/calendars/${CAL_KEY}/events/${eventKey}/attendees/${guest}`,
      { headers: json(), data: { status: 'accepted' } },
    );
    expect(res.status(), await res.text()).toBe(200);
    const updated = (await res.json()).data;
    expect(updated.attendees.find((a: any) => a.email === guest).status).toBe('accepted');

    const list = await request.get(`${USER_API}/calendars/${CAL_KEY}/events/${eventKey}/attendees`, {
      headers: auth(),
    });
    expect((await list.json()).data.attendees.find((a: any) => a.email === guest).status)
      .toBe('accepted');
  });

  test('INV-04 an invalid PARTSTAT -> 422', async ({ request }) => {
    const guest = `guest2.${STAMP}@example.org`;
    const res = await request.put(
      `${USER_API}/calendars/${CAL_KEY}/events/${eventKey}/attendees/${guest}`,
      { headers: json(), data: { status: 'maybe' } },
    );
    expect(res.status()).toBe(422);
  });

  test('INV-05 invite send needs reachable SMTP -> 503 S001400 locally', async ({ request }) => {
    // Delivery is best-effort per recipient; with no SMTP on the local stack
    // every recipient fails and the endpoint honestly answers 503.
    const res = await request.post(
      `${USER_API}/calendars/${CAL_KEY}/events/${eventKey}/invite`,
      { headers: json(), data: {} },
    );
    expect(res.status(), await res.text()).toBe(503);
    expect((await res.json()).error_code).toBe('S001400');
  });

  test('INV-06 unknown event -> 404 for attendees and invite', async ({ request }) => {
    const attendees = await request.get(
      `${USER_API}/calendars/${CAL_KEY}/events/00000000-0000-0000-0000-000000000000/attendees`,
      { headers: auth() },
    );
    expect(attendees.status()).toBe(404);

    const invite = await request.post(
      `${USER_API}/calendars/${CAL_KEY}/events/00000000-0000-0000-0000-000000000000/invite`,
      { headers: json(), data: {} },
    );
    expect(invite.status()).toBe(404);
  });
});
