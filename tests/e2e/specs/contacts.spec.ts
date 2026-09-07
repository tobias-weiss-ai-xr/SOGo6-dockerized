// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E test for Contacts / Address Book functionality

import { test, expect } from '../helpers';
import {
  REMOTE_BASE,
  REMOTE_API,
  REMOTE_CREDENTIALS,
  setupRemoteEnvInterception,
  loginToRemote,
} from '../helpers';

test.describe('Contacts / Address Book', () => {
  test.beforeEach(async ({ page }) => {
    await setupRemoteEnvInterception(page);
    await loginToRemote(page);
  });

  test('contacts page should be accessible', async ({ page }) => {
    const response = await page.goto(REMOTE_BASE + '/en/u/testuser@sogo6.contextual-intelligence.org/contacts');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForTimeout(3000);
  });

  test('clicking on a contact should work (if contacts exist)', async ({ page }) => {
    await page.goto(REMOTE_BASE + '/en/u/testuser@sogo6.contextual-intelligence.org/contacts');
    await page.waitForTimeout(3000);

    // Try to find contact entries - broad set of selectors
    const contactItems = page.locator(
      '[data-testid="contact-item"], .contact-entry, [data-contact-id], ' +
      'tr:has$a[href*="contact"], li[role="button"], [class*="contact"]:visible'
    );

    const count = await contactItems.count();
    
    if (count === 0) {
      test.skip();
      return;
    }

    // Click the first contact
    const firstContact = contactItems.first();
    await firstContact.click({ timeout: 5000 });
    
    // After clicking, wait for navigation or panel to appear
    await page.waitForTimeout(2000);
    
    // Check if URL changed to a contact detail view
    const url = page.url();
    const hasContactInUrl = url.includes('/contacts/') || url.includes('/contact/');
    
    // Check for any visible contact-related UI after click
    const pageHasContactContent = await page.locator(
      '[data-testid="contact-details"], [role="dialog"], text=/Name|Email|Phone/i'
    ).isVisible().catch(() => false);
    
    expect(hasContactInUrl || pageHasContactContent).toBeTruthy();
  });

  test('contact list page should render without errors', async ({ page }) => {
    await page.goto(REMOTE_BASE + '/en/u/testuser@sogo6.contextual-intelligence.org/contacts');
    await page.waitForTimeout(3000);
    
    // Check that page loaded successfully
    const title = await page.title().catch(() => '');
    expect(title).not.toContain('Error');
    expect(title).not.toContain('500');
    
    // Page should have some content (headers, menus, etc.)
    const hasContent = await page.locator('body:has-children').isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('API: contacts list endpoint should be reachable', async ({ request }) => {
    const loginRes = await request.post(REMOTE_API + '/auth/login', {
      data: {
        username: REMOTE_CREDENTIALS.email,
        password: REMOTE_CREDENTIALS.password,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.status() === 200) {
      const body = await loginRes.json();
      const token = body.data?.jwt_token;

      if (token) {
        const contactsRes = await request.get(REMOTE_API + '/addressbooks/0/contacts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect([200, 404, 403]).toContain(contactsRes.status());
      }
    }
  });
});
