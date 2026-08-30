// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Local scheduled-send (agent job) @local.
//
//   POST /api/user/v1/mailboxes/0/mail/send  {send_at: ISO} → scheduled job
//   POST /api/user/v1/mailboxes/0/mail/pending/<key>/cancel  (undo send)
//
// Requires the background agent (docker compose --profile agent up -d
// sogo6-agent) — scheduled mail is delivered by the schedule_send job.
//
// Regression context (2026-08-30): ScheduleSendJob.process kept an outdated
// signature (no user_uid kwarg) and the job payload carried no user session,
// so EVERY scheduled send failed in the agent after 3 retries and the mail
// was silently dropped.
//
//   npx playwright test local-mail-schedule.spec.ts

import { test, expect, apiLogin } from '../helpers';

const API = 'http://localhost:5001';
const LOCAL_API = `${API}/api/user/v1`;
const SEND = `${LOCAL_API}/mailboxes/0/mail/send`;
const USER = { email: 'testuser@example.org', password: 'password123' };

let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  token = (await apiLogin(request, USER.email, USER.password, LOCAL_API))!;
  expect(token).toBeTruthy();
});

async function jobStatus(request: any, jobId: string): Promise<string> {
  const res = await request.get(`${LOCAL_API}/jobs/${jobId}`, { headers: auth() });
  return ((await res.json()).data ?? {}).status ?? '';
}

// The job may 404 briefly before the agent persists its state — keep polling.
async function pollJob(request: any, jobId: string, deadlineMs = 90000): Promise<string> {
  const start = Date.now();
  let status = '';
  let i = 0;
  while (Date.now() - start < deadlineMs) {
    await new Promise((r) => setTimeout(r, Math.min(1500 * i, 4000)));
    i += 1;
    status = await jobStatus(request, jobId);
    if (status === 'success' || status === 'failure') break;
  }
  return status;
}

async function findInFolder(request: any, folder: string, subject: string) {
  const res = await request.get(
    `${LOCAL_API}/mailboxes/0/folders/${encodeURIComponent(folder)}/mails?per_page=30`,
    { headers: auth() },
  );
  const data = (await res.json()).data;
  const mails = Array.isArray(data) ? data : data?.mails ?? [];
  return mails.find((m: any) => m.subject === subject);
}

test.describe('local scheduled send @local @mail @agent', () => {
  test('SCHED-01 send_at +5s schedules a job, the agent delivers the mail', async ({ request }) => {
    test.setTimeout(120000);
    const subject = `[local-e2e] sched ${Date.now()}`;
    const sendAt = new Date(Date.now() + 5000).toISOString().replace(/\.\d{3}Z/, 'Z');

    const res = await request.post(SEND, {
      headers: json(),
      data: {
        from: USER.email,
        to: [USER.email],
        subject,
        body: 'delivered by the schedule_send agent job',
        send_at: sendAt,
      },
    });
    expect(res.status(), `send -> ${res.status()} ${await res.text()}`).toBe(200);
    const data = (await res.json()).data ?? {};
    expect(data.status).toBe('scheduled');
    expect(data.job_id).toMatch(/[0-9a-f-]{36}/);

    const status = await pollJob(request, data.job_id);
    expect(status, `agent job must succeed (got ${status})`).toBe('success');

    // delivery lands in INBOX or Junk Mail (anti-spam), like other local suites
    const found = (await findInFolder(request, 'INBOX', subject))
      ?? (await findInFolder(request, 'Junk Mail', subject));
    expect(found, `subject "${subject}" must be delivered`).toBeTruthy();
  });

  test('SCHED-02 send_at beyond the max delay is rejected (400 S000489)', async ({ request }) => {
    const far = new Date(Date.now() + 400 * 86400000).toISOString().replace(/\.\d{3}Z/, 'Z');
    const res = await request.post(SEND, {
      headers: json(),
      data: { from: USER.email, to: [USER.email], subject: 'far future', body: 'x', send_at: far },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error_code).toBe('S000489');
  });

  test('SCHED-03 send_at in the past sends immediately (not scheduled)', async ({ request }) => {
    test.setTimeout(90000);
    const subject = `[local-e2e] sched-past ${Date.now()}`;
    const past = new Date(Date.now() - 10000).toISOString().replace(/\.\d{3}Z/, 'Z');
    const res = await request.post(SEND, {
      headers: json(),
      data: { from: USER.email, to: [USER.email], subject, body: 'past date', send_at: past },
    });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    // immediate send: no scheduled marker (undo-send is disabled locally)
    expect(data?.status ?? null).not.toBe('scheduled');
    const found = (await findInFolder(request, 'INBOX', subject))
      ?? (await findInFolder(request, 'Junk Mail', subject));
    expect(found, 'past-dated mail must still be delivered').toBeTruthy();
  });

  test('UNDO-01 cancelling an unknown pending send is a 404', async ({ request }) => {
    const res = await request.post(
      `${LOCAL_API}/mailboxes/0/mail/pending/00000000-0000-0000-0000-000000000000/cancel`,
      { headers: json(), data: {} },
    );
    expect([404, 410]).toContain(res.status());
  });
});
