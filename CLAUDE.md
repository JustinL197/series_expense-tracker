# Expense Tracker v2 — Project Context

## Overview
A minimalistic personal expense tracker iPhone app. Pure black aesthetic, no clutter. Built by Justin (bootcamp grad, comfortable with JS/React/Node/SQL, first React Native project).

## Stack
- **Frontend**: React Native (Expo), `@react-navigation/material-top-tabs` for 3-screen swipe navigation
- **Backend**: Express + Prisma 5 (NOT v7 — v7 has breaking changes) + PostgreSQL
- **Deployment**: Railway (backend + DB). Frontend runs via Expo Go on iPhone during dev; TestFlight pending Apple Developer enrollment.
- **Local persistence**: AsyncStorage (categories, budgets — device only, not in DB)

## Project Structure
```
/expense-tracker-v2/
  App.js                          # Entry point, CategoriesProvider + Tab.Navigator (lazy: false)
  .env                            # EXPO_PUBLIC_API_URL=https://expense-tracker-production-dfea.up.railway.app
  src/
    api/expenses.js               # All API calls (BASE_URL from EXPO_PUBLIC_API_URL)
    constants/index.js            # COLORS, DEFAULT_CATEGORIES
    context/CategoriesContext.js  # AsyncStorage-backed categories shared across screens
    screens/
      SummaryScreen.js            # Today/This Week/This Month totals + budget + calendar link
      AddExpenseScreen.js         # Amount + title + category pills + date picker
      ExpenseListScreen.js        # Filterable list + inline edit + delete
    components/
      CalendarModal.js            # Monthly calendar grid, tap day to see transactions
  server/
    index.js                      # Express routes
    prisma/schema.prisma          # Prisma 5 schema
    package.json                  # Has "postinstall": "prisma generate" for Railway
    .env                          # DATABASE_URL (Railway internal), DATABASE_PUBLIC_URL (local migrations)
```

## Key Patterns
- `useFocusEffect(useCallback(() => { load(); }, [load]))` — data refresh on screen focus
- `activeFilterRef` (useRef) in ExpenseListScreen to avoid stale closure in filter+focus combo
- `lazy: false` on Tab.Navigator — pre-renders all screens to eliminate swipe flash
- Budget stored in AsyncStorage with keys `budget_day`, `budget_week`, `budget_month`
- Categories stored in AsyncStorage under key `'categories'`; all deletable, seeded from DEFAULT_CATEGORIES on first launch
- API error includes full URL for easy debugging: `throw new Error('Request failed: ${res.status} ${method} ${url}')`
- `CELL_SIZE = Math.floor((SCREEN_WIDTH - SHEET_PADDING * 2) / 7)` for pixel-perfect calendar grid

## Current DB Schema (Prisma 5)
```prisma
model Expense {
  id        Int      @id @default(autoincrement())
  title     String
  category  String
  amount    Float
  date      DateTime
  createdAt DateTime @default(now())
}
```

## What's Already Built
- All 3 screens fully functional (Summary, Add, List)
- Calendar modal with month caching and day-tap transaction list
- Per-range budgets (daily/weekly/monthly) with progress bar and over/under display
- Category management with custom add + long-press delete with wiggle animation
- Edit and delete expenses inline
- Full Railway deployment working

## Next Task: Auth
**Plan**: Sign in with Apple + JWT + per-user expense isolation

### What needs to change:
1. **DB**: Add `User` model, add `userId` foreign key to `Expense`
2. **Backend**: 
   - `POST /auth/apple` — verify Apple identity token, create/find user, return JWT
   - Middleware to verify JWT on all `/expenses` routes
   - All expense queries scoped to `req.userId`
3. **Frontend**:
   - `expo-apple-authentication` for the Sign in with Apple button
   - `AuthContext` — stores JWT in SecureStore, exposes `user`, `signIn`, `signOut`
   - Gate the 3-screen navigator behind auth (show login screen if no token)
   - Pass JWT as `Authorization: Bearer <token>` header in `api/expenses.js`

### Packages needed:
- Frontend: `expo-apple-authentication`, `expo-secure-store`
- Backend: `jsonwebtoken`, `apple-signin-auth` (or `jwks-rsa` + manual verification)

### Notes:
- Sign in with Apple requires Apple Developer account ($99/year — Justin enrolled, pending approval)
- Test on device (Expo Go), not simulator — Apple auth doesn't work on simulator
- Keep the JWT short-lived (e.g. 7d) for now; refresh tokens can come later
- User table only needs: `id`, `appleId`, `email` (nullable — Apple can hide it), `createdAt`
