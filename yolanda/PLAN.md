# YOLANDA — Anesthesia Shift · Plan

Portrait-first (9:16) browser time-management game. Three.js + TypeScript + Vite,
HTML/CSS overlay UI, Web Audio, localStorage saves.

Core fantasy: *"I need B, but B needs A. A takes time, so start A first — and
while it runs, go do C."*

## Architecture

```
src/
  main.ts                boot, wires everything, game loop
  core/
    types.ts             shared type definitions (tasks, items, stations, levels…)
    Game.ts              orchestrator: owns sim state, phases, input → actions
    TaskSystem.ts        data-driven task graph: prerequisites, items, processes
    ActionQueue.ts       tap-queued station visits (add / cancel / insert / clear)
    Inventory.ts         4-slot Prep Tray
    Scoring.ts           metric collection → 5 star categories + feedback
    Events.ts            tiny typed event bus
    Save.ts              localStorage persistence
  data/                  ALL content lives here (no level is one giant script)
    items.ts             hand items: cartridges, kits, packs
    stations.ts          station archetypes (look, footprint, interaction point)
    recipes.ts           prep machine recipes (SedaPrep, ScopeAir, AirReady…)
    caseTemplates.ts     procedure templates → base task graphs
    patientModifiers.ts  modifiers that patch the task graph (e.g. airway alert)
    staffRoles.ts        delegation roles and what each can do
    environments.ts      room layouts (station placement, walls, zones)
    levels.ts            level = template + modifiers + environment + events
  nav/
    NavGrid.ts           occupancy grid + 8-way A* + line-of-sight smoothing
  render/
    palette.ts           the ONE shared material library (cohesive look)
    models/characters.ts Yolanda/staff/patient models + procedural animation
    models/equipment.ts  stylized machines, beds, decor
    World.ts             scene, lights, room build, station meshes, nav grids
    CameraRig.ts         fixed 3/4 camera with modes: PREP / ROOM / ACTIVE
  ui/                    DOM overlay: top bar, tasks, timers, tray, queue,
                         prep close-up, case card, handoff, results, menu, debug
  audio/Audio.ts         synthesized SFX + light generative music
```

### Simulation model
* **Task** = `{id, name, stationId, phase, duration, process, prerequisites,
  requiredItems, producedItems, requiresYolanda, delegatable, safetyCritical,
  priority, unlocks, scoreCategory, optional}`.
* States: `locked → available → working → running(process) → ready → done`.
* Background processes tick independently → many simultaneous timers.
* Stations resolve *on arrival* which task to perform (state may have changed).
* Phases: `prep → active → recovery → done`. In `active`, Yolanda is confined to
  the Patient Zone; far stations require delegation.

### Camera modes
* **PREP close-up** – push in on the supply cart; tactile drawer/tray minigame.
* **ROOM routing** – pulled-back diorama; tap stations, Yolanda pathfinds.
* **ACTIVE care** – tighter framing on patient + workstation + zone ring.

## Milestones
1. ✅ Shell, camera, room, Yolanda, nav, stations, task engine, tray, timers.
2. ✅ Level 1 Routine Endoscopy end-to-end (prep → active → recovery → handoff → score).
3. ✅ Automated Playwright playtest (`scripts/playtest.mjs`, normal + `--lazy` bots,
   per-phase screenshots) — used after every change.
4. ✅ Level 2 Rapid Turnover: pre-op bay, bed moves, limited cart stock + restock,
   bay turnover, anesthesia-tech delegation with ETAs, multi-patient task list.
5. ✅ Level 3 Patient Modifier: assessment reveals Airway Alert → AirReady kit.
6. ⏭ Level 4 Operating Room: new `or` environment (bigger room, OR table, lights,
   airway cart), `generalAnesthesia` template with Closing phase, VitaDock/ThermaNest.
7. ⏭ Level 5 parallel processes (ThermaNest, transport request, deliveries).
8. ⏭ Level 6 ultrasound as shared equipment (delegation with ETA, already supported).
9. ⏭ Level 7 pediatric (anxious patient flag exists; caregiver NPC + comfort choices).
10. ⏭ Level 8 MRI: screening threshold zone that rejects items without `mriSafe`.
11. ⏭ Swap procedural props for licensed GLBs once asset hosts are reachable.

## Key assumptions
* Every case starts with the Prep close-up at the supply cart; Yolanda spawns there.
* Long-press a station = "do this next" (queue insert); floor tap = redirect.
* External asset sites (itch.io, Sketchfab, Poly Pizza, Kenney…) are blocked from
  the build environment, so all 3D models are procedural stylized geometry built
  from one shared palette. See `ASSET_MANIFEST.md`.
* Medications are fictional cartridges (CalmBlue, ComfortGold, NauseaGuard,
  RecoverGreen). No dosing, no technique, no algorithms.
* Real time is compressed: a whole case is ~4–6 minutes.
