// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local calendar public subscription + ICS import round-trip @local.
//
//   POST   /calendars/<key>/subscription   → {public_url, share_token}
//   DELETE /calendars/<key>/subscription   → revoke
//   GET    /public/calendars/<token>       (unauthenticated, text/calendar)
//   POST   /calendars/<key>/import         (multipart file → agent job)
//
// Requires the background agent for the import job (calendar.import.ics).
//
//   npx playwright test local-calendar-subscription-import.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';
let calKey = '';

const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, LOCAL_API))!;
  expect(token).toBeTruthy();
  const res = await request.get(`${LOCAL_API}/calendars`, { headers: auth() });
  const cals = ((await res.json()).data ?? {}).calendars ?? [];
  const personal = cals.find((c: any) => /personal/i.test(c.name ?? ''));
  calKey = personal?.key;
  expect(calKey, 'personal calendar exists').toBeTruthy();
});

async function jobStatus(request: any, jobId: string): Promise<{ status: string; result: any }> {
  const res = await request.get(`${LOCAL_API}/jobs/${jobId}`, { headers: auth() });
  const data = (await res.json()).data ?? {};
  return { status: data.status ?? '', result: data.result };
}

// The job may 404 briefly before the agent persists its state, and the worker
// may be busy with other jobs — tolerate both with a generous deadline.
async function pollJob(request: any, jobId: string, deadlineMs = 90000) {
  const start = Date.now();
  let state = { status: '', result: undefined as any };
  let i = 0;
  while (Date.now() - start < deadlineMs) {
    await new Promise((r) => setTimeout(r, Math.min(1500 * i, 4000)));
    i += 1;
    state = await jobStatus(request, jobId);
    if (state.status === 'success' || state.status === 'failure') break;
  }
  return state;
}

test.describe('local calendar public subscription @local @calendar', () => {
  test('SUB-01 enabling the subscription returns a token + public URL', async ({ request }) => {
    const res = await request.post(`${LOCAL_API}/calendars/${calKey}/subscription`, {
      headers: json(),
      data: {},
    });
    expect(res.status(), `subscribe -> ${res.status()} ${await res.text()}`).toBe(200);
    const data = (await res.json()).data ?? {};
    expect(data.share_token).toBeTruthy();
    expect(data.public_url).toContain('/public/calendars/');
  });

  test('SUB-02 the public URL serves the ICS feed without authentication', async ({ request }) => {
    const sub = await request.post(`${LOCAL_API}/calendars/${calKey}/subscription`, {
      headers: json(),
      data: {},
    });
    const { share_token: shareToken } = (await sub.json()).data;
    const res = await request.get(`${LOCAL_API}/public/calendars/${shareToken}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
    const ics = await res.text();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
  });

  test('SUB-03 an unknown token is a 404 (capability URL)', async ({ request }) => {
    const res = await request.get(`${LOCAL_API}/public/calendars/0000000000000000000000000000000000000000000000000000000000000000`);
    expect(res.status()).toBe(404);
  });

  test('SUB-04 revoking the subscription invalidates the public URL', async ({ request }) => {
    // fresh token, then revoke
    const sub = await request.post(`${LOCAL_API}/calendars/${calKey}/subscription`, {
      headers: json(),
      data: {},
    });
    const { share_token: shareToken } = (await sub.json()).data;
    const del = await request.delete(`${LOCAL_API}/calendars/${calKey}/subscription`, { headers: auth() });
    expect([200, 204]).toContain(del.status());
    const gone = await request.get(`${LOCAL_API}/public/calendars/${shareToken}`);
    expect(gone.status()).toBe(404);
  });
});

test.describe('local calendar ICS import (agent job) @local @calendar @agent', () => {
  const scratch = `[local-e2e] import-scratch ${Date.now()}`;
  let scratchKey = '';

  /** POST an import, tolerating 409 S000804 (per-user job-name concurrency lock:
   * the previous import's lock can outlive its terminal job status by a beat). */
  async function submitImport(request: any, file: any): Promise<any> {
    let res: any = null;
    for (let i = 0; i < 5; i++) {
      res = await request.post(`${LOCAL_API}/calendars/${scratchKey}/import`, {
        headers: { ...auth() },
        multipart: { file },
      });
      if (res.status() !== 409) return res;
      await new Promise((r) => setTimeout(r, 2000));
    }
    return res!;
  }

  test.afterAll(async ({ request }) => {
    if (scratchKey) {
      await request.delete(`${LOCAL_API}/calendars/${scratchKey}`, { headers: auth() }).catch(() => {});
    }
  });

  test('IMP-01 export → import round-trip recreates the events in a new calendar', async ({ request }) => {
    test.setTimeout(150000);
    // 1. export the personal calendar as an agent job
    const exp = await request.get(`${LOCAL_API}/calendars/${calKey}/export`, { headers: auth() });
    expect(exp.status()).toBe(202);
    const jobId = (await exp.json()).data.job_id;
    const expState = await pollJob(request, jobId);
    expect(expState.status, 'export job must succeed').toBe('success');

    // 2. fetch the exported ICS
    const result = await request.get(`${LOCAL_API}/jobs/${jobId}/result`, { headers: auth() });
    expect(result.status()).toBe(200);
    const ics = await result.text();
    expect(ics).toContain('BEGIN:VCALENDAR');
    const sourceEvents = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(sourceEvents, 'exported ICS contains events').toBeGreaterThan(0);

    // 3. create a scratch calendar and import the ICS into it
    const create = await request.post(`${LOCAL_API}/calendars`, {
      headers: json(),
      data: { name: scratch },
    });
    expect(create.status(), `calendar create -> ${create.status()}`).toBeLessThan(300);
    scratchKey = (await create.json()).data.key;

    const imp = await submitImport(request, {
      name: 'export.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from(ics, 'utf8'),
    });
    expect(imp.status(), `import -> ${imp.status()} ${await imp.text()}`).toBe(202);
    const impState = await pollJob(request, (await imp.json()).data.job_id);
    expect(impState.status, 'import job must succeed').toBe('success');
    expect(
      (impState.result?.inserted ?? 0) + (impState.result?.updated ?? 0),
      'import counters must account for the exported events',
    ).toBeGreaterThan(0);

    // 4. the imported events must be visible in the scratch calendar.
    // NOTE: the listing API caps the window at MAX_EVENT_FETCH_DAYS = 45 —
    // wider windows are rejected with 400 S000606.
    const start = new Date(Date.now() - 7 * 86400000).toISOString();
    const end = new Date(Date.now() + 30 * 86400000).toISOString();
    const list = await request.get(
      `${LOCAL_API}/calendars/${scratchKey}/events?start_date_time=${encodeURIComponent(start)}&end_date_time=${encodeURIComponent(end)}`,
      { headers: auth() },
    );
    const events = ((await list.json()).data ?? {}).events ?? [];
    expect(events.length, 'imported calendar has events inside the listing window').toBeGreaterThan(0);
  });

  test('IMP-02 a malformed ICS fails the job gracefully (no hang, no crash)', async ({ request }) => {
    test.setTimeout(90000);
    if (!scratchKey) test.skip(true, 'scratch calendar unavailable');
    const res = await submitImport(request, {
      name: 'broken.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from('BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nBROKEN', 'utf8'),
    });
    expect(res.status()).toBe(202);
    const state = await pollJob(request, (await res.json()).data.job_id);
    expect(state.status).toBe('failure');
  });
});
