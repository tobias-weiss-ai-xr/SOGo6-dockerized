/**
 * CRA Art. 15(1) — Security Headers Verification (G1)
 * 
 * Uses page.evaluate to fetch directly from the browser, bypassing
 * Playwright's request proxy that may strip headers.
 */
import { test, expect } from '@playwright/test';

const UI_URL = 'https://sogo6.contextual-intelligence.org/';
const API_URL = 'https://sogo6.contextual-intelligence.org/api/user/v1/health';

const MANDATORY = [
  { name: 'strict-transport-security', re: /max-age=(\d+)/, minAge: 31536000, mustInclude: ['includesubdomains'] },
  { name: 'x-frame-options', validValues: ['DENY', 'SAMEORIGIN'] },
  { name: 'x-content-type-options', validValues: ['nosniff'] },
  { name: 'content-security-policy', mustInclude: ["default-src 'self'", "frame-ancestors 'none'"] },
  { name: 'referrer-policy', mustInclude: ['strict-origin'] },
  { name: 'permissions-policy', mustInclude: ['camera=()'] },
];

const RECOMMENDED = [
  { name: 'cross-origin-opener-policy', validValues: ['same-origin'] },
  { name: 'cross-origin-resource-policy', validValues: ['same-origin'] },
  { name: 'x-permitted-cross-domain-policies', validValues: ['none'] },
];

async function getHeaders(page: import('@playwright/test').Page, url: string): Promise<Record<string, string>> {
  return page.evaluate(async (u) => {
    const res = await fetch(u);
    const h: Record<string, string> = {};
    res.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
    return h;
  }, url);
}

function validateHeader(name: string, val: string | undefined, spec: any): string {
  if (!val) return `MISSING`;
  if (spec.validValues && !spec.validValues.includes(val)) return `invalid value: ${val}`;
  if (spec.re) {
    const m = val.match(spec.re);
    if (!m) return `no max-age match`;
    if (spec.minAge && parseInt(m[1]) < spec.minAge) return `max-age too low: ${m[1]}`;
  }
  if (spec.mustInclude) {
    const lower = val.toLowerCase();
    for (const s of spec.mustInclude) {
      if (!lower.includes(s.toLowerCase())) return `missing: ${s}`;
    }
  }
  return 'OK';
}

test.describe('Security headers — CRA Art. 15(1)', () => {
  test.use({ bypassCSP: true });

  for (const h of MANDATORY) {
    test(`[UI] mandatory: ${h.name}`, async ({ page }) => {
      await page.goto(UI_URL, { waitUntil: 'domcontentloaded' });
      const headers = await getHeaders(page, UI_URL);
      const result = validateHeader(h.name, headers[h.name], h);
      expect(result, `${h.name}: ${result}`).toBe('OK');
    });
    test(`[API] mandatory: ${h.name}`, async ({ page }) => {
      await page.goto(UI_URL, { waitUntil: 'domcontentloaded' });
      const headers = await getHeaders(page, API_URL);
      const result = validateHeader(h.name, headers[h.name], h);
      expect(result, `${h.name}: ${result}`).toBe('OK');
    });
  }
  for (const h of RECOMMENDED) {
    test(`[UI] recommended: ${h.name}`, async ({ page }) => {
      await page.goto(UI_URL, { waitUntil: 'domcontentloaded' });
      const headers = await getHeaders(page, UI_URL);
      const result = validateHeader(h.name, headers[h.name], h);
      expect(result, `${h.name}: ${result}`).toBe('OK');
    });
    test(`[API] recommended: ${h.name}`, async ({ page }) => {
      await page.goto(UI_URL, { waitUntil: 'domcontentloaded' });
      const headers = await getHeaders(page, API_URL);
      const result = validateHeader(h.name, headers[h.name], h);
      expect(result, `${h.name}: ${result}`).toBe('OK');
    });
  }
});
