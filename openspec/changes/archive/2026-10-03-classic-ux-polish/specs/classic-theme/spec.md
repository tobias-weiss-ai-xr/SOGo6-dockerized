# classic-theme Spec — SOGo5-classic skin component ergonomics

## ADDED Requirements

### Requirement: Compact selects in the classic skin

**User story**: As an SOGo5 Classic user, I want dropdowns and selects to be small and dense like in SOGo5, so the toolbar does not feel oversized and I can scan more content per screen.

**Behavior**:
- WHEN the classic theme (`sogo5-classic`) is active, THEN select/combobox triggers render at a compact height (~28px content row, tighter horizontal padding) matching SOGo5 control density.
- WHEN the modern theme is active, THEN select triggers keep their current sizing (unchanged).
- Compact sizing applies to at least: folder-type/location selects in dialogs, sort/filter selects in the mail list toolbar, and dropdown trigger buttons in module headers.
- The compact trigger remains fully interactive: opens its dropdown, keyboard-navigable, ARIA `combobox`/`listbox` semantics preserved.

**Contract (selectable)**: Classic-skin select trigger height is `≤ 32px` rendered (measured via getBoundingClientRect), while the modern trigger height is unchanged from baseline.

#### Scenario: Classic select renders compact, modern keeps its size
- GIVEN the app is rendered with the `sogo5-classic` theme
- WHEN a select trigger is measured via getBoundingClientRect
- THEN its rendered height SHALL be ≤ 32px
- AND the same trigger rendered under the modern theme SHALL keep its original height

#### Scenario: Compact select stays fully interactive
- GIVEN a select trigger in the classic skin
- WHEN the user clicks it and presses ArrowDown/Enter
- THEN the dropdown SHALL open and be keyboard-navigable
- AND its ARIA `combobox`/`listbox` roles SHALL be present

### Requirement: Mail list rows do not shift on hover

**User story**: As an SOGo5 Classic user, I want the mail list row to stay exactly in place when I hover it, so columns do not jump and my eye does not lose the row.

**Behavior**:
- Hovering a mail list row highlights it (background change) and reveals row-level action buttons (mark read, delete, archive, …) WITHOUT moving any other content in the row.
- The date/attachment column keeps its horizontal position whether or not the row is hovered; action buttons overlay the same column area instead of displacing the date text.
- Row height, padding, and the checkbox column do not change on hover.
- Applies to all mail list row variants (desktop, classic, mobile).

**Contract (assertable via playwright/axe)**: For a rendered mail list row, the bounding-box x-coordinates of the sender/subject/date columns measured before and during hover are identical (±1px), and row height is identical.

#### Scenario: Hovering a row reveals actions without moving content
- GIVEN a mail list row is rendered
- WHEN the user hovers the row
- THEN the row background SHALL change on hover
- AND the action buttons (mark read, delete, archive) SHALL appear
- AND the bounding-box x-coordinates of the sender, subject and date columns SHALL NOT change (±1px)
- AND the row height SHALL NOT change

#### Scenario: Hover action buttons trigger their single-mail actions
- GIVEN the hover-overlay action buttons are visible on a row
- WHEN the user clicks the mark-read button
- THEN the read-state toggle handler SHALL be invoked for that mail id
- AND the click SHALL NOT trigger row selection/navigation

### Requirement: Bulk move selected mails to any folder

**User story**: As an SOGo5 Classic user, I want to select several mails and move them all into another mailbox folder at once, so I can file mail in bulk like in SOGo5.

**Behavior**:
- WHEN one or more mails are checked in the mail list, THEN the bulk-action bar shows a "Move to folder" action alongside delete/archive/mark-read/spam.
- Selecting "Move to folder" opens a folder picker displaying the account's mail folders (excluding the current folder).
- Choosing a folder and confirming issues the backend `batch-action` with action `move` and the chosen destination for all selected UIDs.
- On success: selection clears, the moved mails disappear from the current folder view, and the list refreshes.
- On failure (e.g. folder was removed): a user-visible error is shown and NO mails are marked as moved.
- The move is disabled (with tooltip/title) when zero mails are selected.

**Contract**: The bulk-move button only dispatches after the user confirms a destination folder; the API contract is `POST mailboxes/{account}/folders/{folder}/mails/batch-action {action:"move", mailUids:[…], data:"<dest>"}`.

#### Scenario: Bulk bar offers move-to-folder with a selection
- GIVEN two or more mails are checked in the mail list toolbar
- WHEN the bulk action bar renders
- THEN it SHALL include a "Move to folder" action
- AND the action SHALL be enabled

#### Scenario: Move-to-folder requires a confirmed destination
- GIVEN the user clicks "Move to folder" with a selection
- WHEN the folder picker opens and the user picks a destination and confirms
- THEN a batch move request SHALL be issued with the selected mail UIDs and the chosen destination folder
- AND on success the selection SHALL clear and the list SHALL refresh

#### Scenario: Failed bulk move reports the error and keeps the selection
- GIVEN the user confirms a bulk move to a destination folder
- WHEN the backend returns a failure
- THEN a user-visible error SHALL be shown
- AND no mails SHALL be reported as moved (selection kept intact)

#### Scenario: Bulk move is disabled without a selection
- GIVEN no mails are checked in the mail list
- THEN the "Move to folder" bulk action SHALL be disabled

### Requirement: Header search readable on the teal SOGo5 band

**User story**: As an SOGo5 Classic user, I want the module header search to be legible on the teal toolbar band, so I can read the placeholder and my active query without squinting.

**Behavior**:
- The search pill (idle state) uses text and border colors with contrast `≥ 4.5:1` against the classic teal header background (`#4D8080`).
- The active-query state pill stays readable (darker text on light pill, or light text on teal) and shows the query plus result count and a close button.
- Applied consistently to mail, contacts, calendar, and tasks header searches in the classic skin.
- Modern theme appearance unchanged.

**Contract**: In the classic skin, computed text-color-to-background contrast ratio of the search pill is `≥ 4.5:1` (measurable via browser `getComputedStyle` + WCAG ratio math), for both idle and active states.

#### Scenario: Idle search pill is legible on the teal band
- GIVEN the classic theme and an idle header search
- WHEN the text and background colors of the search pill are measured via getComputedStyle
- THEN their WCAG contrast ratio SHALL be ≥ 4.5:1 on the classic teal header background

#### Scenario: Active search state stays readable and usable
- GIVEN the classic theme and an active search query
- WHEN the active-query pill is rendered
- THEN the query text and result count SHALL be readable (contrast ≥ 4.5:1)
- AND a close button SHALL be present that clears the query
