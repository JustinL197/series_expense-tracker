# Dev Workflow Cheat Sheet

Since the widget (v2.0.0), this app has custom native code — **Expo Go doesn't
work anymore**. The dev build (the "Series Expense" app installed from Xcode)
replaces it: same live-reload workflow, but it runs our native code.

## ⚠️ Dev build vs TestFlight — only ONE can be installed

Both use the same bundle ID, so installing one **overwrites** the other:

- Installed from **TestFlight** → standalone app. No Metro, no live reload.
  `npx expo start` will do nothing for it.
- Installed via **`expo run:ios`** → dev client. Needs Metro; live reload works.

If "testing isn't working," check which one is on the phone. Swap to dev:
`expo run:ios` (below). Swap back to standalone: install from TestFlight.
Data is safe either way — it lives on the server.

## Day-to-day (JS changes only — most of the time)

```bash
npx expo start
```

Then open the **Series Expense** app on the phone:
- It usually finds the server automatically (same Wi-Fi required)
- If it shows "No development servers found": tap **Enter URL manually** and
  type `http://<MAC-IP>:8081`
- Get the Mac's current IP with: `ipconfig getifaddr en0`
- Wi-Fi flaky / different network? Use `npx expo start --tunnel` instead

JS edits hot-reload. Shake the phone → **Reload** to force a fresh load.

## When native code changes (new package with native module, widget Swift, app.json plugins)

```bash
LANG=en_US.UTF-8 npx expo run:ios --device "Justin's iPhone"
```

- Rebuilds the app, installs it on the phone, and starts Metro — all in one
- Phone must be plugged in (or paired on the same Wi-Fi) and unlocked
- `LANG=...` prevents a CocoaPods Unicode crash — or add
  `export LANG=en_US.UTF-8` to `~/.zprofile` once and forget it
- First build is slow; cached rebuilds take a couple of minutes

## Which one do I need?

| You changed… | Command |
|---|---|
| Anything in `src/`, `App.js` | `npx expo start` + reload app |
| `targets/widgets/*.swift` | `expo run:ios` (rebuild) |
| Installed a new Expo/native package | `expo run:ios` (rebuild) |
| `app.json` plugins/entitlements | `expo run:ios` (rebuild) |
| Server (`server/`) | `git push` (Railway auto-deploys) |

## Getting the real app back

The dev build replaces the TestFlight app (same bundle ID). To return to the
standalone app: install from **TestFlight**. To ship a new version:

```bash
eas build --platform ios --auto-submit
```

(Reminder: EAS builds from your **committed** files — commit first.)
