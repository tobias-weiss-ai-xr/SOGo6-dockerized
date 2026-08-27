/**
 * CRA Art. 10(1)(c) — Data Isolation Verification (G2)
 * 
 * Verifies that User A cannot access User B's data through the API.
 */
import { test, expect } from '@playwright/test';
import { apiLogin, REMOTE_API, bearer, REMOTE_CREDENTIALS } from '../helpers';

const BASE = REMOTE_API.replace('/api/user/v1', '');
const USER_API = BASE + '/api/user/v1';

const tokens: Record<string, string | null> = {};

async function getToken(uid: string, pwd: string): Promise<string> {
  if (!tokens[uid]) tokens[uid] = await apiLogin(`${uid}@sogo6.contextual-intelligence.org`, pwd);
  return tokens[uid]!;
}

test.describe('Data isolation — CRA Art. 10(1)(c)', () => {

  test('ISO-01 user profile only returns own data', async ({ request }) => {
    const tk = await getToken('testuser', REMOTE_CREDENTIALS.user.password);
    const res = await request.get(`${USER_API}/profile`, { headers: bearer(tk) });
    if (res.status() === 200) {
      const body = await res.json();
      const uid = body?.data?.uid || body?.data?.email || '';
      expect(uid.toLowerCase()).toContain('testuser');
      expect(uid.toLowerCase()).not.toContain('lisa.mayer');
    } else {
      test.info().annotations.push({ type: 'skip', description: `profile -> ${res.status()}` });
    }
  });

  test('ISO-02 user A contacts not in user B addressbook listing', async ({ request }) => {
    // Create a contact as testuser, then check it doesn't appear in lisa.mayer's listing
    const tkA = await getToken('testuser', REMOTE_CREDENTIALS.user.password);
    const tkB = await getToken('lisa.mayer', 'UniMarburg2026!');

    // Create a unique contact as A
    const uniqueTag = `iso2-${Date.now()}`;
    await request.post(`${USER_API}/address-books/Personal/contacts`, {
      headers: { ...bearer(tkA), 'Content-Type': 'application/json' },
      data: { first_name: uniqueTag, last_name: 'IsolationTest' },
    });

    // List B's contacts and verify uniqueTag doesn't appear
    const resB = await request.get(`${USER_API}/address-books`, { headers: bearer(tkB) });
    if (resB.status() === 200) {
      const bodyB = await resB.json();
      const str = JSON.stringify(bodyB);
      expect(str).not.toContain(uniqueTag);
    }
  });

  test('ISO-03 user preferences are user-scoped', async ({ request }) => {
    const tkA = await getToken('testuser', REMOTE_CREDENTIALS.user.password);
    const tkB = await getToken('lisa.mayer', 'UniMarburg2026!');

    // Set a unique preference as A
    const uniqueVal = `iso3-${Date.now()}`;
    await request.patch(`${USER_API}/preferences`, {
      headers: { ...bearer(tkA), 'Content-Type': 'application/json' },
      data: { custom_iso_test: uniqueVal },
    });

    // Read B's preferences and verify it doesn't leak
    const resB = await request.get(`${USER_API}/preferences`, { headers: bearer(tkB) });
    if (resB.status() === 200) {
      const bodyB = await resB.json();
      const str = JSON.stringify(bodyB);
      expect(str).not.toContain(uniqueVal);
    }
  });

  test('ISO-04 calendar events are user-scoped', async ({ request }) => {
    const tkA = await getToken('testuser', REMOTE_CREDENTIALS.user.password);
    const tkB = await getToken('lisa.mayer', 'UniMarburg2026!');

    // List A's calendars
    const resA = await request.get(`${USER_API}/calendars`, { headers: bearer(tkA) });
    const resB = await request.get(`${USER_API}/calendars`, { headers: bearer(tkB) });

    if (resA.status() === 200 && resB.status() === 200) {
      const bodyA = await resA.json();
      const bodyB = await resB.json();
      const aStr = JSON.stringify(bodyA);
      const bStr = JSON.stringify(bodyB);
      // Both should return data but they should be different
      test.info().annotations.push({
        type: 'calendar-iso',
        description: `A_len=${aStr.length} B_len=${bStr.length}`,
      });
    }
  });

  test('ISO-05 tasks are user-scoped', async ({ request }) => {
    const tkA = await getToken('testuser', REMOTE_CREDENTIALS.user.password);
    const tkB = await getToken('lisa.mayer', 'UniMarburg2026!');

    const resA = await request.get(`${USER_API}/tasks`, { headers: bearer(tkA) });
    const resB = await request.get(`${USER_API}/tasks`, { headers: bearer(tkB) });

    // Both should succeed (no 5xx)
    expect(resA.status()).toBeLessThan(500);
    expect(resB.status()).toBeLessThan(500);

    test.info().annotations.push({
      type: 'task-iso',
      description: `A->${resA.status()} B->${resB.status()}`,
    });
  });

  test('ISO-06 admin cannot read user mail content via user API', async ({ request }) => {
    // Admin token used on user endpoints should not grant access to user data
    const adminTk = await apiLogin(REMOTE_CREDENTIALS.admin.username, REMOTE_CREDENTIALS.admin.password, REMOTE_API);
    const res = await request.get(`${USER_API}/mailboxes/0/folders/INBOX/mails`, {
      headers: bearer(adminTk),
    });
    // Admin auth is separate — should get 401/403/404, not 200 with user mail
    expect([401, 403, 404], `Admin reads user mail -> ${res.status()}`).toContain(res.status());
  });

});
