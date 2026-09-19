# Tasks: classic-ux-polish

## 1. Compact selects in classic skin

- [x] 1.1 Add `.sogo5-classic` scoped rule compacting `SelectTrigger` (height/padding) without touching the modern theme (`globals.css`)
- [x] 1.2 Test: component test asserting classic-scoped select trigger computed height ≤32px and modern trigger unchanged
- [x] 1.3 Verify visually against sogo5 sidebar/dialog density (mail sort/filter + folder dialogs)

## 2. Mail list rows do not shift on hover

- [x] 2.1 `list-item-desktop.tsx`: keep date span mounted in reserved `w-1/5` column; render hover action buttons as absolute right-aligned overlay (no `group-hover:hidden/flex` swap)
- [x] 2.2 `list-item-classic.tsx`: apply the same overlay pattern
- [x] 2.3 Test: component test — row column x-positions identical before/after hover; row height identical (§ contract)
- [x] 2.4 Verify via Playwright probe on deployed instance (bounding-box compare, hover on/off)

## 3. Bulk move selected mails to any folder

- [x] 3.1 Wire a `bulk-move` entry into `MailActionsBar` actions list in `list-toolbar.tsx` (icon + "move to folder" title), disabled when zero selected
- [x] 3.2 Reuse `MoveFolderDialog` in multi-select mode: open from bulk bar, list folders excluding current, confirm — *deviation: dedicated `BulkMoveDialog` (see design.md D3a)*
- [x] 3.3 On confirm: call `useBatchMailActionMutation` with `{action:'move', mailUids:selectedIds, data:<dest>}`; clear selection + refresh on success; show error on failure (no partial move)
- [x] 3.4 Test: toolbar test — selecting mails reveals move action; confirm dispatches batch move with correct payload; zero-selection disables button; failure path surfaces error without clearing selection
- [x] 3.5 Verify live: select 2+ mails in a folder, move to another folder, confirm they land there

## 4. Header search readable on teal band

- [x] 4.1 Add `.sogo5-classic` CSS for search pill (idle + active states) with ≥4.5:1 contrast against `#4D8080` in `globals.css`
- [x] 4.2 Confirm all four search components (mails/contacts/calendar/tasks) share the pill classes; adjust if a variant differs
- [x] 4.3 Test: component test computing text-bg contrast from getComputedStyle for idle + active states ≥4.5:1
- [x] 4.4 Verify visually on deployed instance for each module header

## 5. Ship & verify

- [x] 5.1 Run full lint-staged + targeted jest suites; `next build` clean
- [x] 5.2 Commit sogo6-ui, re-pin submodule in parent, deploy via gitops-update.sh (contextual)
- [x] 5.3 Re-run visual cross-parity (`sg visual --cross sogo5,sogo6-ctx`); rebaseline if intentional geometry changes; gate 0.90 green
