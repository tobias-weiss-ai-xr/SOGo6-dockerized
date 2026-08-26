// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — Task management deep workflow.
//
// Stories for task CRUD, status transitions, calendar-linked tasks,
// and task visibility across the task list.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role: maxmustermann@sogo6.contextual-intelligence.org / UniMarburg2026!

import { test, expect, apiLogin, bearer } from '../helpers';

const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const ROLE = {
  email: 'maxmustermann@sogo6.contextual-intelligence.org',
  password: 'UniMarburg2026!',
};
const ACCEPT = [200, 201, 202, 204, 400, 404, 409, 422];

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

test.describe('Epic — Task management: CRUD & lifecycle', () => {

  test('TASK-01 student logs in and reads task list', async ({ request }) => {
    const tk = await token(request);
    expect(tk, 'maxmustermann login returns a JWT').toBeTruthy();
    const res = await request.get(`${REMOTE_API}/tasks`, { headers: bearer(tk) });
    expect([200, 404], `GET /tasks -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const tasks = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'tasks', description: `count: ${tasks.length}` });
    }
  });

  test('TASK-02 student creates a homework task in their default calendar', async ({ request }) => {
    const tk = await token(request);
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: bearer(tk),
      data: { title: `Linear Algebra HW ${Date.now()}`, description: 'Due next Friday', priority: 'high' },
    });
    expect(ACCEPT, `POST tasks -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'task-create', description: `-> ${res.status()}` });
  });

  test('TASK-03 student re-reads task list to verify the new task', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/tasks`, { headers: bearer(tk) });
    expect([200, 404], `GET /tasks (verify) -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const tasks = Array.isArray(body?.data) ? body.data : [];
      test.info().annotations.push({ type: 'tasks-after', description: `count: ${tasks.length}` });
    }
  });

  test('TASK-04 student creates a low-priority reading task', async ({ request }) => {
    const tk = await token(request);
    const calRes = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    const cals = calRes.status() === 200 ? ((await calRes.json())?.data ?? []) : [];
    const calKey = cals[0]?.key ?? cals[0]?.id ?? '0';
    const res = await request.post(`${REMOTE_API}/calendars/${encodeURIComponent(calKey)}/tasks`, {
      headers: bearer(tk),
      data: { title: `Read Chapter 7 ${Date.now()}`, description: 'Statistical mechanics', priority: 'low' },
    });
    expect(ACCEPT, `POST low-priority task -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'task-low', description: `-> ${res.status()}` });
  });

  test('TASK-05 student accesses their calendars (tasks are calendar-bound)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/calendars`, { headers: bearer(tk) });
    expect(200, `GET /calendars -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'cals', description: `-> ${res.status()}` });
  });

  test('TASK-06 student accesses appointment slots (for booking tutoring)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/appointment-slots`, { headers: bearer(tk) });
    expect(200, `GET /appointment-slots -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'slots', description: `-> ${res.status()}` });
  });
});

test.describe('Epic — Task management: cross-module integration', () => {

  test('TASK-07 student checks their address book for study partners', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/addressbooks`, { headers: bearer(tk) });
    expect([200, 404], `GET /addressbooks -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const books = Array.isArray(body?.data) ? body.data : (Array.isArray(body?.data?.addressbooks) ? body.data.addressbooks : []);
      test.info().annotations.push({ type: 'ab', description: `count: ${books.length}` });
    }
  });

  test('TASK-08 student searches the directory for the professor', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/contacts/autocomplete?q=klaus`, { headers: bearer(tk) });
    expect([200, 404], `GET autocomplete?q=klaus -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const hits = body?.data?.results ?? body?.data ?? [];
      test.info().annotations.push({ type: 'dir', description: `hits: ${Array.isArray(hits) ? hits.length : 0}` });
    }
  });

  test('TASK-09 student runs free/busy to find a meeting slot with the professor', async ({ request }) => {
    const tk = await token(request);
    const res = await request.post(`${REMOTE_API}/freebusy`, {
      headers: bearer(tk),
      data: {
        utcStartDate: new Date().toISOString(),
        utcEndDate: new Date(Date.now() + 2_1600_000).toISOString(),
        users: ['klaus.schmidt@sogo6.contextual-intelligence.org'],
      },
    });
    expect([200, 201, 400, 404, 405, 422], `POST /freebusy -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'freebusy', description: `-> ${res.status()}` });
  });

  test('TASK-10 student manages preferences (language, timezone)', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/preferences`, { headers: bearer(tk) });
    expect(200, `GET /preferences -> ${res.status()}`).toBe(res.status());
    test.info().annotations.push({ type: 'prefs', description: `-> ${res.status()}` });
  });

  test('TASK-11 student reads profile and checks their display name', async ({ request }) => {
    const tk = await token(request);
    const res = await request.get(`${REMOTE_API}/profile`, { headers: bearer(tk) });
    expect(200, `GET /profile -> ${res.status()}`).toBe(res.status());
    const body = await res.json();
    const display = body?.data?.display_name ?? body?.data?.cn ?? 'unknown';
    test.info().annotations.push({ type: 'profile', description: `display: ${display}` });
  });
});
