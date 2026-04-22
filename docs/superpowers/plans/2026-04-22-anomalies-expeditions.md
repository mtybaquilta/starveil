# Anomalies / Expeditions — Implementation Plan

**Goal:** Add discoverable galaxy-map anomalies that resolve into one-shot PvE expeditions with RNG rewards.

**Architecture:** Reuse `galaxy_map` (new `location_type = 'anomaly'`) and `missions` (new `mission_type = 'expedition'`). No new tables. A dev-mode spawn action inserts an anomaly row; dispatching a fleet races to claim it; on arrival, `handleResolveMission` rolls a weighted reward table defined in `src/config/anomalies.ts`, grants loot, deletes the map row, and writes a `planet_events` entry.

**Tech Stack:** Supabase (Postgres + Deno edge), React + TS client.

---

## Scope

- **v1 anomaly types (5):** `resource_cache`, `derelict_probe`, `signal_ghost`, `ambush`, `void_echo`.
- **Dev-triggered spawn** via new button on GalaxyMapPage (IS_DEV_MODE gated).
- **Race-to-claim:** first fleet to arrive resolves it; later arrivals find it gone and return with no reward.
- **No new tables.** Galaxy map row + metadata only.
- **No alerts / no auto-spawn / no mini-combat UI deep-dive** in v1. `ambush` just rolls a ship-loss % against the incoming fleet numerically.

---

## File Structure

**New:**
- `src/config/anomalies.ts` — anomaly definitions + reward tables.
- `supabase/functions/game-action/anomalies.ts` — mirrored Deno helper with roll logic.

**Modified:**
- `supabase/functions/game-action/index.ts` — add `handleSpawnAnomaly`, add `expedition` branch in `handleResolveMission`, handle expedition dispatch in mission create path.
- `src/pages/GalaxyMapPage.tsx` — anomaly marker, detail panel, dispatch button, dev spawn button.
- `src/hooks/useGalaxyMap.ts` (or equivalent fetcher) — surface anomaly rows.

---

## Task 1 — Anomaly config

**Files:** Create `src/config/anomalies.ts`, `supabase/functions/game-action/anomalies.ts`.

- [ ] **Step 1:** Define shared shape:

```typescript
export type AnomalyType =
  | 'resource_cache' | 'derelict_probe' | 'signal_ghost' | 'ambush' | 'void_echo'

export type AnomalyConfig = {
  id: AnomalyType
  name: string
  flavor: string              // short description
  icon: string                // emoji for map/panel
  minFleetPower?: number      // soft recommendation shown in UI
  // reward ranges; roll picks uniformly within range
  rewards: {
    metal?: [number, number]
    gas?: [number, number]
    research?: [number, number]       // research points, future hookup ok to stub
    shipLossPct?: [number, number]    // 0..1; applied to each ship type in fleet
  }
  flavorOutcomes: string[]    // 1–3 post-resolve messages, one picked randomly
}
```

- [ ] **Step 2:** Populate 5 entries (tune later):
  - `resource_cache`: metal [1500,4000], gas [500,1500]. Flavor "A silent drifting hauler, holds rusted out."
  - `derelict_probe`: research [20,60], small gas [0,300]. "Alien telemetry; decoded into tech fragments."
  - `signal_ghost`: metal [200,600]. "A false echo, small scrap recovered."
  - `ambush`: shipLossPct [0.05,0.15], metal [2000,5000], gas [1000,3000]. "Pirate ambush — losses, but spoils."
  - `void_echo`: metal [0,8000], gas [0,8000], shipLossPct [0,0.2]. "High variance — great or grim."
- [ ] **Step 3:** Create Deno mirror at `supabase/functions/game-action/anomalies.ts` with the same config + a `rollAnomalyReward(type, fleet)` helper returning `{ metal, gas, research, shipsLost: Record<shipType, number>, flavor }`.
- [ ] **Step 4:** Commit.

---

## Task 2 — Spawn action (dev)

**Files:** Modify `supabase/functions/game-action/index.ts`.

- [ ] **Step 1:** Add action handler `handleSpawnAnomaly(userId, devMode, anomalyType?)`:
  - Require `devMode === true` (reject otherwise).
  - Pick random unused coordinates in same galaxy.
  - Insert `galaxy_map` row: `location_type = 'anomaly'`, `metadata = { anomaly_type, spawned_at }`.
  - If no `anomalyType` passed, pick one at random from the config.
- [ ] **Step 2:** Wire into the action dispatcher (mirror `spawn_world_boss` branch).
- [ ] **Step 3:** Deploy: `npx supabase functions deploy game-action --project-ref mefooreiuuozafggjlmy --no-verify-jwt`.
- [ ] **Step 4:** Commit.

---

## Task 3 — Expedition dispatch + resolve

**Files:** Modify `supabase/functions/game-action/index.ts`.

- [ ] **Step 1:** In the mission-dispatch path, accept `mission_type = 'expedition'`. Validate target is an anomaly row in `galaxy_map`. Same travel-time calc as other missions.
- [ ] **Step 2:** In `handleResolveMission`, add branch for `expedition`:
  1. `SELECT ... FOR UPDATE` the `galaxy_map` row by coordinates where `location_type = 'anomaly'`.
  2. If row is missing: mission returns with zero rewards + `planet_events` message "Anomaly already claimed — fleet returns empty-handed."
  3. If present: call `rollAnomalyReward(type, fleet)`, apply ship losses to returning fleet, credit metal/gas, write `planet_events` entry with flavor + rewards, then DELETE the galaxy_map row.
- [ ] **Step 3:** Deploy edge function.
- [ ] **Step 4:** Commit.

---

## Task 4 — Galaxy map UI

**Files:** Modify `src/pages/GalaxyMapPage.tsx` and galaxy-map fetching hook.

- [ ] **Step 1:** Surface `location_type = 'anomaly'` rows through the galaxy-map query (should already include since it's `select *` — verify).
- [ ] **Step 2:** Add an anomaly marker style (use the config's `icon`, cyan/teal accent distinct from bosses' magenta/red).
- [ ] **Step 3:** Detail panel: show name, flavor, icon, recommended fleet note, and a "Launch Expedition" button that dispatches a mission with `mission_type = 'expedition'`.
- [ ] **Step 4:** Dev-mode: add "Spawn Anomaly" button (mirror Herald Apex Boss pattern) calling `spawn_anomaly` action.
- [ ] **Step 5:** Verify `npm run build`.
- [ ] **Step 6:** Commit.

---

## Task 5 — Manual verification

- [ ] Spawn anomaly via dev button → appears on galaxy map.
- [ ] Dispatch fleet → mission shows `expedition` type in QueueStrip/Missions.
- [ ] On arrival: reward credited, flavor event logged, map row removed.
- [ ] Spawn a second anomaly, race two fleets (small delay): second returns empty.
- [ ] Ambush type: confirm ship losses applied on return.

---

## Task 6 — Merge

- [ ] Push branch, merge to main, update `docs/backlog.md` (anomalies → shipped).
