# Starveil v1 — Design Spec

## Overview

Starveil is a real-time space empire simulation browser game inspired by OGame. Players start on a planet, construct buildings, harvest resources, and grow their empire over real wall-clock time.

**v1 scope:** Single-player, one planet, 8 buildings, 3-resource economy with real-time construction timers. No fleet, combat, or multiplayer yet — those come in later versions.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Hosting | TBD (Vercel/Netlify for frontend, Supabase cloud for backend) |

## Resources

Three resources drive the economy:

| Resource | Color | Produced by | Role |
|----------|-------|-------------|------|
| Metal | Orange (#fb923c) | Metal Mine | Primary building material |
| Gas | Purple (#a78bfa) | Gas Refinery | Advanced material |
| Energy | Green (#4ade80) | Solar Array | Powers buildings (consumed, not stored) |

### Production Model

Resources are **computed on-read**, not ticked or stored incrementally. Each planet stores `metal_amount`, `gas_amount`, and `last_calculated_at`. When the game loads or an action occurs:

```
elapsed_hours = (now - last_calculated_at) / 3600
current_metal = metal_amount + (metal_production_per_hour * elapsed_hours)
```

This means no background jobs, no cron, no game tick loop. The math resolves instantly on any read.

### Energy Model

Each building consumes energy. If total consumption exceeds total production, **all resource production is penalized proportionally**:

```
energy_ratio = min(1, energy_produced / energy_consumed)
effective_production = base_production * energy_ratio
```

This creates a natural balancing pressure — players must upgrade Solar Arrays alongside resource buildings.

### Storage Caps

Metal and Gas have storage caps determined by their respective storage buildings. Resources stop accumulating when the cap is reached. Energy has no cap — it's a throughput, not a stockpile.

## Buildings

Eight buildings for v1, all with levels (1–20) and exponential cost/time scaling:

| Building | Function | Prerequisite | Produces/Provides |
|----------|----------|-------------|-------------------|
| Headquarters | Unlocks buildings, increases build slots | None | Build slots |
| Metal Mine | Produces metal | None | Metal/hr |
| Gas Refinery | Produces gas | HQ Lv. 2 | Gas/hr |
| Solar Array | Produces energy | None | Energy capacity |
| Metal Storage | Increases metal storage cap | Metal Mine Lv. 2 | Metal cap |
| Gas Storage | Increases gas storage cap | Gas Refinery Lv. 2 | Gas cap |
| Weather Station | Improves weather forecast accuracy | HQ Lv. 2 | Forecast detail |
| Research Lab | Placeholder for future tech tree | HQ Lv. 3 | Nothing in v1 |

### Weather Station & Forecast Accuracy

The Weather Station building determines how much detail the player sees about upcoming and current weather:

| Level | Forecast Capability |
|-------|-------------------|
| 0 (not built) | No forecast — weather changes happen without warning |
| 1–3 | "Weather changing soon" — knows something is coming, no details |
| 4–7 | Shows weather type and approximate timing ("Solar Storm in ~3-5 hours") |
| 8–12 | Shows exact type, timing, and duration |
| 13–17 | Shows exact effects (multiplier values) |
| 18–20 | Shows next 2-3 upcoming weather events |

In v1 (where weather is always "Calm Skies"), the Weather Station still functions — it just always forecasts calm weather. The UI, building progression, and forecast system are all in place for when real weather types are activated in v2.

### Formulas

All formulas use the building's level as input:

- **Production per hour:** `base_rate * level * 1.1^level`
- **Upgrade cost:** `base_metal_cost * 1.6^level` (and same formula for gas cost with different base)
- **Build time (seconds):** `base_time * 1.5^level`
- **Energy consumption:** `base_energy * level * 1.1^level`
- **Storage capacity:** `base_capacity * 1.5^level`

Base values per building are defined in a shared game config file (not hardcoded), making balancing easy and extensible.

### Construction Queue

- One building upgrades at a time (queue depth = 1)
- Starting a build deducts resources immediately (server-validated)
- Build stores `building_id`, `target_level`, `started_at`, `completes_at`
- Client shows a countdown timer computed from `completes_at`
- Completion is validated server-side: on next action or page load, if `now >= completes_at`, the upgrade is applied

### Level Progression View

Each building has an expandable "Level Progression" table showing all 20 levels with costs, production, energy use, and build time. Collapsed by default. Current level highlighted in blue, next level in green, level 20 in gold as the aspirational target.

## Event Timeline

An always-visible event feed displayed below the planet info in the main panel. Shows a chronological list of game events with timestamps.

**v1 events:**
- Building upgrade started
- Building upgrade completed
- Resource storage full warning

**Future events (not in v1):**
- Fleet departure / arrival
- Weather changes
- Bandit raid warnings
- Expedition results

Events are stored in a `planet_events` table and displayed as a compact scrollable list. Each event has a type, message, timestamp, and optional icon. The timeline is a foundational system that grows with every feature we add.

## Planetary Weather

Each planet has an active weather condition that can modify production rates. The weather system is built in v1 but ships with only one weather type — **Calm Skies** (no effect, 1.0x multiplier on all resources).

**Data model:**
- `planet_weather` table: `planet_id`, `weather_type`, `started_at`, `expires_at`, `metal_multiplier`, `gas_multiplier`, `energy_multiplier`
- Production formulas incorporate the active weather multiplier
- When no active weather or weather has expired, defaults to Calm Skies (1.0x)

**Future weather types (v2+):**
- Solar Storm: energy × 1.3 for 2 hours
- Metal Vein Discovered: metal × 1.2 for 4 hours
- Gas Leak: gas × 0.85 for 1 hour
- Ion Storm: energy × 0.7 for 3 hours
- Asteroid Field: metal × 1.5 for 1 hour (rare)

Weather is displayed prominently on the planet overview and in the top resource bar. The UI slot is present from v1 even though it always shows "Calm Skies".

## UI Design

### Visual Direction

**Clean Slate** — minimal dark theme (Slate color palette from Tailwind), generous spacing, big typography. Space atmosphere comes from the color palette and planet visuals, not heavy UI chrome. Resource-specific accent colors throughout.

### Layout

Three-zone layout:

1. **Top resource bar** — Always visible. Shows Metal, Gas, Energy with current amounts and production rates. Planet name and coordinates on the right.

2. **Left sidebar** — Navigation menu (Overview, Buildings, Resources) + active construction queue with progress bar and countdown. Future pages (Shipyard, Fleet, Galaxy Map) shown locked with prerequisite hints.

3. **Main panel** — Context-dependent content area. Changes based on current page.

### Pages

**Overview (default)**
- Planet name, type, diameter, used/available build slots
- Current weather condition display (always "Calm Skies" in v1)
- Planet visual (CSS gradient sphere for now, proper art later)
- Event timeline — scrollable feed of recent events (build completions, warnings)
- Building grid showing all buildings as cards with level and key stat
- Locked buildings shown with dashed borders and prerequisite text

**Buildings**
- List/grid of all buildings with current level, production, and upgrade cost
- Click a building → building detail view

**Building Detail**
- Large building image (placeholder initially, generated art later)
- Description text
- Current level stats vs next level stats (production, energy use)
- Upgrade cost breakdown with live affordability indicators (green check / red X)
- Build time display
- Upgrade button (disabled if can't afford or queue is full)
- "Unlocks" section showing what other buildings this one gates
- Expandable level progression table (all 20 levels)

**Resources**
- Production breakdown per resource (which buildings contribute how much)
- Energy balance overview (produced vs consumed, surplus/deficit)
- Storage capacity and current fill percentage

### Building Images

Every building will have a proper game art image. The system is designed with image slots from the start — v1 uses placeholder icons, with generated art added as a follow-up step. Images are referenced by building ID, making them trivially swappable.

## Database Schema (Supabase/Postgres)

### Tables

**players**
- `id` (uuid, PK, references auth.users)
- `username` (text, unique)
- `created_at` (timestamptz)

**planets**
- `id` (uuid, PK)
- `player_id` (uuid, FK → players)
- `name` (text)
- `coordinates` (text, e.g., "1:204:8")
- `diameter` (integer)
- `max_building_slots` (integer, default 12)
- `metal_amount` (numeric, current stored metal)
- `gas_amount` (numeric, current stored gas)
- `last_calculated_at` (timestamptz)
- `created_at` (timestamptz)

**planet_buildings**
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `building_id` (text, references game config)
- `level` (integer, default 0)
- `updated_at` (timestamptz)

**construction_queue**
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `building_id` (text)
- `target_level` (integer)
- `started_at` (timestamptz)
- `completes_at` (timestamptz)

**planet_events**
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `event_type` (text, e.g., 'build_started', 'build_completed', 'storage_full')
- `message` (text)
- `metadata` (jsonb, optional — building_id, level, etc.)
- `created_at` (timestamptz)

**planet_weather**
- `id` (uuid, PK)
- `planet_id` (uuid, FK → planets)
- `weather_type` (text, default 'calm_skies')
- `metal_multiplier` (numeric, default 1.0)
- `gas_multiplier` (numeric, default 1.0)
- `energy_multiplier` (numeric, default 1.0)
- `started_at` (timestamptz)
- `expires_at` (timestamptz, nullable — null means permanent)

### Row Level Security

All tables use RLS. Players can only read/write data for their own planets:
- `players`: user can read/update own row
- `planets`: user can read/update where `player_id = auth.uid()`
- `planet_buildings`: user can read/update via planet ownership
- `construction_queue`: user can read/insert/delete via planet ownership
- `planet_events`: user can read via planet ownership (insert via server functions only)
- `planet_weather`: user can read via planet ownership (managed by server)

### Server-side Validation

Supabase Edge Functions (or Postgres functions) handle:
- **Start build:** Verify resources are sufficient (compute-on-read at that moment), deduct resources, create queue entry
- **Complete build:** Verify `completes_at` has passed, increment building level, remove queue entry
- **Resource calculation:** Recalculate and persist `metal_amount`, `gas_amount`, `last_calculated_at` on any mutation

## Game Config

Building definitions, base costs, formulas, and prerequisites live in a shared TypeScript config file used by both frontend and server logic. Structure:

```typescript
type BuildingConfig = {
  id: string
  name: string
  description: string
  category: 'resource' | 'storage' | 'infrastructure'
  maxLevel: number
  baseCost: { metal: number; gas: number }
  baseProductionPerHour: number  // 0 for non-producers
  baseEnergyConsumption: number
  baseBuildTimeSeconds: number
  prerequisites: { buildingId: string; level: number }[]
  image: string  // path to building image asset
}
```

## Future Roadmap (Not in v1, but architecture supports)

1. **v2 — Shipyard & Fleet:** Ship building from Shipyard (same queue pattern as buildings). 6-7 ship types with different roles. Ships stored per-planet.
2. **v3 — Expeditions:** Send fleet to explore, real-time travel duration, risk/reward outcome resolution on return. Rewards: resources, rare materials, blueprint fragments.
3. **v4 — Multiple Planets:** Colony ships enable settling new planets. Each planet has independent buildings/resources. Player manages an empire across planets.
4. **v5 — Multiplayer:** Shared universe, other players, alliances, rankings, messaging, PvP combat.

The per-planet data model, shared game config, and compute-on-read resource system all extend naturally to these features without architectural changes.
