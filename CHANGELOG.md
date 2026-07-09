# Changelog

All builds of Series Expense, newest first.

---

## Build 10 — 2026-07-09 — v2.2.0

Pre-launch release — recurring overhaul. Last planned TestFlight build before the public App Store release.

### New
- **Recurring redesigned as a dedicated Repeat sheet** — weekly / every 2 weeks (weekday-anchored), twice a month (pick two days on a 1–31 grid movie-theater style, or two colored weekday pairs like 1st & 3rd Friday), monthly by day or nth weekday with an every-N-months interval (quarterly, semi-annual), yearly — plus optional end dates and a live "Next: …" preview of the upcoming 3 occurrences. Rich rules serialize as JSON into the existing `recurringFreq` string; legacy encodings still parse. Engine mirrored in `src/utils/recurrence.js` and `server/index.js`
- Add/Edit screens show a plain-English rule summary card ("Twice a month — 1st Fri & 3rd Fri · Next: Jul 17") that reopens the sheet

### Changed
- Category collapse now uses explicit "+N more ⌄" / "Show less ⌃" pills in the grid (was an ambiguous header chevron)

### Fixed
- **Recurring cron duplication bug** — auto-added copies were created with `recurringAutoAdd: true`, so every copy became a scheduler and rows doubled each cycle. Copies are now plain entries; a one-time startup repair demotes existing duplicates
- **Modal scroll gestures** — sheets were wrapped in Pressables that raced ScrollViews for the drag gesture (scroll only worked intermittently, e.g. the What's New panel). All modals now use a backdrop-behind-the-sheet pattern

---

## Build 9 — 2026-07-08 — v2.1.0

### New
- **Daily reminders** — optional midday and evening local notifications to log expenses; times customizable, entirely on-device (`expo-notifications`, no push server)
- **Search** — ⌕ icon on the Expenses screen filters the list by title as you type
- **Custom date range filter** — "Custom" pill in the filter's Date row reveals Start/End date pickers; sent as `from`/`to` to the existing API
- **Weekday-anchored recurring** — Weekly/Biweekly with an S–S day selector (superseded by the Repeat sheet in 2.2.0)
- **Collapsible categories** on the Add screen

### Fixed
- Widget privacy icon misaligned on smaller screens — content margins disabled, eye pinned a fixed distance from the true corner
- Category drill-down list in Summary wouldn't scroll

---

## Build 8 — 2026-06-11 — v2.0.0

### New
- **Home screen widget** — today + this month totals at a glance, pure black to match the app. Updates instantly when an expense is added/edited/deleted; resets correctly at midnight without opening the app
- **Privacy eye on the widget** — tap the eye icon to mask amounts as `$••••` directly on the home screen (iOS 17 interactive widget, no app launch)
- **Biweekly recurring** frequency
- **"Monthly on a chosen day" recurring** — pick the exact day a subscription bills (e.g. always the 15th), clamped safely for short months
- **Biweekly summary period** — fixed Sun–Sat fortnights (not rolling), with its own budget

### Changed
- App now requires a development build for local dev (widget native code) — Expo Go no longer sufficient for widget work; JS-only development still hot-reloads via the dev client

### Fixed
- Expired sessions (JWT >7 days) now return you to the login screen instead of silently showing an empty app

### Infrastructure
- Widget target via `@bacons/apple-targets` (config-driven, CNG-compatible — `ios/` stays gitignored)
- App Group `group.com.justin.expensetracker` shares data between app and widget
- Local Expo module (`modules/widget-sync`) bridges JS → shared storage → WidgetKit reload

---

## Build 7 — 2026-05-28 — v1.2.0

### New
- Tap any category in the Summary breakdown to drill into its expenses for the selected range
- Budget section always visible on Summary, even when no expenses have been recorded yet
- Delete expense directly from the edit panel — trash icon in the modal header
- Tap outside any modal to dismiss it (all screens)
- Calendar forward navigation capped at the month of the latest expense — no infinite future scrolling
- Monthly total shown below the calendar grid
- Recurring expenses are always auto-added on their due date — manual/automatic toggle removed in favour of a single sensible default
- In-app changelog accessible via ⓘ icon on the Add screen

### Changed
- Page indicator now animates in real time during swipes (hybrid native/JS driver — opacity follows finger, width springs on release)
- Category name character limit increased from 20 → 30 characters
- Future-dated expenses are now allowed; upcoming expenses are labelled and excluded from period totals
- Delete expense moved from long-press hold into the edit modal

### Fixed
- Today's expenses were appearing as "upcoming" and not counting toward the Today total — date comparison now uses end-of-local-day rather than the UTC moment
- Weekly range corrected to Sun–Sat calendar week (was a rolling 7-day window from the current moment)
- Swipe-right navigation back to Summary was blocked on the Expenses screen due to gesture handler conflict — resolved by restricting swipeable activation to left-only swipes
- Category drill-down header text now aligns correctly with expense row text

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
