// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar iTIP REPLY + CANCEL legs (@local).
//
// local-itip.spec.ts covers the REQUEST leg (organizer -> attendee). This
// spec covers the remaining two RFC 5546 legs:
//
//   REPLY  — the attendee answers (attendance accepted) and the ORGANIZER
//            receives a "Re: <title>" mail carrying METHOD:REPLY and
//            PARTSTAT=ACCEPTED in a text/calendar part.
//   CANCEL — the organizer deletes the event and the ATTENDEE receives a
//            "Cancelled: <title>" mail; the attendee's auto-imported copy
//            disappears from their calendar.
//
// Subject prefixes pinned in app/module/calendar/CalendarConst.py:
//   REQUEST -> "Invitation", REPLY -> "Re", CANCEL -> "Cancelled".
//
// Listing caveat: /calendars/<key>/events only returns events inside an
// EXPLICIT start_date_time/end_date_time window (verified 2026-08-30).
//
//   npx playwright test local-itip-cancel-reply.spec.ts

import { test, expect, apiLogin, cleanupLocalMail } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const MARKER = '[local-e2e] ';
const ORG = { email: 'testuser@example.org', password: 'password123' };
const ATT = { email: 'testuser2@example.org', password: 'password123' };

let orgToken = '';
let attToken = '';
let title = '';

const orgAuth = () => ({ Authorization: `Bearer ${orgToken}` });
const attAuth = () => ({ Authorization: `Bearer ${attToken}` });
const json = (auth: () => any) => ({ ...auth(), 'Content-Type': 'application/json' });

async function personalKey(request: any, auth: () => any): Promise<string> {
  const res = await request.get(`${LOCAL_API}/calendars`, { headers: auth() });
  const calList = ((await res.json()).data ?? {}).calendars ?? [];
  const personal = calList.find((c: any) => /personal/i.test(c.name ?? ''));
  expect(personal, 'personal calendar exists').toBeTruthy();
  return personal.key;
}

/** List mails of `folder` (INBOX | Junk Mail) for a given auth. */
async function listMails(request: any, folder: string, auth: () => any): Promise<any[]> {
  const res = await request.get(
    `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails`,
    { headers: auth() },
  );
  return (await res.json()).data ?? [];
}

