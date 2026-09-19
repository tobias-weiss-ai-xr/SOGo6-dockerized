# Design: classic-ux-polish

See proposal.md for the Why. This doc covers how each behavior is implemented in sogo6-ui.

## Context

All four items live in the sogo6-ui Next.js app. The classic skin is toggled by `next-themes` resolving to `sogo5-classic`, which adds a `.sogo5-classic` class on the root; existing skin overrides hang off `.sogo5-classic` in `src/app/globals.css`. The mail list row components share a `group`/`group-hover` pattern; bulk actions flow through `list-toolbar.tsx` → `MailActionsBar` → `useBatchMailActionMutation`; header search components are four near-identical components (`mails-search.tsx`, `contacts-search.tsx`, `calendar-events-search.tsx`, `tasks-search.tsx`).

## Goals / Non-Goals

- **Goals**: Compact classic selects; zero-shift hover on mail rows; bulk move-to-folder action; legible header search in classic skin. All with component tests and unchanged backend/API.
- **Non-Goals**: Restyling the modern theme; server changes; refactoring the four search components into one shared base (out of scope — smallest diff wins).

## Decisions

**D1 — Compact selects via CSS override on `.sogo5-classic`, not component surgery.**
The shared `SelectTrigger` (`h-9`) is used app-wide; changing it globally would alter the modern theme. Instead add a rule scoped to `.sogo5-classic` compacting the trigger (`height/px/padding`). The modern theme keeps `h-9`.
- *Alternative rejected*: a `size` prop on `SelectTrigger` — more invasive, touches every call site, no behavior gain.

**D2 — Row hover stability via absolute-positioned action overlay.**
Current code swaps the `w-1/5` date `<span>` for a `w-1/5` actions `<div>` (`group-hover:hidden`/`group-hover:flex`), which reflows sibling flex items. Fix: keep the date span mounted and always rendering into its reserved `w-1/5` column; render the actions row as an absolutely-positioned layer over that same column (`relative` on the row, actions `absolute right-0`), shown on `group-hover`. No sibling reflow ⇒ zero shift by construction.
- Applies to `list-item-desktop.tsx` and `list-item-classic.tsx`; mobile has no hover.
- *Alternative rejected*: reserving both elements with fixed width — requires duplicate width bookkeeping and still risks text-overflow mismatch.

**D3 — Bulk move reuses `MoveFolderDialog` + existing `batch-action move`.**
`move-folder-dialog.tsx` already renders a folder picker for single-mail moves; the backend already supports `batch-action {action:"move", data:"<dest>"}` (used by bulk-archive fallback). Add one `bulk-move` entry to the `MailActionsBar` actions list in `list-toolbar.tsx`, wire it to open `MoveFolderDialog` in multi-select mode, and on confirm call the same `useBatchMailActionMutation` move path with `selectedIds`.
- *Alternative rejected*: building a new standalone dialog — duplicate code.

**D4 — Search contrast via classic-scoped CSS.**
Idle pill uses `text-gray-500` + `border`, unreadable on `#4D8080`. Add `.sogo5-classic` rules: neutral/white text with sufficient contrast against teal, lighter pill background, readable border. Active-query pill (`bg-blue-50 text-blue-700`) already has strong contrast but clashes with teal band visually — restyle it to a light pill with dark text for classic. Single CSS block in `globals.css` covers all four search components (they share the same class pattern), avoiding 4× component edits.
- *Alternative rejected*: editing each search component's className — 4 files × 2 states, CSS does it in one place.

## Risks / Trade-offs

- [Classic-scoped CSS misses a search variant if a component uses an unexpected class] → Verify all four search components use the same pill classes before writing the override; add a component test asserting contrast with computed styles.
- [Row overlay buttons overlap date text when row is short] → Overlay is right-aligned with the actions laid out right-to-left; date text is left-aligned with truncation, so overlap only occurs on very narrow rows where the date already truncates. Acceptable.
- [Compact selects shrink modern-theme-adjacent dialogs in classic] → Scope strictly to `.sogo5-classic`; verify visually.

## Migration Plan

- Pure frontend change: build → lint-staged tests → commit sogo6-ui → re-pin submodule in parent → `gitops-update.sh` on contextual (existing deploy flow) → re-run visual cross-parity (mail/contacts/calendar) — rebaseline if intentional geometry changes are detected.

## Open Questions

None blocking. (Row action-button count may need to shrink in classic to fit the fixed `w-1/5` overlay; decided during implementation.)
