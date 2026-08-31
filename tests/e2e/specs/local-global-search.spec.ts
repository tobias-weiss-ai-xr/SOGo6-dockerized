// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Global search surface (@local): grouped contacts/events/users results,
// soft min-length validation, per-section limit (bug #33 regression).
// Seeds a contact + event with a unique token, then searches for it.

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;

const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TOKEN = `gsearch${STAMP}`;

let userToken = '';
let addressbookKey = '';
let calendarKey = '';
let contactKey = '';
let eventKey = '';

const auth = () => ({ Authorization: `Bearer ${userToken}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  userToken = (await login.json()).data.jwt_token;

  const books = await request.get(`${USER_API}/addressbooks`, { headers: auth() });
  addressbookKey = (await books.json()).data.addressbooks[0].key;

  const cals = await request.get(`${USER_API}/calendars`, { headers: auth() });
  const calsData = (await cals.json()).data.calendars ?? [];
  calendarKey = calsData[0].key;

  const contact = await request.post(
    `${USER_API}/addressbooks/${addressbookKey}/contacts`,
    {
      headers: json(),
      data: {
        display_name: `Global Search ${TOKEN}`,
        emails: [{ types: ['INTERNET'], value: `${TOKEN}@example.org` }],
      },
    });
  expect(contact.status(), `contact seed: ${await contact.text()}`).toBe(201);
  contactKey = ((await contact.json()).data ?? {}).key;

  const event = await request.post(`${USER_API}/calendars/${calendarKey}/events`, {
    headers: json(),
    data: {
      title: `Event ${TOKEN}`,
      date_start: '2026-10-15T08:00:00.000Z',
      date_end: '2026-10-15T09:00:00.000Z',
    },
  });
  expect(event.status(), `event seed: ${await event.text()}`).toBe(201);
  eventKey = ((await event.json()).data ?? {}).key;
});

test.afterAll(async ({ request }) => {
  if (contactKey && addressbookKey) {
    await request.delete(`${USER_API}/addressbooks/${addressbookKey}/contacts/${contactKey}`, { headers: auth() });
  }
  if (eventKey) {
    await request.delete(`${USER_API}/events/${eventKey}`, { headers: auth() });
  }
});

test.describe('local global search @local @search', () => {
  test('GS-01 grouped sections shape: contacts/events/users', async ({ request }) => {
    const res = await request.get(`${USER_API}/search/global?q=probe`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(Array.isArray(data.contacts)).toBe(true);
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.users)).toBe(true);
  });

  test('GS-02 seeded contact found by unique token', async ({ request }) => {
    const res = await request.get(`${USER_API}/search/global?q=${TOKEN}`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.contacts.length).toBeGreaterThan(0);
    expect(data.contacts[0].email.value).toBe(`${TOKEN}@example.org`);
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.events.some((e: any) => e.title === `Event ${TOKEN}`)).toBe(true);
  });

  test('GS-03 query shorter than 2 chars -> 200 with empty sections (soft validation)', async ({ request }) => {
    const res = await request.get(`${USER_API}/search/global?q=a`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.contacts).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.users).toEqual([]);
  });

  test('GS-04 limit validation: 0 and 51 -> 400', async ({ request }) => {
    const zero = await request.get(`${USER_API}/search/global?q=probe&limit=0`, { headers: auth() });
    expect(zero.status()).toBe(400);
    const big = await request.get(`${USER_API}/search/global?q=probe&limit=51`, { headers: auth() });
    expect(big.status()).toBe(400);
  });

  test('GS-05 limit=1 caps every section (bug #33)', async ({ request }) => {
    const res = await request.get(`${USER_API}/search/global?q=probe&limit=1`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.contacts.length).toBeLessThanOrEqual(1);
    expect(data.events.length).toBeLessThanOrEqual(1);
    expect(data.users.length).toBeLessThanOrEqual(1);
  });

  test('GS-06 missing q -> 400', async ({ request }) => {
    const res = await request.get(`${USER_API}/search/global`, { headers: auth() });
    expect(res.status()).toBe(400);
  });
});
