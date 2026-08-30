// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar iTIP (iMIP) round-trip (@local).
//
// testuser creates an event with testuser2 as attendee -> the server emits an
// iMIP REQUEST email -> the mail arrives via Stalwart SMTP (anti-spam files
// it into Junk Mail) -> opening the invitation auto-imports the event into
// testuser2's calendar -> attendance can be accepted.
//
// Listing caveat (verified 2026-08-30): /calendars/<key>/events and /events
// only return events within an EXPLICIT start_date_time/end_date_time window;
// without them future-dated events are not listed. All listings below pass the
// window explicitly.
//
//   npx playwright test local-itip.spec.ts

import { test, expect, apiLogin, cleanupLocalMail } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const MARKER = '[local-e2e] ';
const ORG = { email: 'testuser@example.org', password: 'password123' };
const ATT = { email: 'testuser2@example.org', password: 'password123' };

let orgToken = '';
let attToken = '';
let createdEventKey = '';
let createdTitle = '';

const orgAuth = () => ({ Authorization: `Bearer ${orgToken}` });
const attAuth = () => ({ Authorization: `Bearer ${attToken}` });
const json = (auth: () => any) => ({ ...auth(), 'Content-Type': 'application/json' });

function dayWindow(startOffsetDays: number, endOffsetDays: number): string {
  const start = new Date(Date.now() + startOffsetDays * 86400000);
  const end = new Date(Date.now() + endOffsetDays * 86400000);
  return `start_date_time=${encodeURIComponent(start.toISOString())}&end_date_time=${encodeURIComponent(end.toISOString())}`;
}

test.beforeAll(async ({ request }) => {
  orgToken = (await apiLogin(request, ORG.email, ORG.password, LOCAL_API))!;
  attToken = (await apiLogin(request, ATT.email, ATT.password, LOCAL_API))!;
  expect(orgToken).toBeTruthy();
  expect(attToken).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  // best-effort cleanup: delete the organizer's event (this also emits a
  // CANCEL to the attendee) and purge marker mails from both mailboxes.
  if (createdEventKey) {
    await request.delete(`${LOCAL_API}/events/${createdEventKey}`, { headers: orgAuth() }).catch(() => {});
  }
  await request.delete(`${LOCAL_API}/events/${createdEventKey}`, { headers: attAuth() }).catch(() => {});
  await cleanupLocalMail();
});

test.describe('local calendar iTIP round-trip @local @calendar @mail', () => {
  test('ITIP-01 create an event with an attendee emits an iMIP invitation mail', async ({ request }) => {
    const ts = Date.now();
    const title = `${MARKER}itip ${ts}`;
    createdTitle = title;
    const calendars = await request.get(`${LOCAL_API}/calendars`, { headers: orgAuth() });
    const calList = ((await calendars.json()).data ?? {}).calendars ?? [];
    const personal = calList.find((c: any) => /personal/i.test(c.name ?? ''));
    expect(personal).toBeTruthy();

    const res = await request.post(`${LOCAL_API}/calendars/${personal.key}/events`, {
      headers: json(orgAuth),
      data: {
        title,
        description: 'itip roundtrip probe',
        date_start: new Date(Date.now() + 2 * 86400000).toISOString().replace('.000Z', 'Z'),
        date_end: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString().replace('.000Z', 'Z'),
        timezone: 'Europe/Paris',
        attendees: [{ email: ATT.email, role: 'required', rsvp: true }],
      },
    });
    expect(res.status(), `create event -> ${res.status()} ${await res.text()}`).toBe(201);
    const body = await res.json();
    createdEventKey = body.data.key;
    expect((body.data.attendees ?? []).some((a: any) => a.email === ATT.email)).toBe(true);

    // Invitation must arrive in the attendee's mailbox (INBOX or Junk Mail).
    let uid: string | undefined;
    for (let i = 0; i < 12; i += 1) {
      for (const folder of ['INBOX', 'Junk Mail']) {
        const list = await request.get(
          `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails`,
          { headers: attAuth() },
        );
        const mails = (await list.json()).data ?? [];
        const hit = mails.find((m: any) => m.subject === `Invitation: ${title}`);
        if (hit) {
          uid = String(hit.uid);
          break;
        }
      }
      if (uid) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    test.info().annotations.push({ type: 'delivery', description: `invite uid=${uid ?? 'NOT FOUND'}` });
    expect(uid, 'iMIP invitation mail must be delivered to the attendee').toBeTruthy();

    // Opening the invitation processes the iMIP REQUEST and imports the event.
    const detail = await request.get(
      `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent('Junk Mail')}/mails/${uid}`,
      { headers: attAuth() },
    );
    // the invite is in Junk OR INBOX — try both
    if (detail.status() !== 200) {
      const alt = await request.get(`${LOCAL_API}/mailboxes/0/folders/INBOX/mails/${uid}`, { headers: attAuth() });
      expect(alt.status()).toBe(200);
    }
  });

  test('ITIP-02 the imported event is visible in the attendee calendar with attendee data', async ({ request }) => {
    // locate the event by title in the attendee's personal calendar
    const calendars = await request.get(`${LOCAL_API}/calendars`, { headers: attAuth() });
    const calList = ((await calendars.json()).data ?? {}).calendars ?? [];
    const personal = calList.find((c: any) => /personal/i.test(c.name ?? ''));
    expect(personal).toBeTruthy();

    const window = dayWindow(1, 4);
    let found: any;
    for (let i = 0; i < 10; i += 1) {
      const events = await request.get(`${LOCAL_API}/calendars/${personal.key}/events?${window}`, {
        headers: attAuth(),
      });
      const evs = ((await events.json()).data ?? {}).events ?? [];
      found = evs.find((e: any) => e.title === createdTitle);
      if (found) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(found, 'attendee must see the auto-imported event').toBeTruthy();
    expect((found.attendees ?? []).some((a: any) => a.email === ATT.email)).toBe(true);
  });

  test('ITIP-03 attendance can be accepted on the imported event and persists', async ({ request }) => {
    const calendars = await request.get(`${LOCAL_API}/calendars`, { headers: attAuth() });
    const calList = ((await calendars.json()).data ?? {}).calendars ?? [];
    const personal = calList.find((c: any) => /personal/i.test(c.name ?? ''));
    const window = dayWindow(1, 4);
    const events = await request.get(`${LOCAL_API}/calendars/${personal.key}/events?${window}`, {
      headers: attAuth(),
    });
    const imported = ((await events.json()).data ?? {}).events?.find((e: any) => e.title === createdTitle);
    expect(imported).toBeTruthy();

    const res = await request.post(`${LOCAL_API}/events/${imported.key}/attendance`, {
      headers: json(attAuth),
      data: { status: 'accepted' },
    });
    expect(res.status(), `attendance -> ${res.status()} ${await res.text()}`).toBe(200);

    // re-list and confirm persisted
    const again = await request.get(`${LOCAL_API}/calendars/${personal.key}/events?${window}`, {
      headers: attAuth(),
    });
    const evs = ((await again.json()).data ?? {}).events ?? [];
    const self = evs
      .find((e: any) => e.title === createdTitle)
      ?.attendees?.find((a: any) => a.email === ATT.email);
    expect(self.status).toBe('accepted');
  });
});
