# Planetary Defenses (B1) — Design Spec

**Date:** 2026-04-18

## Overview

Convert the six existing defense structures from upgradable buildings into countable combat units. Defenses participate in combat alongside defender ships with their own stats, give attackers a real reason to invest in defenses, and are built through the shared shipyard queue.

## Model Change

**Before:** Six defense entries in `planet_buildings` with `level 1–20`, `defenseRating` unused in combat.

**After:** Defenses are countable units stored in a new `planet_defenses` table (mirroring `planet_ships`). Each "unit" has flat combat stats (no level upgrades, no research scaling for now).

## Data Model

New table `planet_defenses`:

| column | type |
|---|---|
| `planet_id` | uuid |
| `defense_type` | text |
| `count` | int |
| `updated_at` | timestamptz |

Primary key: `(planet_id, defense_type)`.

Migration:
1. For each existing defense-building row in `planet_buildings`, insert `planet_defenses` with `count = level`.
2. Delete defense-building rows from `planet_buildings`.
3. Remove the six defense entries from `BUILDINGS` in `supabase/functions/game-action/index.ts` and `src/config/buildings.ts`.

## Config — `src/config/defenses.ts` (new file)

Exports `DEFENSES` with six entries, each with `attack`, `defense`, `cost`, `baseBuildTimeSeconds`, `prerequisites`. Illustrative stats (exact values tuned in implementation):

| Type | Attack | Defense | Metal | Gas | Build time |
|---|---|---|---|---|---|
| perimeter_turret | 20 | 15 | 150 | 50 | 45s |
| sensor_jammer | 15 | 25 | 200 | 200 | 75s |
| missile_battery | 55 | 35 | 250 | 150 | 90s |
| ion_cannon | 90 | 50 | 400 | 250 | 120s |
| shield_generator | 0 | 120 | 500 | 350 | 150s |
| orbital_platform | 180 | 100 | 800 | 500 | 200s |

Edge function mirrors the config inline (same pattern as existing `SHIPS` / `SHIP_STATS`).

## Combat Integration

In `handleResolveAttack`:
1. After fetching defender ships, also fetch `planet_defenses`.
2. Merge defenses into the defender combat pool passed to `resolveCombat`. Each defense unit uses `hp = defense * 3` (same formula as ships).
3. `resolveCombat` treats defenses identically to ships — they fire, take damage, get destroyed.
4. After combat, subtract destroyed defense counts from `planet_defenses` (same pattern as ship losses).

Destroyed defenses do **not** contribute salvage. The existing salvage calculation iterates `SHIPS[type]?.cost` only, so defense types naturally fall through the `if (!cost) continue` guard.

## Build Pipeline

Existing `start_ship_build` action extended:
- Accepts `shipType` that may be either a ship or defense type.
- Dispatches to `SHIPS[type]` or `DEFENSES[type]` for validation (cost, build time, prerequisites).
- Uses same shared `ship_queue` table (5-slot cap still applies across both).
- On completion in `handleCompleteShipBuild`, writes to `planet_ships` if ship type, `planet_defenses` if defense type.

No new action endpoint. Existing clients break for no one.

## UI Changes

**BuildingsPage** gains a new "Defenses" section below the existing structures grid:
- Grid of six defense cards matching the visual style of ship cards.
- Each card shows: icon, name, description, cost, build time, current count on planet.
- Build button + quantity input, wired to existing `startShipBuild` hook (which now handles both).
- No "upgrade" action — count-based only.

Shipyard queue display already shows ship builds; needs a label tweak so queue items for defenses show "Building N perimeter_turret" etc. (Just uses the same queue row structure.)

Planet **OverviewPage** already shows defense buildings — update to show count-based defenses instead of leveled buildings.

## Scope and Non-goals

- No research scaling for defense stats (flat values for now). Deliberate — keep scope tight.
- No salvage from destroyed defenses.
- No damaged-building repair system; destroyed = gone, rebuild via queue.
- No new defense-specific techs.
- No changes to sensor jammer's descriptive "reduces accuracy" behavior — it gets balanced combat stats instead. Description stays as-is.

## Files Changed

- New: `supabase/migrations/NNN_planet_defenses.sql`
- New: `src/config/defenses.ts`
- Modify: `supabase/functions/game-action/index.ts` — combat integration, extended build pipeline, remove defenses from `BUILDINGS`
- Modify: `src/config/buildings.ts` — remove six defense entries
- Modify: `src/hooks/usePlanet.ts` — fetch `planet_defenses`
- Modify: `src/pages/BuildingsPage.tsx` — new defenses section
- Modify: `src/pages/OverviewPage.tsx` — display defense counts instead of levels
