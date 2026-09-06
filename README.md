# Better Expense

A mobile-first expense tracker that **gamifies saving**: XP, levels, streaks, a
growing pet, badges — and a real "guilt-free" reward budget backed by money you
actually set aside.

## What makes it different

- **Local-first, no accounts.** Everything lives in your browser's IndexedDB on
  the phone itself. There is no user database. Switching phones = export a
  backup, import it on the new device.
- **Save money → earn reward budget.** Set aside $100 toward a goal and 10% of it
  (configurable) becomes reward credit you're allowed to spend on anything,
  guilt-free — because it's backed by a real saving.
- **Optional Plaid bank sync.** Auto-import spending from a US bank. The server
  only proxies Plaid (its secret can't live in the browser); your `access_token`
  stays on your device.
- **Works offline.** Installable PWA with a hand-rolled service worker.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Bank sync is optional. To enable it, get free sandbox keys from the
[Plaid dashboard](https://dashboard.plaid.com/), copy `.env.example` to
`.env.local`, and fill in:

```
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
```

## Verify

```bash
npm run lint        # eslint
npm run smoke       # data layer + gamification + backup roundtrip (fake-indexeddb)
npm run build && npm run start   # production + offline shell checks
```

## Scripts

| script | purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js lifecycle |
| `npm run smoke` | all Node smoke tests against fake-indexeddb |
| `node scripts/gen-icons.mjs` | re-rasterize `assets/icon.svg` → `public/icons/*.png` |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Dexie/IndexedDB ·
Plaid SDK (server-side proxy only). No backend database, no auth.
