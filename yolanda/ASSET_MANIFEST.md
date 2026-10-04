# Asset Manifest

## Summary

Every 3D model, texture, icon and sound in this build is **original and generated at
runtime by this project's own code**. No third-party asset files are included, so no
attribution is currently required (see `ATTRIBUTIONS.md`).

## Sourcing attempt (and why everything is procedural for now)

The brief asked to search licensed asset libraries before modeling common objects.
From the build environment, the network policy **refused connections** to:

| Site | Purpose | Result |
|---|---|---|
| itch.io | low-poly hospital packs | blocked (proxy `connect_rejected`) |
| poly.pizza | CC0/CC-BY hospital props, characters | blocked |
| sketchfab.com | hero equipment (anesthesia machine, MRI…) | blocked |
| kenney.nl, quaternius.com | CC0 furniture/characters | blocked |
| cdn.jsdelivr.net | CDN mirrors | blocked |

Only the npm registry and GitHub were reachable; neither hosts a suitable licensed
hospital set. Rather than block gameplay (brief §44), every object was built as a
stylized procedural model from **one shared material/geometry library**
(`src/render/palette.ts`), which also satisfies the "one cohesive asset library"
rule (brief §21) by construction.

**To swap in licensed GLBs later:** allow those hosts in the cloud environment's
network settings (or drop files into `public/models/`), load with `GLTFLoader`, and
re-material each mesh with `mat()` from `palette.ts` so it matches the palette. Add
one row per file below.

## Planned external packs (waiting on downloads)

These were chosen for the next art pass. None are in the build yet because the
environment cannot reach their hosts. Licenses will be confirmed from each download.

| Pack | Use | Expected license |
|---|---|---|
| Atomic Realm Hospital Assets (free tier) | beds, machines, cupboards, lights, walls | check free-tier terms |
| Madduck Modular Hospital Environment | room shell, modular walls/props | free/name-your-price, commercial + modification allowed |
| GRADD Hospital Room (Poly Pizza) | filler props | CC BY (credit required) |
| Quaternius Ultimate House Interior | desks, chairs, shelves, plants, lights | CC0 |
| Quaternius Modular Women (+ men/medics) | Yolanda, staff, patients, animations | CC0 |
| SideQuest Sci-Fi Lab & Medical Props | base geometry for SedaPrep / ScopeAir / AirReady | CC0 |

Import plan: convert to GLB, re-material every mesh with `mat()` from
`src/render/palette.ts`, and keep station footprints from `src/data/stations.ts`
so gameplay and navigation don't change.

## Procedural assets in use

| Asset | Built in | Approx. tris | Used in |
|---|---|---|---|
| Yolanda (CRNA, teal scrubs, ponytail, badge) | `render/models/characters.ts` `makeHuman` | ~6k | all levels |
| Proceduralist / PACU nurse / anesthesia tech | `makeHuman` with different looks | ~6k each | all levels |
| Lying patient (expressions, blanket, monitor leads) | `makeLyingPatient` | ~4k | all levels |
| Chart desk + monitor + chair | `render/models/equipment.ts` `makeChartDesk` | ~3k | all |
| SedaPrep (fictional med-prep machine) | `makeSedaPrep` | ~3k | all |
| ScopeAir (fictional breathing-kit stager) | `makeScopeAir` | ~3k | all |
| Supply cart with animated drawers | `makeSupplies` | ~3k | all |
| Anesthesia workstation (monitor, canisters, bag, circuit, suction) | `makeWorkstation` | ~5k | all |
| Hospital bed + IV pole + vitals monitor + curtain | `makeBed` | ~5k | all |
| Handoff / PACU counter | `makeHandoff` | ~2k | all |
| AirReady (fictional airway-kit builder) | `makeAirReady` | ~2k | L3 |
| Plant, bench, sink, door, window, posters, signage | `equipment.ts`, `World.ts` | small | decor |
| Floor tiles, signs, screens | runtime canvas textures (`palette.ts`) | — | all |
| UI icons | inline SVG (`ui/icons.ts`) | — | HUD |
| SFX + music + ambience | Web Audio synthesis (`audio/Audio.ts`) | — | all |

Fonts: Nunito via Google Fonts (SIL Open Font License), with system-font fallback.