/** Find a mail by exact subject in INBOX ∪ Junk Mail, polling up to 30s. */
async function findMailBySubject(
  request: any,
  subject: string,
  auth: () => any,
): Promise<any | undefined> {
  for (let i = 0; i < 15; i += 1) {
    for (const folder of ['INBOX', 'Junk Mail']) {
      const hit = (await listMails(request, folder, auth)).find((m: any) => m.subject === subject);
      if (hit) return hit;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return undefined;
}

test.beforeAll(async ({ request }) => {
  orgToken = (await apiLogin(request, ORG.email, ORG.password, LOCAL_API))!;
  attToken = (await apiLogin(request, ATT.email, ATT.password, LOCAL_API))!;
  expect(orgToken).toBeTruthy();
  expect(attToken).toBeTruthy();

  title = `${MARKER}itip-cr ${Date.now()}`;
  const calKey = await personalKey(request, orgAuth);
  const res = await request.post(`${LOCAL_API}/calendars/${calKey}/events`, {
    headers: json(orgAuth),
    data: {
      title,
      description: 'itip reply/cancel legs probe',
      date_start: new Date(Date.now() + 2 * 86400000).toISOString().replace('.000Z', 'Z'),
      date_end: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString().replace('.000Z', 'Z'),
      timezone: 'Europe/Paris',
      attendees: [{ email: ATT.email, role: 'required', rsvp: true }],
    },
  });
  expect(res.status(), `create event -> ${res.status()} ${await res.text()}`).toBe(201);
});

test.afterAll(async ({ request }) => {
  // organizer-side delete is idempotent here (event may already be gone);
  // also try the attendee's copy and purge marker mails in both mailboxes.
  for (const auth of [orgAuth, attAuth]) {
    const res = await request.get(`${LOCAL_API}/calendars`, { headers: auth() });
    for (const cal of ((await res.json()).data ?? {}).calendars ?? []) {
      if (!/personal/i.test(cal.name ?? '')) continue;
      const window = `start_date_time=${encodeURIComponent(
        new Date(Date.now() + 86400000).toISOString(),
      )}&end_date_time=${encodeURIComponent(new Date(Date.now() + 5 * 86400000).toISOString())}`;
      const evs = await request.get(`${LOCAL_API}/calendars/${cal.key}/events?${window}`, {
        headers: auth(),
      });
      for (const ev of ((await evs.json()).data ?? {}).events ?? []) {
        if (ev.title === title) {
          await request.delete(`${LOCAL_API}/events/${ev.key}`, { headers: auth() }).catch(() => {});
        }
      }
    }
  }
  await cleanupLocalMail();
});

test.describe('local calendar iTIP REPLY + CANCEL legs @local @calendar @mail', () => {
  test('ITIP-C01 attendee acceptance lands a REPLY mail in the organizer mailbox', async ({ request }) => {
    // wait for the auto-imported event in the attendee calendar
    const calKey = await personalKey(request, attAuth);
    const window = `start_date_time=${encodeURIComponent(
      new Date(Date.now() + 86400000).toISOString(),
    )}&end_date_time=${encodeURIComponent(new Date(Date.now() + 5 * 86400000).toISOString())}`;
    let imported: any;
    for (let i = 0; i < 15 && !imported; i += 1) {
      const events = await request.get(`${LOCAL_API}/calendars/${calKey}/events?${window}`, {
        headers: attAuth(),
      });
      imported = (((await events.json()).data ?? {}).events ?? []).find(
        (e: any) => e.title === title,
      );
      if (!imported) await new Promise((r) => setTimeout(r, 2000));
    }
    expect(imported, 'attendee sees the auto-imported event').toBeTruthy();

    // accept → REPLY must go out
    const res = await request.post(`${LOCAL_API}/events/${imported.key}/attendance`, {
      headers: json(attAuth),
      data: { status: 'accepted' },
    });
    expect(res.status(), `attendance -> ${res.status()} ${await res.text()}`).toBe(200);

    const reply = await findMailBySubject(request, `Re: ${title}`, orgAuth);
    expect(reply, 'organizer receives a "Re: <title>" REPLY mail').toBeTruthy();
  });

  test('ITIP-C02 the REPLY mail carries METHOD:REPLY + PARTSTAT=ACCEPTED', async ({ request }) => {
    const reply = await findMailBySubject(request, `Re: ${title}`, orgAuth);
    expect(reply).toBeTruthy();

    const raw = await request.get(
      `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent('Junk Mail')}/mails/${reply.uid}/raw`,
      { headers: orgAuth() },
    );
    if (raw.status() !== 200) {
      const alt = await request.get(
        `${LOCAL_API}/mailboxes/0/folders/INBOX/mails/${reply.uid}/raw`,
        { headers: orgAuth() },
      );
      expect(alt.status(), 'raw source of the REPLY is retrievable').toBe(200);
      const text = await alt.text();
      expect(text).toContain('METHOD:REPLY');
      expect(text).toContain('PARTSTAT=ACCEPTED');
      return;
    }
    const text = await raw.text();
    expect(text).toContain('METHOD:REPLY');
    expect(text).toContain('PARTSTAT=ACCEPTED');

    // and the structured detail classifies the mail as an event invitation
    const detailFolder = encodeURIComponent('Junk Mail');
    const detail = await request.get(
      `${LOCAL_API}/mailboxes/0/folders/${detailFolder}/mails/${reply.uid}`,
      { headers: orgAuth() },
    );
    if (detail.status() === 200) {
      const data = (await detail.json()).data ?? {};
      expect((data.mail_type ?? [])).toContain('event');
    }
  });

  test('ITIP-D01 organizer delete emits a CANCEL mail to the attendee', async ({ request }) => {
    const calKey = await personalKey(request, orgAuth);
    const window = `start_date_time=${encodeURIComponent(
      new Date(Date.now() + 86400000).toISOString(),
    )}&end_date_time=${encodeURIComponent(new Date(Date.now() + 5 * 86400000).toISOString())}`;
    const events = await request.get(`${LOCAL_API}/calendars/${calKey}/events?${window}`, {
      headers: orgAuth(),
    });
    const ev = (((await events.json()).data ?? {}).events ?? []).find((e: any) => e.title === title);
    expect(ev, 'organizer still has the event').toBeTruthy();

    const res = await request.delete(`${LOCAL_API}/events/${ev.key}`, { headers: orgAuth() });
    expect(res.status(), `delete -> ${res.status()}`).toBe(200);

    const cancel = await findMailBySubject(request, `Cancelled: ${title}`, attAuth);
    expect(cancel, 'attendee receives a "Cancelled: <title>" mail').toBeTruthy();
  });

  test('ITIP-D02 the attendee auto-imported copy is gone after the cancellation', async ({ request }) => {
    const calKey = await personalKey(request, attAuth);
    const window = `start_date_time=${encodeURIComponent(
      new Date(Date.now() + 86400000).toISOString(),
    )}&end_date_time=${encodeURIComponent(new Date(Date.now() + 5 * 86400000).toISOString())}`;
    // the copy disappears server-side; allow a short grace period
    let stillThere: any;
    const deadline = Date.now() + 20000;
    do {
      const events = await request.get(`${LOCAL_API}/calendars/${calKey}/events?${window}`, {
        headers: attAuth(),
      });
      stillThere = (((await events.json()).data ?? {}).events ?? []).find(
        (e: any) => e.title === title,
      );
      if (stillThere) await new Promise((r) => setTimeout(r, 2000));
    } while (stillThere && Date.now() < deadline);
    expect(stillThere, 'cancelled event must vanish from the attendee calendar').toBeFalsy();
  });
});
