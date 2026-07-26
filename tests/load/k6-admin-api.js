// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// k6 load test — Admin API (v2, corrected endpoints)
// ==================================================
// Run: k6 run --vus 10 --duration 30s tests/load/k6-admin-api.js
//
// Tests core admin API CRUD endpoints under load:
//   - Login (obtain JWT)
//   - List/Get system settings
//   - List/Get/Update theme settings
//   - CRUD rules
//   - List users
//   - List active sessions
//   - Failed auth rejection

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.SOGO_API_URL || 'http://localhost:5001';
const ADMIN_USER = __ENV.SOGO_ADMIN_USER || 'admin';
const ADMIN_PASS = __ENV.SOGO_ADMIN_PASSWORD || 'admin';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration_ms');

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

let sharedToken = '';
let tokenExpiresAt = 0;

function login() {
  const url = `${BASE_URL}/api/admin/v1/auth/login`;
  const payload = JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(url, payload, params);
  const ok = check(res, {
    'login returns 200': (r) => r.status === 200,
    'login has token': (r) => {
      try { return !!JSON.parse(r.body).data?.jwt_token; } catch { return false; }
    },
  });

  if (ok) {
    sharedToken = JSON.parse(res.body).data.jwt_token;
    tokenExpiresAt = Date.now() + 25 * 60 * 1000;
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }
  return ok;
}

function headers() {
  return { 'Authorization': `Bearer ${sharedToken}`, 'Content-Type': 'application/json' };
}

function api(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const params = { headers: headers() };
  const res = method === 'GET' ? http.get(url, params)
    : method === 'POST' ? http.post(url, JSON.stringify(body), params)
    : method === 'PATCH' ? http.patch(url, JSON.stringify(body), params)
    : http.del(url, null, params);
  apiDuration.add(res.timings.duration);
  return res;
}

export function setup() {
  login();
}

export default function () {
  if (!sharedToken || Date.now() > tokenExpiresAt) {
    if (!login()) { sleep(1); return; }
  }

  // ─── 1. System config ─────────────────────────────────────
  group('System config', () => {
    let res = api('GET', '/api/admin/v1/config/system');
    let ok = check(res, {
      'GET /config/system returns 200': (r) => r.status === 200,
      'system has SYSTEM_SETTINGS': (r) => {
        try { return !!JSON.parse(r.body).data?.SYSTEM_SETTINGS; } catch { return false; }
      },
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.2);
  });

  // ─── 2. Theme settings ────────────────────────────────────
  group('Theme settings', () => {
    let res = api('GET', '/api/admin/v1/config/theme');
    let ok = check(res, {
      'GET /config/theme returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.2);

    // PATCH uses {"settings": {...}} wrapper
    res = api('PATCH', '/api/admin/v1/config/theme', {
      settings: { primary: '210 50% 50%' },
    });
    ok = check(res, {
      'PATCH /config/theme returns 200': (r) => r.status === 200,
      'theme patch returns updated fields': (r) => {
        try { return JSON.parse(r.body).data?.primary === '210 50% 50%'; } catch { return false; }
      },
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });

  // ─── 3. Rules CRUD ────────────────────────────────────────
  group('Rules CRUD', () => {
    // List
    let res = api('GET', '/api/admin/v1/config/rules');
    let ok = check(res, {
      'GET /config/rules returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok ? 1 : 0);

    // Create — uses rule_name, rule_description, rule_domains
    const ruleName = `load-test-${__VU}-${Date.now()}`;
    res = api('POST', '/api/admin/v1/config/rules', {
      rule_name: ruleName,
      rule_description: 'Created during load test',
      rule_domains: ['example.org'],
    });
    ok = check(res, {
      'POST /config/rules returns 201': (r) => r.status === 201 || r.status === 200,
      'rule created with id': (r) => {
        try { return !!JSON.parse(r.body).data?.id; } catch { return false; }
      },
    });
    errorRate.add(!ok ? 1 : 0);

    const ruleId = ok ? JSON.parse(res.body).data.id : null;

    if (ruleId) {
      sleep(0.2);
      res = api('GET', `/api/admin/v1/config/rules/${ruleId}`);
      ok = check(res, {
        'GET /config/rules/:id returns 200': (r) => r.status === 200,
      });
      errorRate.add(!ok ? 1 : 0);

      sleep(0.2);
      res = api('PATCH', `/api/admin/v1/config/rules/${ruleId}`, {
        rule_description: 'Updated during load test',
      });
      ok = check(res, {
        'PATCH /config/rules/:id returns 200': (r) => r.status === 200,
      });
      errorRate.add(!ok ? 1 : 0);

      sleep(0.2);
      res = api('DELETE', `/api/admin/v1/config/rules/${ruleId}`);
      ok = check(res, {
        'DELETE /config/rules/:id returns 200': (r) => r.status === 200,
      });
      errorRate.add(!ok ? 1 : 0);
    }
    sleep(0.3);
  });

  // ─── 4. Users list ────────────────────────────────────────
  group('Users list', () => {
    let res = api('GET', '/api/admin/v1/users/list?limit=10&offset=0');
    let ok = check(res, {
      'GET /users/list returns 200': (r) => r.status === 200,
      'users list is array': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
      },
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });

  // ─── 5. Active sessions ───────────────────────────────────
  group('Active sessions', () => {
    let res = api('GET', '/api/admin/v1/users/active?limit=10');
    let ok = check(res, {
      'GET /users/active returns 200': (r) => r.status === 200,
      'sessions is array': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
      },
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });

  // ─── 6. Domain default config ─────────────────────────────
  group('Domain default config', () => {
    let res = api('GET', '/api/admin/v1/config/domain-default');
    let ok = check(res, {
      'GET /config/domain-default returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });

  // ─── 7. Auth rejection (negative test) ────────────────────
  group('Auth rejection', () => {
    // Unauthenticated request (no token)
    const res = http.get(`${BASE_URL}/api/admin/v1/config/rules`);
    const ok = check(res, {
      'unauthenticated request returns 401': (r) => r.status === 401,
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.2);

    // Wrong token
    const badRes = http.get(`${BASE_URL}/api/admin/v1/config/system`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    const badOk = check(badRes, {
      'invalid token returns 401': (r) => r.status === 401,
    });
    errorRate.add(!badOk ? 1 : 0);
    sleep(0.2);
  });
}
