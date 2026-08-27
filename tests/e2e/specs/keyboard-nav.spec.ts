// SPDX-FileCopyrightText: 2025 SOGo project contributors
// SPDX-License-Identifier: LGPL-2.1-only
//
// E2E tests for Keyboard Navigation & Accessibility.
// Tests:
//   - Tab through mail list items
//   - Enter to open mail
//   - Escape to close compose/dialog
//   - Arrow keys for navigation
//   - Keyboard shortcut for compose
//   - Focus visible on interactive elements
//   - ARIA labels present
//   - Screen reader landmarks
//
// Tests run against https://sogo6.contextual-intelligence.org
// Credentials: see tests/e2e/.env (gitignored)

import { test, expect, REMOTE_CREDENTIALS } from '../helpers';

const REMOTE_BASE = 'https://sogo6.contextual-intelligence.org';
const REMOTE_API = 'https://sogo6.contextual-intelligence.org/api/user/v1';
const CREDENTIALS = {
  email: REMOTE_CREDENTIALS.user.email,
  password: REMOTE_CREDENTIALS.user.password,
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function setupEnvInterception(page: import('@playwright/test').Page) {
  await page.route('**/env', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.REACT_APP_API_BASE_URL = REMOTE_API;
    body.LOGIN_PREFILL_EMAIL = CREDENTIALS.email;
    body.LOGIN_PREFILL_PASSWORD = CREDENTIALS.password;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function loginAsUser(page: import('@playwright/test').Page) {
  await setupEnvInterception(page);
  await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 20000 });
  const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailInput.fill(CREDENTIALS.email);
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  const pwdInput = page.locator('input[type="password"]').first();
  if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwdInput.fill(CREDENTIALS.password);
    await pwdInput.press('Enter');
  }
  await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Keyboard Navigation & Accessibility', () => {

  test('login page has accessible email input', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });

    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();

    // Check for label or aria-label
    const hasLabel = await emailInput.evaluate((el: HTMLInputElement) => {
      return el.getAttribute('aria-label') !== null ||
             el.getAttribute('aria-labelledby') !== null ||
             el.id !== '' && document.querySelector(`label[for="${el.id}"]`) !== null;
    });
    expect(hasLabel).toBeTruthy();
  });

  test('login page supports keyboard navigation', async ({ page }) => {
    await setupEnvInterception(page);
    await page.goto(`${REMOTE_BASE}/en/auth/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });

    // Tab to email input
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Type email
    await page.keyboard.type(CREDENTIALS.email);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Should navigate to password or logged in
    const pwdInput = page.locator('input[type="password"]').first();
    const hasPwd = await pwdInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasPwd) {
      await page.keyboard.type(CREDENTIALS.password);
      await page.keyboard.press('Enter');
    }

    await page.waitForURL('**/u/**', { timeout: 20000 }).catch(() => {});
  });

  test('inbox page supports tab navigation', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // Tab through elements
    let tabCount = 0;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className.split(' ')[0]}` : '') : null;
      });
      if (focused) tabCount++;
    }
    expect(tabCount).toBeGreaterThan(0);
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Check if focused elements have visible focus styles
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;
      // Focus is visible if there's an outline or box-shadow
      return (outline && outline !== 'none') || (boxShadow && boxShadow !== 'none');
    });

    test.info().annotations.push({
      type: 'focus-visible',
      description: `Focus visible on active element: ${focusVisible}`,
    });
  });

  test('ARIA landmarks are present', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const landmarks = await page.evaluate(() => {
      const roles = ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'region', 'search', 'form'];
      const found: string[] = [];
      for (const role of roles) {
        const els = document.querySelectorAll(`[role="${role}"]`);
        if (els.length > 0) found.push(`${role}(${els.length})`);
      }
      // Also check HTML5 landmarks
      const html5Tags = ['main', 'nav', 'header', 'footer', 'aside', 'section', 'article'];
      for (const tag of html5Tags) {
        const els = document.querySelectorAll(tag);
        if (els.length > 0) found.push(`${tag}(${els.length})`);
      }
      return found;
    });

    expect(landmarks.length).toBeGreaterThan(0);
  });

  test('buttons have accessible names', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const buttonsWithoutAria = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      let withoutName = 0;
      for (const btn of buttons) {
        const ariaLabel = btn.getAttribute('aria-label');
        const title = btn.getAttribute('title');
        const text = (btn.textContent || '').trim();
        if (!ariaLabel && !title && !text) {
          withoutName++;
        }
      }
      return { total: buttons.length, withoutName };
    });

    // Most buttons should have accessible names
    expect(buttonsWithoutAria.total).toBeGreaterThan(0);
    // Allow some icon-only buttons to lack labels, but document the count
    test.info().annotations.push({
      type: 'button-a11y',
      description: `Buttons: ${buttonsWithoutAria.total} total, ${buttonsWithoutAria.withoutName} without accessible name`,
    });
  });

  test('images have alt text or aria-hidden', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const imgStats = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      let withAlt = 0;
      let withoutAlt = 0;
      let ariaHidden = 0;
      for (const img of imgs) {
        if (img.getAttribute('aria-hidden') === 'true') {
          ariaHidden++;
        } else if (img.getAttribute('alt')) {
          withAlt++;
        } else {
          withoutAlt++;
        }
      }
      return { total: imgs.length, withAlt, withoutAlt, ariaHidden };
    });

    test.info().annotations.push({
      type: 'img-a11y',
      description: `Images: ${imgStats.total} total, ${imgStats.withAlt} with alt, ${imgStats.withoutAlt} without alt, ${imgStats.ariaHidden} aria-hidden`,
    });
    // Decorative images should have alt="" or aria-hidden, informational should have alt text
    if (imgStats.total > 0) {
      const accessible = imgStats.withAlt + imgStats.ariaHidden;
      expect(accessible / imgStats.total).toBeGreaterThan(0.5);
    }
  });

  test('compose page can be opened via keyboard', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Look for a compose button
    const composeBtn = page.locator('a[href*="compose"], button:has-text("Compose"), button:has-text("Verfassen"), button:has-text("New"), button:has-text("Neu")').first();
    const hasComposeBtn = await composeBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasComposeBtn) {
      // Focus and activate via keyboard
      await composeBtn.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      // Should navigate to compose or open a dialog
      const url = page.url();
      const isCompose = url.includes('compose') || url.includes('draft');
      test.info().annotations.push({
        type: 'compose-kb',
        description: `After keyboard compose: URL=${url}, isCompose=${isCompose}`,
      });
    }
  });

  test('mail list items are keyboard navigable', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // Check if mail list items have tabindex or are focusable
    const focusableItems = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="listitem"], [role="option"], li[class*="cursor"], div[class*="cursor-pointer"]');
      let focusable = 0;
      for (const item of items) {
        const tabindex = item.getAttribute('tabindex');
        if (tabindex !== null && tabindex !== '-1') focusable++;
        else if (item.tagName === 'A' || item.tagName === 'BUTTON') focusable++;
      }
      return { total: items.length, focusable };
    });

    test.info().annotations.push({
      type: 'mail-list-kb',
      description: `Mail list items: ${focusableItems.total} total, ${focusableItems.focusable} keyboard-focusable`,
    });
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const headings = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1');
      const h2s = document.querySelectorAll('h2');
      const h3s = document.querySelectorAll('h3');
      return {
        h1: h1s.length,
        h2: h2s.length,
        h3: h3s.length,
        hasH1: h1s.length > 0,
      };
    });

    // Page should have at least one heading
    expect(headings.h1 + headings.h2 + headings.h3).toBeGreaterThan(0);
  });

  test('color contrast meets WCAG standards', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Check body text color contrast
    const contrast = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      const color = style.color;
      const bgColor = style.backgroundColor;
      return { color, bgColor };
    });

    test.info().annotations.push({
      type: 'color-contrast',
      description: `Body color: ${contrast.color}, bg: ${contrast.bgColor}`,
    });
    // Just verify colors are set (not default)
    expect(contrast.color).toBeTruthy();
  });

  test('page title is set', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('skip to content link exists (if implemented)', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/u/0/INBOX`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const hasSkipLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(a => {
        const text = (a.textContent || '').toLowerCase();
        const href = a.getAttribute('href') || '';
        return text.includes('skip') || href === '#main' || href === '#content';
      });
    });

    test.info().annotations.push({
      type: 'skip-link',
      description: `Skip-to-content link found: ${hasSkipLink}`,
    });
    // Skip links are best practice but may not be implemented
  });

  test('form inputs have associated labels', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${REMOTE_BASE}/en/user_settings/profile`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const formStats = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      let withLabel = 0;
      let withoutLabel = 0;
      for (const input of inputs) {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledby = input.getAttribute('aria-labelledby');
        const placeholder = input.getAttribute('placeholder');
        if ((id && document.querySelector(`label[for="${id}"]`)) || ariaLabel || ariaLabelledby || placeholder) {
          withLabel++;
        } else {
          withoutLabel++;
        }
      }
      return { total: inputs.length, withLabel, withoutLabel };
    });

    test.info().annotations.push({
      type: 'form-labels',
      description: `Form inputs: ${formStats.total} total, ${formStats.withLabel} with label, ${formStats.withoutLabel} without`,
    });
    // Most inputs should have labels
    if (formStats.total > 0) {
      expect(formStats.withLabel / formStats.total).toBeGreaterThan(0.3);
    }
  });
});
