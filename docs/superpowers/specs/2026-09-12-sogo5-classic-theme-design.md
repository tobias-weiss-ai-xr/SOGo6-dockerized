# SOGo 5 Classic Theme — Design

**Decision (user-approved):** "Recognizably classic" skin for sogo6 — SOGo5 look-and-feel, lucide icons kept, modern interaction internals accepted. Switch exposed in user options (Settings → General).

## Mechanism

`next-themes` already manages light/dark/accessibility themes as CSS classes on `<html>`
(`attribute="class"`, themes registered in `src/app/layout.tsx`, token blocks in
`src/app/globals.css`). **SOGo 5 Classic is just another theme value** — no new theming
infrastructure, no dependency on the admin `/customization/themes` endpoint (that stays
instance-global; its current 500 is a separate bug).

- Theme value: `sogo5-classic` (light-only, like SOGo 5 — selecting it replaces dark).
- Tokens sampled from the live SOGo 5 default theme CSS (`theme-default.css`):
  primary `#4D8080` (180 25% 40%), hover `#8EBFBB`, accent light `#B2D6D3`,
  calendar-selected `#A1CCC8`, background `#fafafa`, surfaces `#fff`, borders `#e0e0e0`,
  text rgba(0,0,0,.87)/.54, Material 2px radii, teal toolbar (`--header-background`).
- Classic extras: Roboto-first font stack, uppercase 500-weight buttons (Material text-button convention).

## Persistence (server-side, per-user)

`SOGO_U_THEME` (`default` | `sogo5-classic`) added to the existing `USER_GENERAL`
settings schema (`app/config/settings/UserSettings.py`) — schema-driven preferences
pick it up automatically; UI general form maps it via `general-utils.ts`.

- Switch: Select in the General settings form; **immediate-apply** (same pattern as the
  language selector): sets next-themes theme + PATCHes preferences.
- Boot sync: `ClassicThemeSync` client component in the logged-in layout — when the
  server pref changes, it wins over local next-themes state (cross-device consistency;
  localStorage still gives instant pre-login boot).

## Out of scope (agreed long tail)

Pixel-forensic states, Material icon swap, right-click/keyboard interaction parity,
per-module density/geometry passes (mail first — follow-up CSS iterations against the
live side-by-side).

## Testing

UI parity suite green on default theme (no regression); manual verification of
switch → class applied → persists across reload/devices.
