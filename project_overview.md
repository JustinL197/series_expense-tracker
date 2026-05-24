# Series Expense — Project Overview

Last updated: 2026-05-22 | Current build: 6

---

## App Name & Purpose

**Series Expense** is a minimalistic personal expense tracker for iPhone. It is the first app in the planned *Series* suite — a collection of clean, professional tools covering everyday productivity needs (expense tracking, shared calendar, to-do list, etc.).

The target user is someone who wants a fast, no-friction way to log and review personal spending without the clutter of full-featured finance apps. The aesthetic is pure black, typographically minimal, and built around a three-screen swipe workflow.

---

## Tech Stack

### Frontend
- **React Native** (Expo managed workflow)
- **expo-apple-authentication** — Sign in with Apple
- **expo-secure-store** — JWT token storage
- **@react-native-async-storage/async-storage** — install-detection flag
- **@react-navigation/material-top-tabs** — swipe tab navigation
- **@react-native-community/datetimepicker** — date selection
- **react-native-safe-area-context** — dynamic insets for notch / Dynamic Island
- **react-native-gesture-handler** — gesture support base layer

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
- `GET /expenses` — filterable by `range` and `category`
- `GET /expenses/summary` — totals + breakdown by category for a date range
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
  id        Int      @id @default(autoincrement())
  title     String
  category  String
  amount    Float
  date      DateTime
  createdAt DateTime @default(now())
  userId    Int?
  user      User?    @relation(fields: [userId], references: [id])
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
- Edit any field of an existing expense (tap row to edit)
- Delete expenses (long press)
- All expenses scoped to the authenticated user

### Summary Screen
- Today / This Week / This Month totals
- Expense count per range
- Breakdown by category with emoji
- Per-range budget setting with progress bar and over/under indicator
- Calendar modal — browse any month, tap a day to see transactions

### Expenses List Screen
- Full expense history
- Filter sheet — filter by date range (Today / Week / Month) and category, combinable
- Filter button highlights when filters are active

### Categories
- Fully custom — no defaults, users build their own list
- Add with name + optional emoji
- Long press to enter delete mode (wiggle animation)
- Persisted server-side per user — survive reinstalls and device changes

### UI / UX
- Pure black aesthetic, dark mode enforced system-wide
- Safe area insets applied for all screen sizes (SE through Pro Max / Dynamic Island)
- Date picker with confirm button — no accidental auto-selection
- Keyboard dismisses when tapping category pills or date picker
- Calendar grid fixed height — no layout jumping between months

---

## In Progress

- Nothing actively in development at this moment — build 6 was just submitted

---

## Known Issues / Bugs

- **Friend's expense count discrepancy** — one beta tester reported 1 expense showing in the list when 3 were added. Root cause unconfirmed; suspected to be a first-launch timing issue before build 5's token race condition fix. Monitoring on build 6.
- **Expo Go vs TestFlight parity** — some system UI (alerts, keyboard style) behaves differently in Expo Go vs the real build. Largely resolved by setting `userInterfaceStyle: dark` in build 6, but worth watching.

---

## Beta Testing Status

| Build | Date | Status |
|-------|------|--------|
| 1–2 | 2026-05-19 | Internal only |
| 3 | 2026-05-19 | Internal only |
| 4 | 2026-05-20 | TestFlight — shared with testers |
| 5 | 2026-05-21 | TestFlight — auth + categories overhaul |
| 6 | 2026-05-22 | TestFlight — current, ~8 testers |

**Tester count:** ~8  
**Distribution:** TestFlight internal testing  
**Apple Developer account:** Enrolled (Justin Lee, Team ID: Z2YR48CZU7)  
**App Store Connect App ID:** 6771302209  
**Bundle ID:** `com.justin.expensetracker`  
**EAS Project ID:** `ecfb8877-c04d-4fb1-80b0-8fba3d036443`

---

## Next Steps

### Short term (Build 7)
- Monitor build 6 with testers — confirm expense count bug is resolved
- Collect feedback on filter sheet UX and category workflow

### Medium term
- **Notifications** — optional daily reminder to log expenses
- **Export** — CSV or PDF of expenses for a date range
- **Recurring expenses** — mark an expense as recurring (weekly / monthly)
- **Multiple currencies** — currency selector per user

### Long term
- Public App Store release
- Begin planning Series Calendar (shared calendar app)
- Consider shared expenses / splitting (multi-user expense groups)
- Analytics dashboard — spending trends over time, month-over-month comparison
