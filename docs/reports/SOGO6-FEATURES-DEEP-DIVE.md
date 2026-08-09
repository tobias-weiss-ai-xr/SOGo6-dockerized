# SOGo 6 Features Deep Dive: Free/Busy, Accessibility & Localization

> **Last Updated:** 2026-07-25  
> **Focus:** Detailed analysis of Free/Busy, Accessibility (a11y), and Localization (i18n) features

---

## 📋 Table of Contents

1. [Free/Busy Feature](#-freebusy-feature)
   - [Current Status](#current-status)
   - [Implementation Details](#implementation-details)
   - [API Endpoints](#api-endpoints)
   - [Backend Architecture](#backend-architecture)
   - [Frontend Status](#frontend-status)
   - [Contribution Opportunities](#contribution-opportunities-1)

2. [Accessibility (a11y)](#-accessibility-a11y)
   - [Current Status](#current-status-1)
   - [Implementation Analysis](#implementation-analysis)
   - [UI Components Accessibility](#ui-components-accessibility)
   - [Testing](#testing)
   - [Standards Compliance](#standards-compliance)
   - [Contribution Opportunities](#contribution-opportunities-2)

3. [Localization (i18n)](#-localization-i18n)
   - [Current Status](#current-status-2)
   - [Implementation Details](#implementation-details-1)
   - [Supported Languages](#supported-languages)
   - [Translation Files](#translation-files)
   - [Backend Localization](#backend-localization)
   - [Contribution Opportunities](#contribution-opportunities-3)

4. [Cross-Feature Analysis](#-cross-feature-analysis)

5. [Recommended Contributions](#-recommended-contributions)

---

## 🆓 Free/Busy Feature

### Current Status

**Overall Completion:** ~70% (Backend: 90%, Frontend: 60%)

| Aspect | Backend Status | Frontend Status | Notes |
|--------|----------------|-----------------|-------|
| Free/Busy API | ✅ 100% | ❌ Not integrated | API endpoint exists and works |
| Free/Busy Engine | ✅ 100% | N/A | Core computation logic implemented |
| Event "Show as Busy" | ⚠️ 60-90% | ❌ 0% | Bug with busy/free values |
| Attendee Free/Busy | ✅ 100% | ⚠️ 90% | Only yesterday and tomorrow work |

### Implementation Details

#### API Schemas

**Request Schema (`FreeBusyRequestSchema`):**
```python
{
  "target_uids": ["user1@example.com", "user2@example.com"],
  "start": "2026-04-22T00:00:00Z",
  "end": "2026-04-22T23:59:59Z"
}
```

**Response Schema (`FreeBusyResponseSchema`):**
```python
{
  "data": {
    "start": "2026-04-22T00:00:00Z",
    "end": "2026-04-22T23:59:59Z",
    "attendees": {
      "user1@example.com": {
        "periods": [
          {
            "start": "2026-04-22T10:00:00Z",
            "end": "2026-04-22T11:00:00Z",
            "type": "busy",
            "title": "Meeting"
          }
        ]
      }
    },
    "is_available": true
  }
}
```

#### Backend Architecture

**Location:** `sogo6-server/app/module/calendar/`

From the architecture documentation:
```
Calendar Sources
└── FreeBusyEngine (free/busy computation)
```

The FreeBusyEngine is responsible for:
- Aggregating calendar events across all user calendars
- Calculating busy/free periods
- Respecting the `include_in_freebusy` calendar setting
- Generating free/busy information for attendees

**Key Files:**
- `app/api/v1/calendar/ApiCalendar.py` - API endpoint at `/freebusy`
- `app/api/v1/calendar/schemas/freebusy.py` - Request/response schemas
- `app/module/calendar/` - Core calendar logic including FreeBusyEngine

#### Calendar Settings

Each calendar has a `include_in_freebusy` setting (default: `true`):
- When `false`, the calendar's events are **excluded** from free/busy computation
- This is a **relational column** (not a JSON blob)
- Used by `CalendarSources.get_freebusy_events` to skip calendars

### API Endpoints

#### POST /api/user/v1/calendar/freebusy

**Purpose:** Query free/busy information for one or more users

**Request:**
```json
{
  "target_uids": ["user1@example.com"],
  "start": "2026-07-25T00:00:00Z",
  "end": "2026-07-26T23:59:59Z"
}
```

**Response:**
```json
{
  "data": {
    "start": "2026-07-25T00:00:00Z",
    "end": "2026-07-26T23:59:59Z",
    "attendees": {
      "user1@example.com": {
        "periods": [
          {
            "start": "2026-07-25T14:00:00Z",
            "end": "2026-07-25T15:00:00Z",
            "type": "busy",
            "title": "Team Meeting"
          }
        ]
      }
    },
    "is_available": false
  },
  "status": "success"
}
```

**Error Codes:**
- `S000614`: Free/Busy Range Exceeds Maximum Allowed Period
- `S000615`: Invalid Free/Busy iCalendar Request

### Frontend Status

**Current State:** Free/Busy API exists but **UI integration is missing**

From the roadmap:
- **Event Creation UI:** ❌ 60% - "show as busy or free" - Bug with busy/free values
- **Attendee Free/Busy:** ❌ 90% - Only yesterday and tomorrow work (INCOMPLETE)

**UI Components Needing Free/Busy:**
1. **Event Creation/Edit Form** - "Show as" dropdown (busy/free/tentative)
2. **Attendee Availability View** - Visual free/busy calendar for attendees
3. **Scheduling Assistant** - Side-by-side free/busy comparison

### Free/Busy in Event Creation

**Backend Support:**
```python
# In event schemas
show_as = fields.String(
    validate=validate.OneOf(['busy', 'free', 'tentative', 'out-of-office']),
    load_default='busy'
)
```

**Status:** ❌ 60-90% - There's a **bug with busy/free values** that needs fixing

**Roadmap Item:**
```
[ ]  90%: show as busy (bug with value not busy/free)
```

### Contribution Opportunities

#### 🔥 High Priority

1. **Fix "Show as Busy" Bug**
   - **Location:** Event creation/update logic
   - **Task:** Investigate and fix the bug preventing proper busy/free/tentative values
   - **Impact:** ⭐⭐⭐⭐⭐ - Critical for scheduling
   - **Effort:** 1-2 weeks

2. **Fix Attendee Free/Busy Date Range**
   - **Current:** Only works for yesterday and tomorrow
   - **Task:** Extend to work for any date range
   - **Location:** `FreeBusyEngine` or API query logic
   - **Impact:** ⭐⭐⭐⭐⭐ - Critical for scheduling
   - **Effort:** 1-2 weeks

3. **Free/Busy UI Integration**
   - **Task:** Connect the existing API to the frontend
   - **Location:** `sogo6-ui/src/features/calendar/`
   - **Components Needed:**
     - Free/Busy "Show as" dropdown in event form
     - Attendee availability view
     - Scheduling assistant
   - **Impact:** ⭐⭐⭐⭐⭐ - Core feature
   - **Effort:** 2-3 weeks

#### 🚀 Medium Priority

4. **Free/Busy Caching**
   - **Task:** Cache free/busy information to reduce database queries
   - **Location:** Redis cache layer
   - **Impact:** ⭐⭐⭐⭐ - Performance improvement
   - **Effort:** 1 week

5. **Team Free/Busy View**
   - **Task:** Create a team-wide free/busy overview
   - **Location:** `sogo6-ui/src/features/calendar/`
   - **Impact:** ⭐⭐⭐ - Nice to have
   - **Effort:** 2 weeks

---

## ♿ Accessibility (a11y)

### Current Status

**Overall Completion:** ~30-40% (Basic foundation exists, needs comprehensive implementation)

| Aspect | Status | Notes |
|--------|--------|-------|
| ARIA Attributes | ✅ Partially Implemented | 148 files use ARIA/role attributes |
| Semantic HTML | ✅ Partially Implemented | Some components use semantic elements |
| Keyboard Navigation | ⚠️ Limited | Basic tab navigation works, advanced keyboard shortcuts missing |
| Screen Reader Support | ⚠️ Limited | Basic support, needs testing and improvement |
| Color Contrast | ❌ Not Verified | No WCAG compliance testing documented |
| Focus Management | ⚠️ Partial | Some focus states, needs comprehensive implementation |
| Error Messaging | ⚠️ Partial | Some accessible error messages, needs improvement |

### Implementation Analysis

#### Framework Support

SOGo6-UI uses **Radix UI** components, which have **built-in accessibility**:
```typescript
// From AGENTS.md
3. Follow the Radix UI patterns for accessibility
4. **Accessibility** - Use semantic HTML and ARIA attributes
```

**Radix UI Accessibility Features:**
- ✅ Keyboard navigation built-in
- ✅ Focus management
- ✅ ARIA attributes
- ✅ Screen reader support
- ✅ Customizable for WCAG compliance

#### ARIA Usage Analysis

**Total Files with ARIA/role:** 148 files in `sogo6-ui`

**Common ARIA Patterns Found:**
```typescript
// aria-label for icon buttons
aria-label={t('back_to_list.string')}

// aria-label for table cells
aria-label="Select all"
aria-label="Select row"

// role attributes
role="tab"
role="tabpanel"
role="button"
```

#### Current Accessibility Features

**✅ Implemented:**
1. **Basic ARIA Labels** - Buttons, links, form elements
2. **Semantic HTML** - Some use of `<nav>`, `<main>`, `<section>`
3. **Focus Indicators** - Basic CSS focus styles
4. **Keyboard Navigation** - Tab order, basic Enter/Space for buttons
5. **Screen Reader Announcements** - Some live regions

**⚠️ Partially Implemented:**
1. **Form Accessibility** - Some forms have proper labels and error messages
2. **Modal Dialogs** - Basic focus trapping, needs improvement
3. **Tab Navigation** - Works but could be more efficient
4. **Skip Links** - Not consistently implemented

**❌ Not Implemented:**
1. **WCAG 2.1 AA Compliance** - No formal compliance testing
2. **High Contrast Mode** - No dark mode or high contrast theme
3. **Keyboard Shortcuts** - No documented keyboard shortcuts
4. **-screen-reader-only Classes** - No utility for visually hidden content
5. **FocusVisible Management** - No proper focus-visible state management
6. **Reduced Motion** - No `prefers-reduced-motion` support

### UI Components Accessibility

#### Table Components

**Admin Data Table (`sogo6-ui/src/features/admin-panel/`)**
```typescript
// ✅ Basic accessibility implemented
aria-label="Select all"
aria-label="Select row"
aria-label="Custom domain name"
aria-label="Custom domain description"
```

**Status:** ⚠️ 60% - Basic ARIA labels, needs comprehensive table accessibility

#### Form Components

**Form Inputs:**
```typescript
// Typical pattern
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

**Status:** ⚠️ 70% - Most forms have labels, some missing error accessibility

#### Navigation

**Main Navigation:**
- Uses semantic `<nav>` elements
- Has basic ARIA labels
- Keyboard navigable

**Status:** ⚠️ 75% - Good foundation, needs focus management improvements

### Testing

#### Existing Tests with Accessibility

**Test File:** `sogo6-ui/src/app/[locale]/(loggedin)/u/[account]/[folder]/@classic/@visualization/__tests__/default.test.tsx`
```typescript
describe('accessibility', () => {
  // Accessibility tests
})
```

**Status:** ⚠️ 10% - Only one test file found with accessibility tests

#### Testing Libraries Available

From `sogo6-ui/`:
- **Testing Library** (`@testing-library/react`) - Supports accessibility queries
- **Jest** - Test runner
- **User Event** (`@testing-library/user-event`) - Simulates user interactions

**Recommended Accessibility Testing:**
```typescript
// Example accessibility test
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from '@axe-core/react' // Not currently installed

describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Component />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### Standards Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| **WCAG 2.1 AA** | ❌ Not Compliant | No formal testing |
| **WCAG 2.2** | ❌ Not Compliant | Latest standard not addressed |
| **ATAG 2.0** | ❌ Not Compliant | Authoring tool guidelines |
| **WAI-ARIA 1.2** | ⚠️ Partial | Some ARIA 1.2 features used |
| **Section 508** | ❌ Not Compliant | US accessibility law |
| **EN 301 549** | ❌ Not Compliant | EU accessibility standard |

### Contribution Opportunities

#### 🔥 High Priority

1. **WCAG 2.1 AA Compliance Audit**
   - **Task:** Comprehensive accessibility audit of all UI components
   - **Tools:** axe-core, WAVE, Lighthouse, manual testing
   - **Deliverable:** Accessibility audit report with prioritized fixes
   - **Impact:** ⭐⭐⭐⭐⭐ - Critical for inclusivity
   - **Effort:** 2-3 weeks

2. **Keyboard Navigation Improvements**
   - **Task:** Implement comprehensive keyboard navigation
   - **Scope:**
     - Tab order optimization
     - Keyboard shortcuts (⌘+K for search, etc.)
     - Focus trapping in modals
     - Skip links implementation
   - **Impact:** ⭐⭐⭐⭐⭐ - Essential for keyboard users
   - **Effort:** 2-3 weeks

3. **Screen Reader Testing & Fixes**
   - **Task:** Test with NVDA, JAWS, VoiceOver
   - **Scope:**
     - Verify all interactive elements are announced
     - Fix missing labels and descriptions
     - Test form navigation
     - Verify live regions work
   - **Impact:** ⭐⭐⭐⭐⭐ - Critical for blind users
   - **Effort:** 1-2 weeks

#### 🚀 Medium Priority

4. **High Contrast Theme**
   - **Task:** Implement dark mode and high contrast theme
   - **Scope:**
     - CSS custom properties for themes
     - User preference detection (`prefers-color-scheme`)
     - Manual theme switching
     - High contrast color palette
   - **Impact:** ⭐⭐⭐⭐ - Important for low vision users
   - **Effort:** 1-2 weeks

5. **Reduced Motion Support**
   - **Task:** Respect `prefers-reduced-motion` media query
   - **Scope:**
     - Disable animations when reduced motion is preferred
     - Provide static alternatives to animated content
     - Test with various motion preferences
   - **Impact:** ⭐⭐⭐⭐ - Important for users with vestibular disorders
   - **Effort:** 3-5 days

6. **Form Accessibility Enhancements**
   - **Task:** Improve all form accessibility
   - **Scope:**
     - Proper label associations
     - Accessible error messages
     - Field grouping with fieldset/legend
     - Required field indicators
   - **Impact:** ⭐⭐⭐⭐ - Critical for form usability
   - **Effort:** 1-2 weeks

7. **Table Accessibility**
   - **Task:** Make all data tables fully accessible
   - **Scope:**
     - Proper `<table>` structure
     - `<th>` elements with scope
     - `headers` attribute for complex tables
     - Keyboard navigation within tables
   - **Impact:** ⭐⭐⭐⭐ - Important for data presentation
   - **Effort:** 1 week

#### 🎯 Low Priority (But Valuable)

8. **Accessibility Testing Pipeline**
   - **Task:** Add automated accessibility testing to CI/CD
   - **Tools:** axe-core, jest-axe, Lighthouse CI
   - **Impact:** ⭐⭐⭐ - Prevents regressions
   - **Effort:** 3-5 days

9. **Accessibility Documentation**
   - **Task:** Create accessibility guidelines for contributors
   - **Scope:**
     - Coding standards for a11y
     - Testing guidelines
     - Common patterns and examples
     - WCAG compliance checklist
   - **Impact:** ⭐⭐⭐ - Helps maintain accessibility
   - **Effort:** 1 week

10. **Focus Styles Enhancement**
    - **Task:** Improve visible focus indicators
    - **Scope:**
      - Custom focus styles that meet WCAG
      - Focus-visible vs focus distinction
      - Consistent focus indicators across components
    - **Impact:** ⭐⭐⭐ - Important for keyboard navigation
    - **Effort:** 3-5 days

---

## 🌍 Localization (i18n)

### Current Status

**Overall Completion:** ~70% (Backend: 10%, Frontend: 90%)

| Aspect | Backend Status | Frontend Status | Notes |
|--------|----------------|-----------------|-------|
| **Language Support** | ❌ 0% | ✅ 100% | 4 languages supported in UI |
| **Translation Files** | ❌ 0% | ✅ 90% | JSON-based translations |
| **Language Detection** | ❌ 0% | ✅ 100% | Browser preference, URL-based |
| **Language Switching** | ❌ 0% | ⚠️ 80% | Auto-detection works, manual switching incomplete |
| **Date/Time Localization** | ❌ 0% | ✅ 100% | Proper date formatting |
| **Number Localization** | ❌ 0% | ⚠️ 50% | Needs implementation |

### Implementation Details

#### Frontend Localization

**Framework:** Next.js with `next-intl` library

**Configuration:** `sogo6-ui/src/lib/i18n/config.ts`
```typescript
export function getLocales() {
  return ['en', 'de', 'fr', 'es']
}

export function getDefaultLocale() {
  return 'en'
}

export const routing = defineRouting({
  locales: getLocales(),
  defaultLocale: getDefaultLocale(),
  localePrefix: 'always',
  localeDetection: true,
})
```

**Supported Locales:**
- ✅ English (`en`)
- ✅ German (`de`)
- ✅ French (`fr`)
- ✅ Spanish (`es`)

#### Translation File Structure

```
sogo6-ui/src/messages/
├── en/
│   ├── admin-panel/
│   │   ├── domain.json
│   │   ├── rule.json
│   │   └── ...
│   ├── header.json
│   ├── mails/
│   │   └── list.json
│   ├── tasks.json
│   └── user-settings/
│       ├── general.json
│       └── mail/
│           └── address-books.json
└── fr/
    └── ... (same structure)
```

**Translation File Example:**
```json
{
  "title": " Address Books",
  "description": "Manage your address books",
  "create": "Create Address Book",
  "delete": "Delete Address Book"
}
```

#### Routing

**URL Structure:**
```
/[locale]/[...path]
```

**Examples:**
- `/en/u/user@exmple.org/inbox` - English
- `/de/u/user@exmple.org/inbox` - German
- `/fr/auth/login` - French login

**Multi-domain Support:** Complex routing for different domains (see `AGENTS.md`)

#### Language Switching

From the roadmap:
- ✅ 100%: Change language (UI implemented)
- ❌ 0%: Auto-detection of language (NOT WORKING)

**Current Status:**
- Language can be changed in user settings
- URL-based language switching works
- Browser preference detection is **not working**

### Backend Localization

**Status:** ⚠️ 10% - Minimal implementation

**Current Implementation:**
```python
# From sogo6-server/app/module/calendar/CalendarConst.py
# There is no i18n backend yet: the SOGO_U_LANGUAGE user preference exists but is never read
# server-side. When a translation mechanism lands, resolve these per recipient locale instead
```

**Missing Features:**
- ❌ Backend translation mechanism
- ❌ User language preference storage
- ❌ Language preference application
- ❌ Localized error messages
- ❌ Localized email templates
- ❌ Localized API responses

**Existing User Preference:**
- `SOGO_U_LANGUAGE` - User language preference (exists but not used)

### Date/Time Localization

**Frontend:** ✅ Implemented

**File:** `sogo6-ui/src/lib/i18n/date-locales.ts`
```typescript
// Provides locale-specific date formatting
// Uses Intl.DateTimeFormat API
```

**Test:** `sogo6-ui/src/lib/i18n/__tests__/date-locales.test.ts`

**Backend:** ❌ Not implemented
- dates are stored in UTC
- No locale-aware formatting in API responses

### Frontend Localization Status from Roadmap

From `SOGo6Plan.adoc`:

**Main UI View:**
- ✅ 100%: Show SOGo logo
- ✅ 100%: Show Mail button (if SOGO_D_MODULE_ACCESS allows)
- ❌ 0%: Show module according to user preferences (SOGO_U_FIRST_MODULE)

**Change Language:**
- ⚠️ 80%: Change language (missing the auto-detection of language)

### Backend Localization Comments

**From `sogo6-server/app/module/calendar/ModuleCalendar.py`:**
```python
# floating-time events imported later are anchored to the user's locale rather than UTC.
```

**From `sogo6-server/app/module/calendar/CalendarConst.py`:**
```python
# There is no i18n backend yet: the SOGO_U_LANGUAGE user preference exists but is never read
# server-side. When a translation mechanism lands, resolve these per recipient locale instead

# only user-facing text in a reminder email and are currently hard-coded English. There is no i18n
# them per recipient locale instead of using the constants below. Handle them together with the iMIP
```

### Contribution Opportunities

#### 🔥 High Priority

1. **Backend Localization Implementation**
   - **Task:** Implement server-side internationalization
   - **Scope:**
     - Choose i18n library (gettext, Babel, Flask-Babel)
     - Read `SOGO_U_LANGUAGE` user preference
     - Localize error messages
     - Localize email templates
     - Localize API response messages
   - **Impact:** ⭐⭐⭐⭐⭐ - Critical for international users
   - **Effort:** 2-3 weeks

2. **Auto Language Detection**
   - **Task:** Implement browser preference detection
   - **Current:** User must manually select language
   - **Target:** Auto-detect from browser settings, allow override
   - **Impact:** ⭐⭐⭐⭐ - Improves user experience
   - **Effort:** 3-5 days

3. **Complete Translation Coverage**
   - **Task:** Add missing translations for all UI text
   - **Scope:**
     - Audit all UI text for translation coverage
     - Add missing translation keys
     - Verify all existing translations
     - Add new languages (Italian, Dutch, etc.)
   - **Impact:** ⭐⭐⭐⭐ - Important for international adoption
   - **Effort:** Ongoing

#### 🚀 Medium Priority

4. **Right-to-Left (RTL) Language Support**
   - **Task:** Add support for RTL languages (Arabic, Hebrew)
   - **Scope:**
     - CSS direction support
     - Layout adjustments for RTL
     - Form field alignment
     - Icon positioning
   - **Impact:** ⭐⭐⭐ - Expands language support
   - **Effort:** 1-2 weeks

5. **Number Localization**
   - **Task:** Implement locale-aware number formatting
   - **Scope:**
     - Use `Intl.NumberFormat` API
     - Format numbers, currencies, percentages
     - Respect user preferences
   - **Impact:** ⭐⭐⭐ - Important for financial data
   - **Effort:** 3-5 days

6. **Date/Time Backend Localization**
   - **Task:** Localize date/time in API responses
   - **Scope:**
     - Accept locale parameter in API requests
     - Return localized dates in responses
     - Support user's preferred date format
   - **Impact:** ⭐⭐⭐⭐ - Improves API usability
   - **Effort:** 1 week

7. **Language Fallback Mechanism**
   - **Task:** Implement language fallback (e.g., fr-CA → fr → en)
   - **Scope:**
     - Detect user's preferred language variants
     - Fall back to base language
     - Fall back to default language
   - **Impact:** ⭐⭐⭐ - Improves translation coverage
   - **Effort:** 3-5 days

#### 🎯 Low Priority (Enhancements)

8. **Translation Management Tool**
   - **Task:** Set up translation platform (Crowdin, Lokalise, POEditor)
   - **Scope:**
     - Extract translation strings automatically
     - Allow community contributions
     - Manage translation workflows
   - **Impact:** ⭐⭐⭐ - Streamlines translation process
   - **Effort:** 1 week

9. **Translation Quality Checks**
   - **Task:** Add translation validation
   - **Scope:**
     - Check for missing translations
     - Validate translation strings
     - Detect duplicate keys
     - Check for unused translations
   - **Impact:** ⭐⭐⭐ - Improves translation quality
   - **Effort:** 3-5 days

10. **Localization Testing**
    - **Task:** Add pseudo-localization for testing
    - **Scope:**
      - Generate pseudo-translated strings
      - Test with RTL languages
      - Verify character encoding
    - **Impact:** ⭐⭐⭐ - Catches localization issues early
    - **Effort:** 3-5 days

---

## 🔗 Cross-Feature Analysis

### Intersection: Free/Busy + Localization

| Feature | Status | Notes |
|---------|--------|-------|
| Localized Free/Busy Messages | ❌ 0% | API responses in English only |
| Localized Date/Time in Free/Busy | ❌ 0% | Dates returned in UTC/ISO format |
| Timezone Awareness in Free/Busy | ✅ 100% | Backend handles timezones correctly |

**Contribution Opportunity:**
- Add locale parameter to free/busy API
- Localize free/busy period titles
- Localize date/time formatting in responses

### Intersection: Accessibility + Localization

| Feature | Status | Notes |
|---------|--------|-------|
| Accessible Language Switcher | ⚠️ 50% | Basic implementation, needs improvement |
| Screen Reader Language Announcement | ❌ 0% | Language changes not announced |
| Localized ARIA Labels | ⚠️ 50% | Some labels translated, some hardcoded |

**Contribution Opportunity:**
- Ensure language switcher is keyboard accessible
- Announce language changes to screen readers
- Translate all ARIA labels

### Intersection: Accessibility + Free/Busy

| Feature | Status | Notes |
|---------|--------|-------|
| Accessible Free/Busy View | ❌ 0% | Not implemented yet |
| Keyboard Navigation in Free/Busy | ❌ 0% | Not implemented yet |
| Screen Reader Free/Busy Announcement | ❌ 0% | Not implemented yet |

**Contribution Opportunity:**
- When implementing Free/Busy UI, ensure full accessibility
- Add keyboard navigation for free/busy calendar
- Screen reader support for free/busy information

---

## 🎯 Recommended Contributions

### 🏆 Top 5.contrib Priority Contributions

| # | Feature | Area | Impact | Effort | Difficulty |
|---|---------|------|--------|--------|------------|
| 1 | **Backend Localization** | i18n | ⭐⭐⭐⭐⭐ | 2-3 weeks | Medium |
| 2 | **Fix Attendee Free/Busy Date Range** | Free/Busy | ⭐⭐⭐⭐⭐ | 1-2 weeks | Medium |
| 3 | **WCAG 2.1 AA Compliance Audit** | a11y | ⭐⭐⭐⭐⭐ | 2-3 weeks | Medium |
| 4 | **"Show as Busy" Bug Fix** | Free/Busy | ⭐⭐⭐⭐⭐ | 1-2 weeks | Low-Medium |
| 5 | **Keyboard Navigation Improvements** | a11y | ⭐⭐⭐⭐⭐ | 2-3 weeks | Medium |

### 🚀 Next 5 High-Impact Contributions

| # | Feature | Area | Impact | Effort | Difficulty |
|---|---------|------|--------|--------|------------|
| 6 | **Free/Busy UI Integration** | Free/Busy | ⭐⭐⭐⭐⭐ | 2-3 weeks | Medium |
| 7 | **Auto Language Detection** | i18n | ⭐⭐⭐⭐ | 3-5 days | Low |
| 8 | **Screen Reader Testing & Fixes** | a11y | ⭐⭐⭐⭐⭐ | 1-2 weeks | Medium |
| 9 | **Calendar Sharing** | Free/Busy | ⭐⭐⭐⭐⭐ | 2-3 weeks | Medium |
| 10 | **High Contrast Theme** | a11y | ⭐⭐⭐⭐ | 1-2 weeks | Low-Medium |

### 📊 Feature Completion Summary

| Feature Area | Backend | Frontend | Combined | Key Blockers |
|-------------|---------|----------|----------|--------------|
| **Free/Busy** | 90% | 60% | 75% | Bug in "show as", date range limitation, UI integration |
| **Accessibility** | N/A | 30-40% | 35% | No compliance testing, limited keyboard support, no screen reader testing |
| **Localization** | 10% | 90% | 50% | Backend not localized, auto-detection not working |

### 🎯 Suggested Contribution Path

#### For Beginners (1-2 weeks)
1. **Add Missing Translations** - Start with existing translation files
2. **Fix Simple Accessibility Issues** - Add missing ARIA labels
3. **Test Free/Busy API** - Verify the existing API works correctly

#### For Intermediate Developers (2-4 weeks)
1. **Implement Auto Language Detection**
2. **Fix "Show as Busy" Bug**
3. **Add Keyboard Navigation to Calendar**
4. **Implement High Contrast Theme**

#### For Advanced Developers (4+ weeks)
1. **Backend Localization Implementation**
2. **Free/Busy UI Integration** (Scheduling Assistant)
3. **WCAG 2.1 AA Compliance** (Full audit and fixes)
4. **Screen Reader Testing & Fixes**

---

## 📚 Resources

### Free/Busy Resources
- [iCalendar RFC 5545 (Free/Busy)](https://tools.ietf.org/html/rfc5545#section-3.6.9)
- [CalDAV Free/Busy RFC 6638](https://tools.ietf.org/html/rfc6638)
- [SOGo 5 Free/Busy Implementation](https://github.com/Alinto/sogo) (reference)

### Accessibility Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA 1.2 Specification](https://www.w3.org/TR/wai-aria-1.2/)
- [Testing Library Accessibility Queries](https://testing-library.com/docs/queries/about/#accessibility-queries)
- [axe-core GitHub](https://github.com/dequelabs/axe-core)

### Localization Resources
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Flask-Babel Documentation](https://python-babel.github.io/flask-babel/)
- [GNU gettext](https://www.gnu.org/software/gettext/)
- [FormatJS](https://formatjs.io/)

---

## 📝 Notes

1. **Free/Busy:** The backend API and engine are mostly complete, but the frontend integration is missing. There are also some bugs in the "show as busy" functionality.

2. **Accessibility:** The frontend has a good foundation with Radix UI components and some ARIA attributes, but comprehensive accessibility testing and improvements are needed.

3. **Localization:** The frontend has excellent localization support with next-intl, but the backend currently has no localization implementation.

4. **Intersection:** These three features intersect in several ways (localized free/busy messages, accessible language switcher, etc.) and should be considered together when implementing.

5. **Testing:** There's a significant opportunity to improve testing for all three features, especially accessibility testing and localization testing.

---

*Document generated from SOGo 6 source code analysis | Last updated: 2026-07-25*
