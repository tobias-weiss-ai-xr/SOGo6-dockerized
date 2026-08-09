# PWA / Mobile Web — Implementation Summary

**Status**: ✅ COMPLETE (Tier 1 Core Experience feature #17 — **Tier 1 DONE**)
**Changes**: `pwa-mobile-web.change.md` + `tier1-implementation.change.md` (tracker)
**Date**: 2026-08-06

---

## 1. What Was Delivered

**PWA / Mobile Web** makes SOGo 6 installable and usable offline on phones and
desktops without a native app. This is the **final Tier 1 feature** — with it,
the Core Experience tier is complete (14/14).

The app already registered a service worker and shipped a manifest, but the
icons were **missing on disk**, the `/offline` route didn't exist, and the
service worker had duplicate branches and wrong icon paths. This change
completes the PWA story end-to-end.

### Frontend (`sogo6-ui`) — PWA is a frontend-only feature

| Asset | Notes |
|---|---|
| `public/icons/icon-192.png` | Generated from `icon.svg` (maskable, blue rounded square + white glyphs) |
| `public/icons/icon-512.png` | Generated from `icon.svg` |
| `public/icons/badge-72x72.png` | Notification badge |
| `public/manifest.json` | Added `id`, `scope: "/"`, `start_url: "/en"`, `display_override`, **app shortcuts** (Mail → `/en/u/0/INBOX`, Calendar → `/en/calendars`, Contacts → `/en/address_books`) |
| `public/sw.js` | Rewritten — single fetch handler: navigations network-first → offline fallback; static assets stale-while-revalidate; **never caches** `/api/`, `/fakeApi/`, `/env`; correct icon paths; push/notification/sync handlers preserved |
| `src/app/offline/page.tsx` | Standalone offline fallback page with wifi-off icon + Retry link |
| `src/app/layout.tsx` | Apple touch icon → `/icons/icon-192.png` (was a 16px svg) |

## 2. Verification

| Check | Result |
|---|---|
| PWA structural tests (`src/app/__tests__/pwa.test.ts`) | **16/16 PASS** |
| Frontend `src/app` suites (incl. layout, not-found, offline) | **292 PASS** |
| Frontend `tsc --noEmit` | 459 — unchanged vs. baseline (no new errors) |
| manifest.json | valid JSON, all referenced icons exist on disk |

## 3. Design Notes

- **Never cache API**: the service worker explicitly skips `/api/`, `/fakeApi/`
  and `/env` so mail/calendar data is always fresh — only the app shell is
  cached for offline.
- **Network-first navigation**: a failed navigation falls back to `/offline`
  (cached at install), then to `/` — the user always gets a page.
- **Stale-while-revalidate assets**: static chunks served from cache instantly
  while the network refreshes them in the background.
- **Icon paths are now consistent**: manifest and sw.js reference the same
  generated `icon-192.png` / `icon-512.png` / `badge-72x72.png`.
- **Standalone offline page**: like `not-found.tsx`, it owns its `<html>`/
  `<body>` so it works even when the app shell is unavailable.

## 4. Commits

| Repo | Commit |
|---|---|
| sogo6-ui | *(to add)* — feat(pwa): icons, manifest, service worker, offline page |
| sogo6-server | *(to add)* — docs(tier1): PWA change file + tracker complete |
| root | *(to add)* — docs(pwa): implementation summary + Tier 1 DONE |

## 5. Result — Tier 1 Complete (14/14)

Conversation View, Calendar Subscriptions, Working Hours / Location, Undo Send,
Schedule Send, Email Snooze, Push Notifications, **Global Quick Search (Cmd+K)**,
**PWA / Mobile Web**, Keyboard Shortcuts, PGP E2E Encryption, Follow-Up Flags,
Quick Reply Templates, Drag-and-Drop Attachments.

Next: Tier 2 — Admin & Scale (Audit Log, API Tokens, Backup Automation, …).
