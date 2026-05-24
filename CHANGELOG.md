# Changelog

All builds of Series Expense, newest first.

---

## Build 6 — 2026-05-22

### New
- Filter sheet on Expenses screen — filter by date range (Today / This Week / This Month) and category, combined
- Filter button highlights when filters are active

### Changed
- Long press to delete restored (swipe gestures conflicted with tab navigation)
- Calendar grid locked to fixed height — no more modal jumping between months

### Fixed
- Calendar not reflecting new expenses without restarting the app
- Keyboard/numpad persisting after tapping away from text inputs
- Date picker auto-closing when scrolling through months — now requires a confirm button
- Categories not loading on fresh install (token race condition on app mount)
- App forced into dark mode system-wide — alerts, keyboard, and date picker now match the app's aesthetic

---

## Build 5 — 2026-05-21

### New
- Sign in with Apple with per-user expense isolation
- Info sheet on login screen explaining Hide My Email and how data is stored
- Server-side category persistence — categories now survive app reinstalls
- Fresh install now correctly prompts login (iOS Keychain token cleared on reinstall)
- Safe area insets applied across all screens (Dynamic Island / SE support)

### Changed
- App name changed to Series Expense
- Categories start empty for new users — no default seeding

---

## Build 4 — 2026-05-20

### New
- Edit expense date from the edit modal
- Scrollable edit modal when keyboard is open

### Fixed
- Today total showing $0 for users outside UTC — date range now computed in device local timezone
- Keyboard overlapping the edit expense modal

---

## Build 3 — 2026-05-19

### New
- Calendar modal (tap "View Calendar" on Monthly summary) — browse spending by day, tap a day to see transactions
- Per-range budgets (daily / weekly / monthly) with progress bar and over/under display
- Category management — add custom categories with emoji, long press to delete with wiggle animation
- App icon

---

## Build 1–2 — 2026-05-19

### New
- Initial release
- Three-screen swipe navigation: Summary · Add Expense · Expenses list
- Today / This Week / This Month totals
- Add expenses with amount, title, category, and date
- Edit and delete expenses inline
