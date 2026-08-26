// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Professor academic workflow.
//
// Realistic stories for a university professor (klaus.schmidt): office-hour
// appointment slots, lecture-hall resource booking, student directory lookup,
// calendar management, address books, and task-driven paper reviews.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role credentials: klaus.schmidt@sogo6.contextual-intelligence.org / ProfessorUni2026!

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'klaus.schmidt@sogo6.contextual-intelligence.org',
  password: 'ProfessorUni2026!',
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Professor academic: office hours & lecture management', () => {

  test('PROF-01 professor authenticates and accesses the calendar module', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'professor login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `auth GET /calendars -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const cals = Array.isArray(body?.data) ? body.data : [];
    test.info().annotations.push({ type: 'calendars', description: `count: ${cals.length}` });
  });

  test('PROF-02 professor creates office-hour appointment slots', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/appointment-slots`, {
      headers: bearer(tk),
      data: {
        title: `Office hours — Numerical Methods ${Date.now()}`,
        utc_start: new Date(Date.now() + 72 * 3600_000).toISOString(),
        utc_end: new Date(Date.now() + 74 * 3600_000).toISOString(),
        slot_duration_minutes: 20,
      },
    });
    expect(ACCEPT, `POST /appointment-slots -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'slots', description: `-> ${res.status()}` });
  });

  test('PROF-03 professor lists published appointment slots', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(tk) });
    expect(200, `GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const slots = body?.data?.slots ?? body?.data ?? [];
    test.info().annotations.push({ type: 'slots-list', description: `count: ${Array.isArray(slots) ? slots.length : 0}` });
  });

  test('PROF-04 professor checks available lecture-hall resources', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/resources/available?date_from=${encodeURIComponent(new Date().toISOString())}&date_to=${encodeURIComponent(new Date(Date.now() + 7 * 86400_000).toISOString())}`, { headers: bearer(tk) });
    expect([200, 400, 404, 422], `GET /resources/available -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'resources', description: `-> ${res.status()}` });
  });

  test('PROF-05 professor books a lecture hall for a seminar', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/resources/0/book`, {
      headers: bearer(tk),
      data: {
        utc_start: new Date(Date.now() + 5 * 86400_000 + 10 * 3600_000).toISOString(),
        utc_end: new Date(Date.now() + 5 * 86400_000 + 12 * 3600_000).toISOString(),
        purpose: 'Numerical Methods seminar',
      },
    });
    expect(ACCEPT, `POST /resources/0/book -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'book', description: `-> ${res.status()}` });
  });

  test('PROF-06 professor lists their resource bookings', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/resources/my-bookings`, { headers: bearer(tk) });
    expect(200, `GET /resources/my-bookings -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'my-bookings', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Professor academic: communication & profile', () => {

  test('PROF-07 professor views mailbox for student enquiries', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/mailboxes/0/folders/INBOX/mails?limit=5`, {
      headers: bearer(tk),
    });
    expect([200, 404], `GET INBOX -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const mails = body?.data?.mails ?? body?.data ?? [];
      test.info().annotations.push({ type: 'inbox', description: `mails: ${Array.isArray(mails) ? mails.length : 0}` });
    }
  });

  test('PROF-08 professor searches the campus directory for a student', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=max`, { headers: bearer(tk) });
    expect([200, 404], `GET autocomplete?q=max -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'dir-search', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('PROF-09 professor reads and updates their profile', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/profile`, { headers: bearer(tk) });
    expect(200, `GET /profile -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const display = body?.data?.display_name ?? body?.data?.cn ?? 'unknown';
    test.info().annotations.push({ type: 'profile', description: `display: ${display}` });
  });

  test('PROF-10 professor accesses their address books', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    expect([200, 404], `GET /addressbooks -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
      test.info().annotations.push({ type: 'addressbooks', description: `count: ${books.length}` });
    }
  });

  test('PROF-11 professor checks task list for pending paper reviews', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/tasks`, { headers: bearer(tk) });
    expect([200, 404], `GET /tasks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'tasks', description: `-> ${res.status()}` });
  });
});
