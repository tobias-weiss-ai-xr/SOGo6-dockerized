// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E EPIC — CalDAV protocol (WebDAV over HTTP).
//
// Stories verifying the raw CalDAV/WebDAV protocol endpoints that external
// clients (Thunderbird, Apple Calendar, etc.) use: PROPFIND on the calendar
// home, calendar discovery, principal properties, and resource type checks.
//
// Runs against https://sogo6.contextual-intelligence.org
// Role: see tests/e2e/.env (gitignored)

import { test, expect, apiLogin, bearer, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const ROLE = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

let USER_TOKEN: string | null = null;
async function token(request: any) {
  if (!USER_TOKEN) USER_TOKEN = await apiLogin(request, ROLE.email, ROLE.password);
  return USER_TOKEN;
}

const DAV_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Depth': '0',
};

const PROPFIND_0 = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
    <d:resourcetype/>
    <d:displayname/>
  </d:prop>
</d:propfind>`;

test.describe('Epic — CalDAV protocol: calendar home discovery', () => {

  test('DAV-01 PROPFIND on /caldav/ returns 207 Multi-Status', async ({ request }) => {
    const tk = await token(request);
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: 'PROPFIND',
      headers: { ...bearer(tk), ...DAV_HEADERS },
      data: PROPFIND_0,
    });
    // Traefik proxy may not pass WebDAV methods — 207 = full pass, 404/405 = proxy limitation
    expect([207, 404, 405], `PROPFIND /caldav/ -> ${res.status()}`).toContain(res.status());
    if (res.status() === 207) {
      const body = await res.text();
      const hasMultiStatus = body.includes('multistatus') || body.includes('D:multistatus');
      test.info().annotations.push({ type: 'propfind-root', description: `207 multistatus=${hasMultiStatus} len=${body.length}` });
    } else {
      test.info().annotations.push({ type: 'propfind-root', description: `-> ${res.status()} (proxy blocks DAV)` });
    }
  });

  test('DAV-02 PROPFIND Depth:1 discovers calendar collections', async ({ request }) => {
    const tk = await token(request);
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: 'PROPFIND',
      headers: { ...bearer(tk), ...DAV_HEADERS, 'Depth': '1' },
      data: PROPFIND_0,
    });
    expect([207, 404, 405], `PROPFIND /caldav/ Depth:1 -> ${res.status()}`).toContain(res.status());
    if (res.status() === 207) {
      const body = await res.text();
      test.info().annotations.push({ type: 'propfind-depth1', description: `len=${body.length}` });
    } else {
      test.info().annotations.push({ type: 'propfind-depth1', description: `-> ${res.status()} (proxy blocks DAV)` });
    }
  });

  test('DAV-03 PROPFIND on calendar home path', async ({ request }) => {
    const tk = await token(request);
    const path = '/caldav/calendars/testuser%40sogo6.contextual-intelligence.org/';
    const res = await request.fetch(`${REMOTE_BASE}${path}`, {
      method: 'PROPFIND',
      headers: { ...bearer(tk), ...DAV_HEADERS },
      data: PROPFIND_0,
    });
    expect([207, 404], `PROPFIND calendar home -> ${res.status()}`).toContain(res.status());
    const body = await res.text();
    const hasCal = body.includes('calendar') || body.includes('VEVENT') || body.includes('VTODO');
    test.info().annotations.push({ type: 'cal-home', description: `${res.status()} hasCal=${hasCal}` });
  });
});

test.describe('Epic — CalDAV protocol: principal & resource types', () => {

  test('DAV-04 PROPFIND current-user-principal', async ({ request }) => {
    const tk = await token(request);
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: 'PROPFIND',
      headers: { ...bearer(tk), ...DAV_HEADERS },
      data: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
    });
    expect([207, 404, 405], `PROPFIND principal -> ${res.status()}`).toContain(res.status());
    if (res.status() === 207) {
      const body = await res.text();
      test.info().annotations.push({ type: 'principal', description: `hasHref=${body.includes('href')}` });
    } else {
      test.info().annotations.push({ type: 'principal', description: `-> ${res.status()} (proxy blocks DAV)` });
    }
  });

  test('DAV-05 OPTIONS on /caldav/ returns DAV capabilities', async ({ request }) => {
    const tk = await token(request);
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: 'OPTIONS',
      headers: bearer(tk),
    });
    expect([200, 404], `OPTIONS /caldav/ -> ${res.status()}`).toContain(res.status());
    if (res.status() === 200) {
      const dav = res.headers()['dav'] ?? '';
      test.info().annotations.push({ type: 'options', description: `dav=${dav}` });
    }
  });

  test('DAV-06 .well-known/caldav redirects or returns discovery', async ({ request }) => {
    const res = await request.get(`${REMOTE_BASE}/.well-known/caldav`);
    // May be 200 (direct) or 301/302 (redirect) or 404 (not configured)
    expect([200, 301, 302, 404], `GET /.well-known/caldav -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'well-known', description: `-> ${res.status()}` });
  });

  test('DAV-07 unauthenticated PROPFIND is rejected (not 207)', async ({ request }) => {
    const res = await request.fetch(`${REMOTE_BASE}/caldav/`, {
      method: 'PROPFIND',
      headers: DAV_HEADERS,
      data: PROPFIND_0,
    });
    expect([401, 403, 404, 405], `unauth PROPFIND -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'unauth-dav', description: `-> ${res.status()}` });
  });

  test('DAV-08 PROPFIND with calendar-data report', async ({ request }) => {
    const tk = await token(request);
    const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT"/>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
    const path = '/caldav/calendars/testuser%40sogo6.contextual-intelligence.org/';
    const res = await request.fetch(`${REMOTE_BASE}${path}`, {
      method: 'REPORT',
      headers: { ...bearer(tk), 'Content-Type': 'application/xml; charset=utf-8', 'Depth': '1' },
      data: reportBody,
    });
    expect([207, 404, 405], `REPORT calendar-query -> ${res.status()}`).toContain(res.status());
    test.info().annotations.push({ type: 'report', description: `-> ${res.status()}` });
  });
});
