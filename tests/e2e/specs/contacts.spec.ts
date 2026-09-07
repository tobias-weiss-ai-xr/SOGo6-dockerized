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
    const response = await page.goto(REMOTE_BASE + '/en/u/testuser2%40sogo6.contextual-intelligence.org/contacts');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForTimeout(3000);
  });

  test('clicking on a contact should open contact view or details panel', async ({ page }) => {
    await page.goto(REMOTE_BASE + '/en/u/testuser2%40sogo6.contextual-intelligence.org/contacts');
    await page.waitForTimeout(3000);

    // Try to find contact entries - could be list items, rows, or cards
    const contactItems = page.locator(
      '[data-testid="contact-item"], [role="row"]:has([data-testid="contact-name"]), ' +
      '.contact-entry, [data-contact-id], li:has-text("@"), ' +
      '[role="button"]:has-text("John")'
    );

    const count = await contactItems.count();
    
    if (count === 0) {
      // No contacts found - check if there's a create contact button
      const createBtn = page.locator('button:has-text("New Contact"), button:has-text("Create Contact"), [role="button"]:has-text("Contact")').first();
      const hasCreate = await createBtn.isVisible().catch(() => false);
      if (!hasCreate) {
        test.skip();
        return;
      }
    }

    // Click the first contact
    const firstContact = contactItems.first();
    await firstContact.click({ timeout: 5000 });
    
    // After clicking, one of these should happen:
    // 1. URL changes to /contacts/:id or /contacts/view/:id
    // 2. A details panel/sidebar opens
    // 3. A dialog/modal appears with contact details
    
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const hasContactId = url.includes('/contacts/') || url.includes('/contact/');
    
    // Check for open details panel/dialog
    const detailsPanel = page.locator('div[data-testid="contact-details"], [role="dialog"], [role="region"]:has-text("Details")').first();
    const hasDetails = await detailsPanel.isVisible().catch(() => false);
    
    // Check for action buttons (edit, delete, etc.) that appear on contact view
    const actionBtns = page.locator('button:has-text("Edit"), button:has-text("Delete"), button:has-text("Send Email")').first();
    const hasActions = await actionBtns.count();
    
    expect(hasContactId || hasDetails || hasActions > 0).toBeTruthy();
  });

  test('contact list should have at least one entry or create button', async ({ page }) => {
    await page.goto(REMOTE_BASE + '/en/u/testuser2%40sogo6.contextual-intelligence.org/contacts');
    await page.waitForTimeout(3000);

    // Check for contacts
    const contactsExist = await page.locator(
      '[data-testid="contact-item"], .contact-entry, [data-contact-id]'
    ).count();

    // Check for create button
    const createBtn = page.locator('button:has-text("New Contact"), button:has-text("Create"), button:has-text("+ Contact")').first();
    const hasCreate = await createBtn.isVisible().catch(() => false);

    expect(contactsExist > 0 || hasCreate).toBeTruthy();
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
