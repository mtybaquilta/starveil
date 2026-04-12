# StarVeil v2 — Design Spec

## Overview

StarVeil is a real-time space empire simulation browser game inspired by OGame. Players manage a planet, construct buildings, harvest resources, build fleets, and explore the galaxy over real wall-clock time.

**Current state (v1 as-built):** Single-player, one planet, 9 buildings (including Shipyard), 2-resource economy (metal + gas) with energy as throughput, 6 ship types, 4 mission types with combat resolution, weather system (Calm Skies only), event timeline. Supabase backend with Edge Functions for server-validated actions.

**v2 adds:** Galaxy map with fog of war, discovery loop (Radar Array + Probes), ship roster overhaul (9 ships), missions rework (spatial, 3 types), mission inbox, tech tree (4 branches), and active weather rotation.

## Tech Stack (Unchanged)

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Routing | React Router 7 |
| Testing | Vitest + Testing Library |

## Resources (Unchanged)

Three resources drive the economy:

| Resource | Color | Produced by | Role |
|----------|-------|-------------|------|
| Metal | Orange (#fb923c) | Metal Mine | Primary building material |
| Gas | Purple (#a78bfa) | Gas Refinery | Advanced material |
| Energy | Green (#4ade80) | Solar Array | Powers buildings (consumed, not stored) |

### Production Model

Resources are **computed on-read**, not ticked. Each planet stores `metal_amount`, `gas_amount`, and `last_calculated_at`. When the game loads or an action occurs:

```
elapsed_hours = (now - last_calculated_at) / 3600
current_metal = metal_amount + (metal_production_per_hour * elapsed_hours)
```

No background jobs for resource accrual. The math resolves instantly on any read.

### Energy Model

Each building consumes energy. If consumption exceeds production, all resource production is penalized proportionally:

```
energy_ratio = min(1, energy_produced / energy_consumed)
effective_production = base_production * energy_ratio
```

### Storage Caps

Metal and Gas have storage caps determined by their respective storage buildings. Resources stop accumulating at the cap. Energy is throughput, not stored.

## Buildings

Ten buildings for v2 (Radar Array added):

| Building | Function | Prerequisite | Produces/Provides |
|----------|----------|-------------|-------------------|
| Headquarters | Unlocks buildings, increases build slots | None | Build slots |
| Metal Mine | Produces metal | None | Metal/hr |
| Gas Refinery | Produces gas | HQ Lv. 2 | Gas/hr |
| Solar Array | Produces energy | None | Energy |
| Metal Storage | Increases metal storage cap | Metal Mine Lv. 2 | Metal cap |
| Gas Storage | Increases gas storage cap | Gas Refinery Lv. 2 | Gas cap |
| Weather Station | Controls weather forecast accuracy | HQ Lv. 2 | Forecast detail |
| Research Lab | Enables technology research | HQ Lv. 3 | Tech tree access |
| Shipyard | Builds ships, higher levels unlock ships + reduce build time | HQ Lv. 2 | Ship construction |
| **Radar Array** (new) | Passively detects coordinates on galaxy map | HQ Lv. 2 | Map detection range |

### Radar Array

Passively detects that *something* exists at coordinates within range:

- **Range:** Detects all positions within `level * N` systems of your home position (N to be balanced during implementation)
- **Level 1:** Your own system only (15 positions)
- **Higher levels:** Progressively further systems
- **Detection triggers on level-up:** When the Radar Array is built or upgraded, all newly in-range coordinates are marked as "detected"
- Detected coordinates appear as blips on the galaxy map — you know something is there but not what

### Weather Station Forecast Levels (Unchanged)

| Level | Forecast Capability |
|-------|-------------------|
| 0 (not built) | No forecast — weather changes without warning |
| 1–3 | "Weather changing soon" — knows something is coming, no details |
| 4–7 | Shows weather type and approximate timing |
| 8–12 | Shows exact type, timing, and duration |
| 13–17 | Shows exact effects (multiplier values) |
| 18–20 | Shows next 2–3 upcoming weather events |

### Construction Queue (Unchanged)

- One building upgrades at a time (queue depth = 1)
- Starting a build deducts resources immediately (server-validated)
- Client shows countdown timer from `completes_at`
- Completion validated server-side

### Formulas (Unchanged)

- **Production per hour:** `base_rate * level * 1.1^level`
- **Upgrade cost:** `base_cost * 1.6^level`
- **Build time (seconds):** `base_time * 1.5^level`
- **Energy consumption:** `base_energy * level * 1.1^level`
- **Storage capacity:** `base_capacity * 1.5^level`

## Galaxy Map

### Grid Structure

The galaxy uses the existing `galaxy:system:position` coordinate format:

- **Galaxy** — top level (1, 2, 3...). v2: everything is in galaxy 1.
- **System** — a cluster of positions (1–500). Each system contains 15 positions.
- **Position** — a slot within a system (1–15).

Players already have coordinates assigned at planet creation (e.g., `1:204:8`).

### Fog of War

Every coordinate starts as **unknown**. Three visibility states:

| State | How you get there | What you see |
|-------|-------------------|--------------|
| **Unknown** | Default | Nothing — fogged cell |
| **Detected** | Radar Array detects it | Blip icon — something is here, no details |
| **Revealed** | Probe sent to scan it | Full info: type, name, richness, danger level |

Your own position is always fully revealed. Revealed state is permanent.

### Map Content

Coordinates contain one of:

| Type | Description |
|------|-------------|
| Empty | Nothing here |
| Asteroid Field | Mineable for resources (richness varies) |
| Nebula | Gas-rich, boosts gas yield for mining missions |
| Debris Field | Salvageable for resources/parts |
| Bandit Camp | Hostile, raidable for loot |
| Unknown Anomaly | Random encounter — could be anything |

Content is **generated server-side when a coordinate is first probed**, not pre-generated. Each probe is genuine discovery.

### Location Lifecycle

Cleared or depleted locations (raided bandit camp, mined-out asteroid field) don't stay empty permanently. After a cooldown period, the location **respawns** with new content:

- When cleared: location is marked empty with a `respawns_at` timestamp
- After `respawns_at` passes: next probe or radar sweep generates fresh content
- What spawns is re-rolled — a cleared bandit camp might become an asteroid field

This keeps nearby space interesting and replayable rather than slowly emptying out.

### Map UI

Three zoom levels:

1. **Galaxy view** — all systems as cells. Mostly fog. Explored systems highlighted.
2. **System view** — 15 positions in a system. Each shows its visibility state.
3. **Position detail** — click a revealed position to see contents and available actions.

**Dev mode** toggle reveals the entire map with all details visible.

## Ship Roster

### Changes from v1

- **Removed:** Scout, Explorer (roles absorbed by Radar Array + Probes)
- **Added:** Cruiser, Gunship, Destroyer, Harvester, Small Cargo, Large Cargo
- **Removed:** Transport (split into Harvester + Cargo)
- **Probes reclassified:** consumable utility, not a fleet unit

### Full Roster

| Ship | Role | Tier | Notes |
|------|------|------|-------|
| **Probe** | Scanner | Utility | Disposable. Sent to detected coordinates to reveal them. Consumed on use. |
| **Small Fighter** | Light combat | Combat 1 | Cheap, fast, swarm unit |
| **Large Fighter** | Medium combat | Combat 2 | Tougher, hits harder |
| **Cruiser** | Mid capital ship | Combat 3 | Stats TBD during implementation |
| **Gunship** | Heavy firepower | Combat 4 | Stats TBD during implementation |
| **Destroyer** | Top-tier warship | Combat 5 | Stats TBD during implementation |
| **Harvester** | Resource extraction | Economic | Mines resources at a location. No cargo hold. |
| **Small Cargo** | Light transport | Economic | Low capacity, cheap. Early game hauler. |
| **Large Cargo** | Heavy transport | Economic | High capacity, expensive. Late game hauler. |

### Ship Unlock Requirements

Ships require both a **Shipyard level** and (for higher tiers) a **military tech research**:

- Probe, Small Fighter, Small Cargo: Shipyard level only
- Large Fighter, Harvester, Large Cargo: Shipyard level only (higher)
- Cruiser: Shipyard level + Capital Ship Engineering Lv. 1
- Gunship: Shipyard level + Capital Ship Engineering Lv. 3
- Destroyer: Shipyard level + Capital Ship Engineering Lv. 5

Exact Shipyard level requirements and ship stats (speed, attack, defense, cargo capacity, mining yield, cost, build time) to be balanced during implementation.

## Discovery Loop

The three-phase discovery flow:

```
Radar Array detects → Probe reveals → Fleet acts
```

### Phase 1: Detection (Passive)

The Radar Array building detects coordinates within range. Detected coordinates appear on the galaxy map as blips. Player knows *something* is there but not what.

### Phase 2: Scanning (Active, Cheap)

Player builds Probes at the Shipyard and sends them to detected coordinates. The probe is **consumed** — it travels to the target (short travel time based on distance), reports back, and is destroyed. The coordinate becomes fully revealed.

Scanning is not a "mission" — it's a lightweight action. No fleet assembly, no return trip. Send probe, it travels to the target (travel time based on distance, using the probe's speed stat), reveals the coordinate on arrival, and is destroyed. The reveal happens automatically — no "complete" action needed from the player.

### Phase 3: Missions (Active, Fleet-based)

Player sends fleet to revealed locations to take action. Only valid mission types are available based on location type.

## Missions

### Mission Types

| Mission | Required Ships | Valid Targets | Outcome |
|---------|---------------|---------------|---------|
| **Mining Run** | Harvester + Cargo (Small or Large) | Asteroid Field, Nebula | Extract resources. Yield = Harvester mining power × richness × duration. Cargo capacity limits haul. |
| **Raid** | Combat ships | Bandit Camp | Fight the camp's fleet. Victory = resource loot. Defeat = ship losses, retreat. |
| **Salvage** | Cargo (Small or Large) | Debris Field | Collect resources/parts. Low risk, moderate reward. |

### Fleet Composition

Fleet composition creates meaningful decisions:

- **Mining:** Requires both Harvesters (to extract) AND Cargo (to carry). More Harvesters = faster extraction. More Cargo = bigger haul. Balance matters.
- **Raiding:** Requires enough firepower to beat the camp. Under-sending means losses or defeat.
- **Escorts:** Combat ships can be attached to mining/salvage missions for protection at dangerous locations.
- **Speed:** Fleet travel speed is determined by the slowest ship. Mixing heavy ships with fast ones slows the whole fleet.

### Mission Flow

1. Player selects a revealed location on the galaxy map
2. Chooses mission type (only valid types shown for that location type)
3. Assembles fleet from available ships
4. Dispatches — fleet travels in real time (distance ÷ slowest ship speed)
5. Mission executes at destination
6. Fleet returns home (same travel time)
7. On arrival: resources deposited, ships returned to fleet, **report delivered to inbox**

## Mission Inbox

A dedicated page for detailed mission reports.

### Report Content by Type

**Mining Report:**
- Location name and coordinates
- Fleet composition sent
- Resources extracted (metal/gas breakdown)
- Cargo utilization (e.g., "4,200 / 5,000 capacity used")
- Trip duration (travel + mining time)

**Raid Report:**
- Location name and coordinates
- Your fleet vs enemy fleet composition
- Combat log (round-by-round: who fired, damage, ships destroyed)
- Outcome: victory or defeat
- Loot gained (if victory)
- Ships lost (both sides)

**Salvage Report:**
- Location name and coordinates
- Fleet composition sent
- Resources/materials recovered
- Trip duration

### Inbox UI

- List view, newest first
- Each entry: mission type icon, location name, outcome (success/failure), timestamp
- Unread indicator for new reports
- Click to expand full report detail
- **Cross-linked from event feed:** event timeline shows a one-liner like "Mining run at Keros Belt completed — [View Report]"

### Data Model

Reports are stored as structured JSON in the mission row's existing `result` field. The inbox is a **view over completed missions**, not a separate table.

## Tech Tree

### Structure

Four research branches:

| Branch | Focus | Example Techs |
|--------|-------|---------------|
| **Military** | Ship combat + unlocks | Reinforced Hulls, Advanced Weapons, Capital Ship Engineering, Destroyer Blueprints |
| **Economy** | Production + mining | Efficient Refining, Deep Core Mining, Expanded Storage, Rapid Extraction |
| **Exploration** | Radar + probe + map | Long Range Sensors, Probe Durability, Advanced Cartography |
| **Energy** | Power + weather resistance | Solar Efficiency, Storm Hardening, Fusion Theory |

### How Research Works

- **Research Lab required:** its level gates which tech tiers are available (e.g., tier 3 techs require Research Lab Lv. 6)
- **Dedicated queue:** independent from building and shipyard queues. Player can have all three progressing simultaneously.
- **One research at a time**
- **Costs metal + gas** — same economy, competes with buildings and ships for resources
- **Each tech has levels** (1–10 range), each level amplifies the bonus
- **Exponential scaling:** higher levels cost more and take longer (same pattern as buildings)

### Bonus Types

**Passive bonuses (per level):**
- Efficient Refining: +5% metal production per level
- Reinforced Hulls: +5% ship defense per level
- Solar Efficiency: +5% energy production per level
- Long Range Sensors: Radar Array range bonus per level

**Capability unlocks (at specific levels):**
- Capital Ship Engineering Lv. 1: unlocks Cruiser
- Capital Ship Engineering Lv. 3: unlocks Gunship
- Capital Ship Engineering Lv. 5: unlocks Destroyer
- Storm Hardening Lv. 3: reduces negative weather penalties by half

Exact tech names, levels, costs, times, and bonus values to be balanced during implementation.

### Tech Tree UI

- Dedicated page accessible from sidebar
- Four branches displayed as columns
- Each tech shows: name, current level, next level cost/time, and what it provides
- Locked techs show prerequisites (Research Lab level or prior tech)
- Active research shows progress bar and countdown

### Research Queue Data Model

New `research_queue` table (same pattern as `construction_queue`):
- `planet_id`, `tech_id`, `target_level`, `started_at`, `completes_at`

New `planet_technologies` table:
- `planet_id`, `tech_id`, `level` (current researched level)

## Active Weather System

### Weather Rotation

A server-side scheduled function rolls new weather per planet:

- Every **4–6 hours** (randomized per planet), current weather expires and a new type is rolled
- Calm periods (Calm Skies) can occur between weather events

### Weather Types

| Weather | Metal | Gas | Energy | Duration | Rarity |
|---------|-------|-----|--------|----------|--------|
| **Calm Skies** | 1.0x | 1.0x | 1.0x | — | Common |
| **Solar Flare** | 1.0x | 1.0x | 1.3x | 2–3 hrs | Common |
| **Metal Vein Discovered** | 1.25x | 1.0x | 1.0x | 3–4 hrs | Uncommon |
| **Gas Pocket** | 1.0x | 1.25x | 1.0x | 3–4 hrs | Uncommon |
| **Ion Storm** | 1.0x | 0.8x | 0.6x | 2–3 hrs | Uncommon |
| **Dust Storm** | 0.7x | 1.0x | 0.85x | 2–4 hrs | Rare |
| **Solar Storm** | 0.5x | 0.5x | 0.4x | 1–2 hrs | Very Rare |
| **Asteroid Shower** | 1.8x | 0.6x | 0.9x | 1 hr | Rare |
| **Nebula Drift** | 0.9x | 1.8x | 1.1x | 1 hr | Rare |

### Rarity Weights

| Tier | Chance per roll |
|------|----------------|
| Common (Calm Skies, Solar Flare) | ~53% |
| Uncommon (Metal Vein, Gas Pocket, Ion Storm) | ~30% |
| Rare (Dust Storm, Asteroid Shower, Nebula Drift) | ~12% |
| Very Rare (Solar Storm) | ~5% |

### Interaction with Tech Tree

The **Storm Hardening** tech from the Energy branch reduces negative weather penalties. E.g., at Storm Hardening Lv. 3, a 0.5x multiplier becomes 0.75x.

### Implementation

The existing `planet_weather` table already supports this — it has `weather_type`, multiplier columns, `started_at`, and `expires_at`. The scheduled function:

1. Queries planets where current weather has expired (or has no active weather)
2. Rolls a new weather type using the rarity weights
3. Inserts a new `planet_weather` row with appropriate multipliers and duration
4. Optionally inserts a `planet_events` entry ("A Solar Storm is approaching!")

## Event Timeline (Updated)

The existing event feed stays as a lightweight activity stream. v2 adds new event types:

- Weather change alerts
- Research started / completed
- Radar Array detection ("New signal detected at 1:205:3")
- Mission dispatched / returned
- Mission completion with inbox link ("Mining run at Keros Belt completed — [View Report]")

## UI Changes

### New Pages

- **Galaxy Map** — three zoom levels (galaxy → system → position detail)
- **Tech Tree** — four research branches with progress tracking
- **Inbox** — mission report list with expandable detail

### Sidebar Updates

- Add Galaxy Map nav item
- Add Tech Tree nav item
- Add Inbox nav item (with unread count badge)
- Show active research in sidebar (alongside construction and shipyard progress)

### Updated Pages

- **Shipyard** — updated for new ship roster (9 ships), remove Scout/Explorer
- **Fleet** — updated for new ship types
- **Missions** — reworked to launch from galaxy map locations rather than standalone page

## Database Schema Changes

### New Tables

**planet_technologies**
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `tech_id` (text)
- `level` (integer, default 0)
- `updated_at` (timestamptz)
- Unique on `(planet_id, tech_id)`

**research_queue**
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `tech_id` (text)
- `target_level` (integer)
- `started_at` (timestamptz)
- `completes_at` (timestamptz)

**galaxy_map** (stores revealed/detected coordinate state per player)
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `coordinates` (text, e.g., "1:205:3")
- `visibility` (text: 'detected' or 'revealed')
- `location_type` (text, nullable — set when revealed: 'asteroid_field', 'nebula', 'debris_field', 'bandit_camp', 'anomaly', 'empty')
- `name` (text, nullable — generated when revealed)
- `richness` (integer, nullable)
- `danger_level` (integer, nullable)
- `respawns_at` (timestamptz, nullable — set when location is cleared)
- `revealed_at` (timestamptz, nullable)
- `created_at` (timestamptz)
- Unique on `(planet_id, coordinates)`

### Modified Tables

**missions** — no schema change needed. The `result` JSON field already supports rich report data. Mission types change (mining, raid, salvage) but the columns remain the same.

**planet_ships** — new ship types added (cruiser, gunship, destroyer, harvester, small_cargo, large_cargo). Scout and explorer rows removed.

**ship_queue** — no schema change, just new valid ship types.

### Removed Tables

**nearby_sectors** — replaced by `galaxy_map`. The concept of expiring nearby sectors is superseded by the persistent fog-of-war map.

**known_locations** — merged into `galaxy_map`. Revealed coordinates serve the same purpose.

### RLS

All new tables follow the existing pattern: players can only read/write data for their own planets via `planet_id in (select id from planets where player_id = auth.uid())`.

## Server-Side Changes

### New Edge Function Actions

Added to the existing `game-action` Edge Function:

- **`send_probe`** — validate probe exists in fleet, consume it, calculate travel time, schedule reveal. On completion: generate location content, insert/update `galaxy_map` row, mark as revealed.
- **`start_research`** — validate Research Lab level, check tech prerequisites, deduct resources, create `research_queue` entry.
- **`complete_research`** — validate `completes_at` passed, increment tech level in `planet_technologies`, remove queue entry.

### Updated Actions

- **`dispatch_mission`** — updated to validate against `galaxy_map` (target must be revealed), new mission types, new fleet composition rules.
- **`resolve_mission`** — updated for mining (Harvester yield × richness, capped by Cargo capacity), raid, salvage outcomes. Sets `respawns_at` on cleared locations.
- **`start_ship_build` / `complete_ship_build`** — updated for new ship types and tech prerequisites.

### New Scheduled Function

**`weather-rotation`** — runs on a cron schedule (every 30 minutes or so):
1. Query planets where current weather has expired
2. Roll new weather type using rarity weights
3. Insert new `planet_weather` row
4. Insert weather change event

### Radar Array Detection

When a Radar Array is built or upgraded (handled in `complete_build`):
1. Calculate new detection range based on level
2. Find all coordinates in range that aren't already in `galaxy_map`
3. Insert them as `visibility: 'detected'`
4. Insert event: "New signals detected — check your galaxy map"

## Game Config Updates

### New Config Files

- `src/config/technologies.ts` — tech tree definitions (id, name, branch, max level, base cost, base research time, bonuses, prerequisites)
- `src/config/weather.ts` — weather type definitions (type, multipliers, duration range, rarity weight)

### Updated Config Files

- `src/config/ships.ts` — remove Scout/Explorer, add Cruiser/Gunship/Destroyer/Harvester/Small Cargo/Large Cargo
- `src/config/missions.ts` — update to Mining/Raid/Salvage, remove scout_patrol/expedition
- `src/config/buildings.ts` — add Radar Array
- `src/config/combat.ts` — update bandit fleets for new ship types

## Future Roadmap (Not in v2)

1. **v3 — Multiple Planets:** Colony ships, settling new planets, managing an empire across systems
2. **v4 — Multiplayer:** Shared universe, other players visible on galaxy map, alliances, PvP combat, messaging, rankings
3. **Additional mission types:** Patrol, trade routes, multi-stage campaigns
4. **Additional weather triggers:** Player actions influencing weather, expedition-triggered storms
