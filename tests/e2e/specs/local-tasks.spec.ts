// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Tasks (VTODO) surface (@local): create/read/list/patch/delete with
// date_due semantics, status enum transitions and completed_at stamping
// (bug #32 regression). Runs on testuser's personal calendar.

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER_API = `${API}/api/user/v1`;

const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TITLE = `[local-e2e] task ${STAMP}`;

let userToken = '';
let calendarKey = '';

const auth = () => ({ Authorization: `Bearer ${userToken}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${USER_API}/auth/login`, {
    data: { username: 'testuser@example.org', password: 'password123' },
  });
  expect(login.status()).toBe(200);
  userToken = (await login.json()).data.jwt_token;

  const cals = await request.get(`${USER_API}/calendars`, { headers: auth() });
  const list = (await cals.json()).data.calendars ?? [];
  calendarKey = '6abddb60-547b-41b0-8a3e-56e4309a5550';
  if (!list.some((c: any) => c.key === calendarKey)) {
    calendarKey = list[0].key;
  }
});

async function createTask(request: any, overrides: Record<string, unknown> = {}) {
  const res = await request.post(`${USER_API}/calendars/${calendarKey}/tasks`, {
    headers: json(),
    data: { title: TITLE, ...overrides },
  });
  expect(res.status(), `create: ${await res.text()}`).toBe(201);
  return (await res.json()).data as Record<string, any>;
}

test.describe('local tasks @local @tasks', () => {
  test('TK-01 create returns a VTODO with defaults', async ({ request }) => {
    const task = await createTask(request, { priority: 3 });
    expect(task.key).toMatch(/[0-9a-f-]{36}/);
    expect(task.component_type).toBe('task');
    expect(task.status).toBe('needs_action');
    expect(task.priority).toBe(3);
    expect(task.percent_complete ?? null).toBeNull();
    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-02 date_due is the field; due_date -> 422', async ({ request }) => {
    const bad = await request.post(`${USER_API}/calendars/${calendarKey}/tasks`, {
      headers: json(),
      data: { title: TITLE, due_date: '2026-10-01T17:00:00Z' },
    });
    expect(bad.status()).toBe(422);
  });

  test('TK-03 date_due round-trips with ms precision', async ({ request }) => {
    const task = await createTask(request, { date_due: '2026-10-01T17:00:00Z' });
    expect(task.date_due.startsWith('2026-10-01T17:00:00')).toBe(true);
    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-04 invalid status on create -> 422 listing the enum', async ({ request }) => {
    const bad = await request.post(`${USER_API}/calendars/${calendarKey}/tasks`, {
      headers: json(),
      data: { title: TITLE, status: 'confirmed' },
    });
    expect(bad.status()).toBe(422);
    const body = await bad.json();
    const msg: string = JSON.stringify(body.errors ?? {});
    expect(msg).toContain('needs_action');
    expect(msg).toContain('completed');
  });

  test('TK-05 get single task by key', async ({ request }) => {
    const task = await createTask(request);
    const res = await request.get(`${USER_API}/tasks/${task.key}`, { headers: auth() });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.key).toBe(task.key);
    expect(data.title).toBe(TITLE);
    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-06 list includes the task; search narrows by token', async ({ request }) => {
    const task = await createTask(request, { description: `searchable ${STAMP}` });
    const all = await request.get(`${USER_API}/tasks`, { headers: auth() });
    expect(all.status()).toBe(200);
    const data = (await all.json()).data;
    expect(data.total_count).toBeGreaterThanOrEqual(1);
    expect(data.tasks.some((t: any) => t.key === task.key)).toBe(true);

    const hit = await request.get(`${USER_API}/tasks?search=${STAMP}`, { headers: auth() });
    const hitTasks = ((await hit.json()).data ?? {}).tasks ?? [];
    expect(hitTasks.some((t: any) => t.key === task.key)).toBe(true);
    expect(hitTasks.every((t: any) => t.title === TITLE)).toBe(true);

    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-07 completing stamps completed_at (bug #32)', async ({ request }) => {
    const task = await createTask(request);
    const res = await request.patch(`${USER_API}/tasks/${task.key}`, {
      headers: json(),
      data: { status: 'completed' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const data = (await res.json()).data;
    expect(data.status).toBe('completed');
    expect(data.completed_at).toBeTruthy();
    expect(String(data.completed_at)).toMatch(/^2026-\d{2}-\d{2}T/);
    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-08 create-as-completed stamps too; reopening clears (bug #32)', async ({ request }) => {
    const task = await createTask(request, { status: 'completed' });
    expect(task.status).toBe('completed');
    expect(task.completed_at).toBeTruthy();

    const reopen = await request.patch(`${USER_API}/tasks/${task.key}`, {
      headers: json(),
      data: { status: 'needs_action' },
    });
    const reopened = (await reopen.json()).data;
    expect(reopened.status).toBe('needs_action');
    expect(reopened.completed_at).toBeNull();
    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-09 percent_complete patch round-trips', async ({ request }) => {
    const task = await createTask(request);
    const res = await request.patch(`${USER_API}/tasks/${task.key}`, {
      headers: json(),
      data: { percent_complete: 40 },
    });
    expect(((await res.json()).data ?? {}).percent_complete).toBe(40);
    await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
  });

  test('TK-10 delete -> 200 then GET -> 404; unknown task -> 404', async ({ request }) => {
    const task = await createTask(request);
    const del = await request.delete(`${USER_API}/tasks/${task.key}`, { headers: auth() });
    expect(del.status()).toBe(200);
    const gone = await request.get(`${USER_API}/tasks/${task.key}`, { headers: auth() });
    expect(gone.status()).toBe(404);
    const unknown = await request.get(`${USER_API}/tasks/no-such-task`, { headers: auth() });
    expect(unknown.status()).toBe(404);
  });
});
