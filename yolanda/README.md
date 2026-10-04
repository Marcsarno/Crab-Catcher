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
npm run build:single # share build → dist-single/index.html (+ python3 scripts/export-models-json.py <dir> for models)
npm run playtest     # headless bot plays Level 1 end to end (needs `npm run dev` running)
node scripts/playtest.mjs L2 --speed=4 --shots   # other levels, phase screenshots in shots/
node scripts/playtest.mjs L1 --lazy              # naive player, to check scoring spread
node scripts/playtest.mjs L1 --follow            # only follows the on-screen next-step hint
node scripts/playtest.mjs L2 --follow --timeline=2500   # screenshot every 2.5 s of real time (BOT_MS=500000 for longer runs)
node scripts/reach.mjs                           # every station reachable from every other, in every level
node scripts/cv.mjs out.png "?d=6"              # character preview (dev/charview.html); ?st=makeSedaPrep,makeScopeAir for machines
```

## How to play

- **Tap a station** to send Yolanda there. Tap several to plan a route (numbers
  appear on the station tags). **Tap a numbered station again** to take it off
  the route. **Long-press** a station to make it the very next stop. **Tap the
  floor** to redirect.
- The **task card** (bottom left) always shows the next good step and why. A
  bouncing yellow arrow marks that station. Turn hints off in Settings for a
  harder game.
- The **Prep Tray** holds 4 hand items. Fill it at the **Supplies** cart: one
  drawer at a time, tap an item to take it, tap a tray slot to put it back.
- Machines run on their own. Start them, walk away, and come back when they show **READY**.
  Start a hands-on task while a machine is running and you get a **Parallel!** callout; the
  task card shows how many machines are running, and the results screen counts your parallel moves.
- Monitors in the room are live: they stay on STANDBY until the leads are on, then show the
  patient's real heart rate and SpO₂ (and flash red when it dips).
- Once sedation begins, Yolanda stays in the **patient zone**. Answer alerts, document,
  and request the PACU bed early. In later cases, use **Team** to delegate.
- Finish with the patient handoff. You're scored on Safety, Anticipation, Efficiency,
  Patient Care and Team Flow, not on raw speed.

## Levels in this build

1. **Routine Endoscopy**: tutorial. Start slow machines first.
2. **Rapid Turnover**: two patients, low cart stock, restock, turn over the bay, pre-op
   bay, anesthesia tech delegation.
3. **Patient Modifier**: assessment reveals an airway alert. Build a Special Airway
   Kit at AirReady.

4. **Operating Room**: bigger case with induction, closing and emergence phases, a
   surgical team, and circulator delegation.

Levels 5–8 (parallel processes, ultrasound, pediatric, MRI) are designed in `PLAN.md`.

## Developer panel

Press <kbd>`</kbd>, or tap the clock 5× on a phone. From there you can pick a level,
restart, change time scale, inspect tasks, timers and dependencies, complete a task,
spawn items, and show the nav grid and paths. `window.__yolanda` exposes the app for scripts.

See `PLAN.md` for the architecture and `ASSET_MANIFEST.md` for asset notes.
