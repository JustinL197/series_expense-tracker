# Series Expense — Project Overview

Last updated: 2026-06-11 | Current build: 8 (v2.0.0)

---

## App Name & Purpose

**Series Expense** is a minimalistic personal expense tracker for iPhone. It is the first app in the planned *Series* suite — a collection of clean, professional tools covering everyday productivity needs (expense tracking, shared calendar, to-do list, etc.).

The target user is someone who wants a fast, no-friction way to log and review personal spending without the clutter of full-featured finance apps. The aesthetic is pure black, typographically minimal, and built around a three-screen swipe workflow.

---

## Tech Stack

### Frontend
- **React Native** (Expo managed workflow, SDK 54)
- **expo-apple-authentication** — Sign in with Apple
- **expo-secure-store** — JWT token storage
- **@react-native-async-storage/async-storage** — install-detection flag
- **@react-navigation/material-top-tabs** — swipe tab navigation
- **@react-native-community/datetimepicker** — date selection
- **react-native-safe-area-context** — dynamic insets for notch / Dynamic Island
- **react-native-gesture-handler** — gesture support base layer
- **@expo-google-fonts/inter** — Inter typeface
- **expo-dev-client** — development builds (required since the widget added native code)
- **@bacons/apple-targets** — generates the WidgetKit extension target during prebuild
- **modules/widget-sync** — local Expo module bridging JS → App Group storage → WidgetKit reload

### Backend
- **Node.js + Express** — REST API
- **Prisma 5** — ORM
- **PostgreSQL** — primary database (hosted on Railway)
- **jsonwebtoken** — JWT auth
- **apple-signin-auth** — Apple identity token verification

### Tooling
- **Expo EAS Build** — cloud iOS builds
- **EAS Submit** — automated TestFlight upload
- **Railway** — backend + database hosting (auto-deploys on push to `main`)
- **GitHub** — version control

---

## Architecture Overview

```
iPhone (Expo / TestFlight)
        │
        │  HTTPS
        ▼
  Express API (Railway)
        │
        │  Prisma ORM
        ▼
  PostgreSQL (Railway)
```

### Frontend
Three screens rendered in a horizontal swipe navigator (tab bar hidden):

```
Summary  ←→  Add Expense  ←→  Expenses List
```

- `AuthContext` — manages JWT lifecycle (load from SecureStore, sign in, sign out)
- `CategoriesContext` — fetches and syncs user categories from the API
- `api/expenses.js` — all HTTP calls, injects Bearer token from module-level `_token`

### Backend
Single `server/index.js` Express app with:
- `POST /auth/apple` — verifies Apple identity token, upserts user, returns JWT
- `GET/PUT /categories` — per-user category list stored as JSON on the User row
- `GET /expenses` — filterable by `from`, `to`, `category`, `recurring`, `upcoming`
- `GET /expenses/summary` — totals + breakdown by category for a date range
- `GET /expenses/latest-date` — returns the date of the user's most recent expense (used to cap calendar navigation)
- `POST /expenses` — create
- `PATCH /expenses/:id` — update (ownership verified)
- `DELETE /expenses/:id` — delete (ownership verified)

### Database schema (Prisma 5)
```prisma
model User {
  id         Int       @id @default(autoincrement())
  appleId    String    @unique
  email      String?
  categories String?           // JSON array of { label, emoji }
  createdAt  DateTime  @default(now())
  expenses   Expense[]
}

model Expense {
  id                 Int      @id @default(autoincrement())
  title              String
  category           String
  amount             Float
  date               DateTime
  createdAt          DateTime @default(now())
  isRecurring        Boolean  @default(false)
  recurringFreq      String?           // "weekly" | "monthly" | "yearly"
  recurringAutoAdd   Boolean  @default(false)
  userId             Int?
  user               User?    @relation(fields: [userId], references: [id])
}
```

---

## Current Features

### Authentication
- Sign in with Apple (supports both real email and Hide My Email relay)
- JWT stored in iOS Keychain via SecureStore (7-day expiry)
- Fresh install detection — reinstalling the app clears the token and prompts login again
- Info sheet on login screen explaining data privacy and what "Hide My Email" means

