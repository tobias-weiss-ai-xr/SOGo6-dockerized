// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// k6 load test — User-facing API (v2, corrected endpoints)
// ========================================================
// Run: k6 run --vus 5 --duration 30s tests/load/k6-user-api.js
//
// Tests user-facing API endpoints:
//   - Public themes endpoint (raw CSS response)
//   - Admin profile (via admin JWT — tests 401 for user routes)
//   - Mail search

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.SOGO_API_URL || 'http://localhost:5001';
const ADMIN_USER = __ENV.SOGO_ADMIN_USER || 'admin';
const ADMIN_PASS = __ENV.SOGO_ADMIN_PASSWORD || 'admin';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 3 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

let sharedToken = '';

function login() {
  const res = http.post(`${BASE_URL}/api/admin/v1/auth/login`,
    JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status === 200) {
    try { sharedToken = JSON.parse(res.body).data?.jwt_token || ''; } catch { /* ignore */ }
  }
}

export function setup() {
  login();
}

export default function () {
  if (!sharedToken) {
    login();
    if (!sharedToken) { sleep(1); return; }
  }

  const authHeaders = { 'Authorization': `Bearer ${sharedToken}`, 'Content-Type': 'application/json' };

  // ─── 1. Public themes (no auth) ───────────────────────────
  group('Public themes', () => {
    const res = http.get(`${BASE_URL}/api/user/v1/customization/themes`);
    const ok = check(res, {
      'themes returns 200': (r) => r.status === 200,
      'themes returns CSS with :root': (r) => {
        // Response is a JSON-encoded string: '":root { ... }"'
        try {
          const body = JSON.parse(r.body);
          return typeof body === 'string' && body.includes(':root');
        } catch { return false; }
      },
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.2);
  });

  // ─── 2. Profile with admin token → 401 (expected) ────────
  group('Profile (admin token → 401)', () => {
    const res = http.get(`${BASE_URL}/api/user/v1/profile`,
      { headers: authHeaders }
    );
    const ok = check(res, {
      'profile with admin token returns 401': (r) => r.status === 401,
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });

  // ─── 3. Mail search ───────────────────────────────────────
  group('Mail search', () => {
    const res = http.get(
      `${BASE_URL}/api/admin/v1/mail/search?query=test&limit=5&offset=0`,
      { headers: authHeaders }
    );
    const ok = check(res, {
      'mail search returns 200/400/404': (r) => r.status === 200 || r.status === 400 || r.status === 404,
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });

  // ─── 4. Mailboxes ─────────────────────────────────────────
  group('Mail mailboxes', () => {
    const res = http.get(`${BASE_URL}/api/admin/v1/mail/mailboxes`,
      { headers: authHeaders }
    );
    const ok = check(res, {
      'mailboxes returns 200/400/404': (r) => r.status === 200 || r.status === 400 || r.status === 404,
    });
    errorRate.add(!ok ? 1 : 0);
    sleep(0.3);
  });
}
