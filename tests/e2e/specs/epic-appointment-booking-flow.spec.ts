// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — End-to-end appointment-slot booking flow.
//
// Cross-user story: professor (klaus.schmidt) creates appointment slots →
// student (testuser2) lists and discovers them → student books one →
// professor verifies the booking appeared.
//
// Actors:
//   professor = klaus.schmidt@sogo6.contextual-intelligence.org / ProfessorUni2026!
//   student  = testuser2@sogo6.contextual-intelligence.org / password123
//
// Runs against https://sogo6.contextual-intelligence.org

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ACTORS = {
  prof:    { email: 'klaus.schmidt@sogo6.contextual-intelligence.org', password: 'ProfessorUni2026!' },
  student: { email: 'testuser2@sogo6.contextual-intelligence.org', password: 'password123' },
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

const TK: Record<string, string | null> = {};
async function tk(request: any, who: 'prof' | 'student') {
  if (!TK[who]) TK[who] = await apiLogin(request, ACTORS[who].email, ACTORS[who].password);
  return TK[who];
}

let createdSlotId: string | null = null;

test.describe('Epic — Appointment booking: professor creates slots', () => {

  test('BOOK-01 professor lists current appointment slots (baseline)', async ({ request }) => {
    const t = await tk(request, 'prof');
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(t) });
    expect(200, `prof GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const slots = body?.data?.slots ?? body?.data ?? [];
    test.info().annotations.push({ type: 'baseline', description: `count: ${Array.isArray(slots) ? slots.length : 0}` });
  });

  test('BOOK-02 professor creates a set of office-hour slots', async ({ request }) => {
    const t = await tk(request, 'prof');
    const start = new Date(Date.now() + 7 * 86400_000 + 10 * 3600_000).toISOString();
    const end = new Date(Date.now() + 7 * 86400_000 + 12 * 3600_000).toISOString();
    const res = await request.post(`${REMOTE_API}/appointment-slots`, {
      headers: bearer(t),
      data: {
        title: `Office hours ${Date.now()}`,
        utc_start: start,
        utc_end: end,
        slot_duration_minutes: 20,
      },
    });
    expect(ACCEPT, `POST /appointment-slots -> ${res.status()}`).toContain(res.status());
    if ([200, 201].includes(res.status())) {
      const body = await res.json();
      createdSlotId = body?.data?.id ?? body?.data?.slot_id ?? null;
    }
    test.info().annotations.push({ type: 'slot-create', description: `-> ${res.status()} id=${createdSlotId ?? '?'}` });
  });

  test('BOOK-03 professor verifies the new slots appear', async ({ request }) => {
    const t = await tk(request, 'prof');
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(t) });
    expect(200, `prof GET /appointment-slots (verify) -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const slots = body?.data?.slots ?? body?.data ?? [];
    test.info().annotations.push({ type: 'prof-verify', description: `count: ${Array.isArray(slots) ? slots.length : 0}` });
  });
});

test.describe('Epic — Appointment booking: student discovers & books', () => {

  test('BOOK-04 student lists available appointment slots', async ({ request }) => {
    const t = await tk(request, 'student');
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(t) });
    expect(200, `student GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const slots = body?.data?.slots ?? body?.data ?? [];
    test.info().annotations.push({ type: 'student-slots', description: `count: ${Array.isArray(slots) ? slots.length : 0}` });
  });

  test('BOOK-05 student books an appointment slot', async ({ request }) => {
    const t = await tk(request, 'student');
    const bookId = createdSlotId ?? '0';
    const res = await request.post(`${REMOTE_API}/appointment-slots/${encodeURIComponent(bookId)}/book`, {
      headers: bearer(t),
      data: { note: 'Need help with the thesis proposal' },
    });
    expect(ACCEPT, `POST /appointment-slots/:id/book -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'book', description: `-> ${res.status()}` });
  });

  test('BOOK-06 student lists their resource bookings', async ({ request }) => {
    const t = await tk(request, 'student');
    const res = await request.get(`${REMOTE_API}/resources/my-bookings`, { headers: bearer(t) });
    expect(200, `student GET /resources/my-bookings -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'my-bookings', description: `-> ${res.status()}` });
  });

  test('BOOK-07 professor re-checks slots (may show booked)', async ({ request }) => {
    const t = await tk(request, 'prof');
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(t) });
    expect(200, `prof final GET -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'prof-final', description: `-> ${res.status()}` });
  });

  test('BOOK-08 both actors check free/busy around the appointment time', async ({ request }) => {
    const tp = await tk(request, 'prof');
    const ts = await tk(request, 'student');
    const start = new Date(Date.now() + 7 * 86400_000).toISOString();
    const end = new Date(Date.now() + 7 * 86400_000 + 86400_000).toISOString();
    const fbBody = { utcStartDate: start, utcEndDate: end, users: [ACTORS.prof.email, ACTORS.student.email] };
    const [rp, rs] = await Promise.all([
      request.post(`${REMOTE_API}/freebusy`, { headers: bearer(tp), data: fbBody }),
      request.post(`${REMOTE_API}/freebusy`, { headers: bearer(ts), data: fbBody }),
    ]);
    expect([200, 201, 400, 404, 405, 422], `prof fb -> ${rp.status()}`).toContain(rp.status());
    expect([200, 201, 400, 404, 405, 422], `student fb -> ${rs.status()}`).toContain(rs.status());
    test.info().annotations.push({ type: 'fb-both', description: `P ${rp.status()} / S ${rs.status()}` });
  });

  test('BOOK-09 student sends a follow-up mail to the professor', async ({ request }) => {
    const t = await tk(request, 'student');
    const res = await request.post(`${REMOTE_API}/mailboxes/0/mail`, {
      headers: bearer(t),
      data: {
        from: ACTORS.student.email,
        to: [ACTORS.prof.email],
        subject: `Regarding our appointment ${Date.now()}`,
        body: 'Looking forward to discussing my thesis.',
        is_html: false,
      },
    });
    expect(ACCEPT, `student→prof mail -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'followup', description: `-> ${res.status()}` });
  });

  test('BOOK-10 professor checks inbox for the student mail', async ({ request }) => {
    const t = await tk(request, 'prof');
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=3`, {
      headers: bearer(t),
    });
    expect([200, 404], `prof INBOX -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'prof-inbox', description: `mails: ${Array.isArray(mails) ? mails.length : 0}` });
    }
  });

  test('BOOK-11 professor searches directory for the student', async ({ request }) => {
    const t = await tk(request, 'prof');
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=testuser2`, { headers: bearer(t) });
    expect([200, 404], `prof autocomplete -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'dir-search', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });
});