### Expense Management
- Add expenses with amount, title, category, and date
- Future-dated expenses supported — labelled "upcoming" in the list, excluded from period totals
- Edit any field of an existing expense (tap row to open edit modal)
- Delete expense from the edit modal (trash icon in header)
- Recurring expenses: weekly / biweekly / monthly / yearly / custom ("monthly on the Nth", stored as `monthly:N` in `recurringFreq`) — auto-added on due date by a daily server cron
- All expenses scoped to the authenticated user

### Home Screen Widget (iOS 17+)
- Small + medium WidgetKit widget showing Today and This Month totals, pure black
- Updates within ~1s of any expense change (app writes totals to the App Group, then reloads timelines)
- Privacy eye — interactive App Intent button masks amounts as `$••••` without opening the app
- Pre-scheduled midnight timeline entry resets "Today" without app involvement
- Swift source lives in `targets/widgets/`; data bridge in `modules/widget-sync`

### Summary Screen
- Today / This Week / Biweekly / This Month totals (date ranges computed in device local timezone)
- Week defined as Sun–Sat calendar week; Biweekly is a fixed Sun–Sat fortnight anchored to a constant epoch (not rolling)
- Expense count per range
- Breakdown by category with emoji — tap any row to drill into that category's expenses for the period
- Per-range budget setting with progress bar and over/under indicator — always visible even with no expenses
- Calendar modal — browse any month, tap a day to see transactions; forward navigation capped at latest expense month; monthly total displayed

### Expenses List Screen
- Full expense history
- Filter sheet — filter by date range (Today / Week / Month), category, recurring, and upcoming — combinable
- Filter button highlights when active
- Toggle between flat list and grouped-by-category view

### Categories
- Fully custom — no defaults, users build their own list
- Add with name + optional emoji, up to 30 characters
- Long press to enter delete mode (wiggle animation)
- Persisted server-side per user — survive reinstalls and device changes

### UI / UX
- Pure black aesthetic, dark mode enforced system-wide
- Safe area insets applied for all screen sizes (SE through Pro Max / Dynamic Island)
- Animated page indicator — real-time opacity during swipe, spring-animated width on release
- Tap outside any modal to dismiss it
- Date picker with confirm button — no accidental auto-selection
- Keyboard dismisses when tapping category pills or date picker
- Calendar grid fixed height — no layout jumping between months
- In-app changelog accessible via ⓘ icon on the Add screen

---

## In Progress

- Nothing actively in development at this moment — build 7 (v1.2.0) is ready to submit

---

## Known Issues / Bugs

- **Budget modal keyboard lag** — when tapping "Set budget", the modal slide animation and keyboard animation compete slightly. No clean fix exists in React Native without a fully custom bottom sheet; acceptable for now.
- **Expo Go vs TestFlight parity** — some system UI (alerts, keyboard style) behaves differently in Expo Go vs the real build. Largely resolved by setting `userInterfaceStyle: dark` in build 6, but worth watching.

---

## Beta Testing Status

| Build | Date | Version | Status |
|-------|------|---------|--------|
| 1–2 | 2026-05-19 | — | Internal only |
| 3 | 2026-05-19 | — | Internal only |
| 4 | 2026-05-20 | — | TestFlight — shared with testers |
| 5 | 2026-05-21 | — | TestFlight — auth + categories overhaul |
| 6 | 2026-05-22 | 1.1.0 | TestFlight — ~8 testers |
| 7 | 2026-05-28 | 1.2.0 | TestFlight |
| 8 | 2026-06-11 | 2.0.0 | Ready to submit — widget release |

**Tester count:** ~8  
**Distribution:** TestFlight internal testing  
**Apple Developer account:** Enrolled (Justin Lee, Team ID: Z2YR48CZU7)  
**App Store Connect App ID:** 6771302209  
**Bundle ID:** `com.justin.expensetracker`  
**EAS Project ID:** `ecfb8877-c04d-4fb1-80b0-8fba3d036443`

---

## Next Steps

### Short term (Build 9)
- Monitor build 8 with testers — collect feedback on the widget and new recurring options
- Consider a quick-add button on the widget (deep link into the Add screen)

### Medium term
- **Notifications** — optional daily reminder to log expenses
- **Export** — CSV or PDF of expenses for a date range
- **Multiple currencies** — currency selector per user
- **Search** — full-text search across expense titles

### Long term
- Public App Store release
- Begin planning Series Calendar (shared calendar app)
- Consider shared expenses / splitting (multi-user expense groups)
- Analytics dashboard — spending trends over time, month-over-month comparison
