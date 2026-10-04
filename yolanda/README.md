# YOLANDA — Anesthesia Shift

A portrait, mobile-first browser time-management game. You play Yolanda, a CRNA who
is great at her job because she is always a few steps ahead: start the slow machine
first, do quick tasks while it runs, and have everything ready when it's needed.

**A game, not medical training.** Real anesthesia workflow decides *why* a task
exists. Medications (CalmBlue, ComfortGold, NauseaGuard, RecoverGreen) and machines
(SedaPrep, ScopeAir, AirReady) are fictional. There is no dosing or technique.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 — use a phone or a portrait devtools viewport
npm run build        # typecheck + production build → dist/
npm run build:single # one self-contained HTML file → dist-single/index.html
npm run playtest     # headless bot plays Level 1 end to end (needs `npm run dev` running)
node scripts/playtest.mjs L2 --speed=4 --shots   # other levels, phase screenshots in shots/
node scripts/playtest.mjs L1 --lazy              # naive player, to check scoring spread
```

## How to play

- **Tap a station** to send Yolanda there. Tap several to queue a route.
  **Long-press** a station to make it the very next stop. **Tap the floor** to redirect.
  Tap a route chip to cancel it.
- The **Prep Tray** holds 4 hand items. Fill it at the **Supplies** cart (prep close-up).
- Machines run on their own. Start them, walk away, and come back when they show **READY**.
- Once sedation begins, Yolanda stays in the **Patient Zone**. Answer alerts, document,
  and request the PACU bed early. In later cases, use **Team** to delegate.
- Finish with the patient handoff. You're scored on Safety, Anticipation, Efficiency,
  Patient Care and Team Flow, not on raw speed.

## Levels in this build

1. **Routine Endoscopy**: tutorial. Start slow machines first.
2. **Rapid Turnover**: two patients, low cart stock, restock, turn over the bay, pre-op
   bay, anesthesia tech delegation.
3. **Patient Modifier**: assessment reveals an airway alert. Build a Special Airway
   Kit at AirReady.

Levels 4–8 (OR, parallel processes, ultrasound, pediatric, MRI) are designed in
`PLAN.md`. The data model is built to support them.

## Developer panel

Press <kbd>`</kbd>, or tap the clock 5× on a phone. From there you can pick a level,
restart, change time scale, inspect tasks, timers and dependencies, complete a task,
spawn items, and show the nav grid and paths. `window.__yolanda` exposes the app for scripts.

See `PLAN.md` for the architecture and `ASSET_MANIFEST.md` for asset notes.
