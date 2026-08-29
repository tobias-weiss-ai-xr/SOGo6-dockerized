// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// Contact CRUD against the LOCAL stack via the REST API:
//   POST   /api/user/v1/addressbooks/<key>/contacts   (create)
//   GET    /api/user/v1/addressbooks/<key>/contacts/<contact_key> (read)
//   PATCH  /api/user/v1/addressbooks/<key>/contacts/<contact_key> (update)
//   DELETE /api/user/v1/addressbooks/<key>/contacts/<contact_key> (delete)
// The create/patch bodies use the flat write schema (display_name etc.) and
// created contacts are cleaned up in afterAll.
//
//   npx playwright test local-contact-crud.spec.ts

import { test, expect } from '../helpers';

const API = 'http://localhost:5001';
const USER = { email: 'testuser@example.org', password: 'password123' };
const UNIQ = Date.now();

let token = '';
let addressbookKey = '';
let contactKey = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/user/v1/auth/login`, {
    data: { username: USER.email, password: USER.password },
  });
  const body = await res.json();
  token = body?.data?.jwt_token ?? '';
  expect(token, 'user login must return a JWT').toBeTruthy();

  const books = await request.get(`${API}/api/user/v1/addressbooks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  addressbookKey = (await books.json()).data.addressbooks[0].key;
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const contactPath = (key: string) => `${API}/api/user/v1/addressbooks/${addressbookKey}/contacts/${key}`;

test.describe('local contact CRUD @local', () => {
  test('addressbooks exposes a default address book', async ({ request }) => {
    const res = await request.get(`${API}/api/user/v1/addressbooks`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.addressbooks)).toBe(true);
    const def = body.data.addressbooks.find((b: any) => b.is_default === true);
    expect(def).toBeTruthy();
  });

  test('contact create returns a retrievable contact', async ({ request }) => {
    const res = await request.post(
      `${API}/api/user/v1/addressbooks/${addressbookKey}/contacts`,
      {
        headers: { ...auth(), 'Content-Type': 'application/json' },
        data: {
          display_name: `E2E Probe ${UNIQ}`,
          first_name: 'E2E',
          last_name: `Probe ${UNIQ}`,
          emails: [{ value: `e2e.probe.${UNIQ}@example.org` }],
          organization: 'SOGo e2e suite',
        },
      },
    );
    expect(res.status()).toBe(201);
    const created = (await res.json()).data;
    contactKey = created.key;
    expect(contactKey).toBeTruthy();

    const got = await request.get(contactPath(contactKey), { headers: auth() });
    expect(got.status()).toBe(200);
    const data = (await got.json()).data;
    expect(data.display_name).toBe(`E2E Probe ${UNIQ}`);
    expect(data.emails?.some((e: any) => e.value === `e2e.probe.${UNIQ}@example.org`)).toBe(true);
  });

  test('contact can be patched', async ({ request }) => {
    expect(contactKey).toBeTruthy();
    const res = await request.patch(contactPath(contactKey), {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { job_title: 'Automated Tester' },
    });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.job_title).toBe('Automated Tester');
  });

  test('contact can be deleted (GET afterwards is 404)', async ({ request }) => {
    expect(contactKey).toBeTruthy();
    const del = await request.delete(contactPath(contactKey), { headers: auth() });
    expect(del.status()).toBe(200);
    const after = await request.get(contactPath(contactKey), { headers: auth() });
    expect(after.status()).toBe(404);
    contactKey = '';
  });
});

test.afterAll(async ({ request }) => {
  if (contactKey) {
    await request.delete(contactPath(contactKey), { headers: auth() }).catch(() => {});
  }
});
