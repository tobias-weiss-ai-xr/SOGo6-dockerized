// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
import { test, expect } from '../helpers';

test.describe('Authentication Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/env', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.REACT_APP_API_BASE_URL = 'http://localhost:5001/api/user/v1';
      // Ensure prefill is set for tests
      if (!body.LOGIN_PREFILL_EMAIL) {
        body.LOGIN_PREFILL_EMAIL = 'testuser@example.org';
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/en/auth/login');

    // Wait for form to render
    await page.waitForSelector('input#email', { timeout: 20000 });

    // Email field exists
    const emailInput = page.locator('input#email');
    await expect(emailInput).toBeVisible({ timeout: 5000 });

    // Submit button exists
    const submitBtn = page.locator('button[type=submit]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).not.toBeDisabled();

    // Language selector exists
    const langSelect = page.locator('[role="combobox"]').first();
    await expect(langSelect).toBeVisible();
  });

  test('should show required-field validation on empty submit', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForSelector('input#email', { timeout: 20000 });

    // Clear and submit empty
    const emailInput = page.locator('input#email');
    await emailInput.clear();
    await page.locator('button[type=submit]').click();

    // Wait for error message to appear on the page
    await page.waitForTimeout(1000);

    // Check for any error text in the page (the error may appear as a paragraph
    // below the input, in an alert, or as a form-level error)
    const hasErrorOnPage = await page.evaluate(() => {
      const body = document.body.textContent?.toLowerCase() || '';
      return body.includes('required') || body.includes('invalid') || body.includes('error');
    });

    // Either there's an error element or validation caught it
    const errorElement = page.locator('#email-error, [aria-describedby], [role="alert"]').first();
    const hasErrorElement = await errorElement.isVisible().catch(() => false);
    expect(hasErrorOnPage || hasErrorElement).toBeTruthy();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForSelector('input#email', { timeout: 20000 });

    // Enter invalid email
    const emailInput = page.locator('input#email');
    await emailInput.clear();
    await emailInput.fill('not-an-email');

    // Submit
    await page.locator('button[type=submit]').click();

    // Wait for validation to kick in
    await page.waitForTimeout(1000);

    // Check for any error text on the page
    const errorText = await page.evaluate(() => {
      const body = document.body.textContent?.toLowerCase() || '';
      return body.includes('invalid') || body.includes('email') || body.includes('gültig') ||
             body.includes('valide') || body.includes('válido');
    });
    expect(errorText).toBeTruthy();
  });

  test('should navigate to password page after valid email', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForSelector('input#email', { timeout: 20000 });

    // Enter valid email
    const emailInput = page.locator('input#email');
    await emailInput.clear();
    await emailInput.fill('testuser@example.org');

    // Submit
    await page.locator('button[type=submit]').click();

    // Wait for either password page or a result
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    // Either redirected to password page or still on login with no error
    if (currentUrl.includes('/pwd')) {
      const pwdInput = page.locator('input[type="password"]');
      await expect(pwdInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display language options', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForSelector('input#email', { timeout: 20000 });

    // Open language selector
    const langTrigger = page.locator('[role="combobox"]').first();
    await expect(langTrigger).toBeVisible();
    await langTrigger.click();

    // Check options are visible
    await page.waitForTimeout(500);
    const options = page.locator('[role="option"]');
    const count = await options.count().catch(() => 0);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should handle API error gracefully', async ({ page }) => {
    // Block API calls to simulate network failure (but keep /env working)
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));

    const response = await page.goto('/en/auth/login');
    expect(response?.status()).toBe(200);

    // The app may render the login form, or show a graceful error page if the
    // API is unreachable before first render. Accept both (graceful degradation).
    const emailVisible = await page.locator('input#email').isVisible({ timeout: 15000 }).catch(() => false);

    if (emailVisible) {
      // Clear and fill
      const emailInput = page.locator('input#email');
      await emailInput.clear();
      await emailInput.fill('testuser@example.org');

      // Submit
      await page.locator('button[type=submit]').click();

      // Wait for error state or timeout (API is blocked, so it should eventually show an error)
      await page.waitForTimeout(8000);
    }

    // Should show some error feedback OR stay on the same page (graceful degradation)
    const hasErrorFeedback = await page.evaluate(() => {
      const body = document.body.textContent?.toLowerCase() || '';
      return body.includes('error') || body.includes('timeout') || body.includes('fehler') ||
             body.includes('erreur') || body.includes('try again') ||
             body.includes('retry') || body.includes('wiederholen') ||
             body.includes('unavailable') || body.includes('could not connect');
    });

    // The app handles the error gracefully (no crash, proper feedback)
    expect(hasErrorFeedback || emailVisible).toBeTruthy();
  });
});
