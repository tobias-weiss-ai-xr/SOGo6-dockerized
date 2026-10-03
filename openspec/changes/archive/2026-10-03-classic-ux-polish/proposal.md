# Proposal: classic-ux-polish

## Why

The SOGo5-classic skin in sogo6-ui is pixel-parity-verified (login 0.86, mail 0.83, compose 0.85, calendar 0.85, contacts 0.84), but daily-use ergonomics still diverge from SOGo5: selects render oversized, mail list rows shift horizontally on hover, the bulk-selection toolbar has no "move to folder" action, and the header search is light-gray-on-teal and barely readable. These are UX-level gaps, not pixel gaps — they need component behavior changes + tests, not CSS hacks.

## What Changes

- **Compact selects**: SOGo5 uses small, dense dropdown/select boxes. Shrink classic-skin selects (SelectTrigger height/padding) to SOGo5 proportions without breaking the modern theme.
- **Stable mail list rows**: Hover must not move the row content. Currently the date column is swapped out for hover action buttons (`group-hover:hidden` + `group-hover:flex`), which shoves the rest of the row horizontally. Replace with an overlay approach: actions render absolutely over the date column, row content stays fixed.
- **Bulk "move to folder"**: The mail list bulk-action bar (checked selection) currently offers delete/archive/mark-read/spam/label(disabled) but no way to move selected mails into an arbitrary folder. Add a "Move to folder" bulk action opening a folder-picker dialog and issuing the existing backend `batch-action move` (MailActionsBar + MoveFolderDialog reuse).
- **Readable header search**: The module header search (`MailsSearch`/`ContactsSearch`/`CalendarEventsSearch`/`TasksSearch`) renders a light-gray border/text pill on the teal SOGo5 header band. Restyle for SOGo5: appropriately-contrasted text/background on the teal band (both idle pill and active query states).

## Capabilities

### New Capabilities
- `classic-theme`: SOGo5-classic skin component ergonomics (compact controls, stable layout, readable header chrome). This is new UI behavior captured for the first time as a spec.

### Modified Capabilities
<!-- None: no existing spec describes UI component behavior. Server/DAV specs (authentication, ldap-directory, saml2-federation, shared-mailboxes) are unaffected. -->

## Impact

- Repo: sogo6-ui submodule only (components, tests). No backend/DAV/API changes.
- Components:
  - `src/components/ui/select.tsx` (or classic-scoped override in `globals.css`) — compact select sizing
  - `src/features/mails/components/list-item-{desktop,classic,mobile}.tsx` — stable row hover (overlay actions)
  - `src/features/mails/components/list/list-toolbar.tsx` + `src/features/mails/components/sidebars/move-folder-dialog.tsx` + `MailActionsBar` — bulk move-to-folder
  - `src/features/mails/components/mails-search.tsx` (+ contacts/calendar/tasks search twins, `src/components/app-header.tsx`) — header search contrast
- Tests: jest unit/component tests for each behavior; visual baseline re-capture for mail + contacts/calendar after deploy.
- Parity impact: mail/contacts/calendar cross-similarity should not regress (rows keep geometry), mail may improve.
