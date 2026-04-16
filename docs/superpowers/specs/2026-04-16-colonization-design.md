# Colonization System

## Context

Players need to expand beyond their starting planet. The colonization system adds a major progression milestone: discover habitable planets via probes, build a colony ship, colonize, and manage multiple planets independently. This also lays groundwork for multiplayer (colonization races for limited planets).

---

## Core Mechanics

### Colony Ship

New ship type in `src/config/ships.ts` and edge function `SHIPS` config:

| Field | Value |
|---|---|
| id | `colony_ship` |
| name | Colony Ship |
| description | A massive vessel carrying everything needed to establish a new colony. Consumed on arrival. |
| cost | 20,000 metal, 15,000 gas |
| baseBuildTimeSeconds | 7200 (2 hours) |
| speed | 3 |
| cargoCapacity | 0 |
| attackPower | 0 |
| defenseRating | 50 |
| miningYield | 0 |
| requiredShipyardLevel | 8 |
| requiredTech | `colonization_theory` Lv.1 |

**Consumed on use** — same pattern as probes.

### New Technology: Colonization Theory

Added to exploration branch in `src/config/technologies.ts`:

| Field | Value |
|---|---|
| id | `colonization_theory` |
| name | Colonization Theory |
| branch | exploration |
| maxLevel | 3 |
| baseCost | 5,000 metal, 4,000 gas |
| baseTimeSeconds | 1800 |
| requiredLabLevel | 6 |
| prerequisites | Advanced Cartography Lv.3 |
| bonuses | Lv.1: Unlocks Colony Ship. Lv.2: +20% colony starting resources. Lv.3: Colony starts with HQ Lv.2 |

---

## Habitable Planet Discovery

### Fixed Hidden Planets

Habitable planets exist at **pre-determined coordinates** in the galaxy. They are not RNG-rolled — they're seeded into a new table and discovered when a probe scans their coordinate.

### Database

```sql
galaxy_planets (
  id uuid PK DEFAULT gen_random_uuid(),
  coordinates text UNIQUE NOT NULL,
  name text NOT NULL,
  diameter integer NOT NULL DEFAULT 12400,
  max_building_slots integer NOT NULL DEFAULT 12,
  claimed_by uuid FK → players NULL,
  claimed_at timestamptz NULL
)
```

No RLS needed — this table is only accessed by edge functions.

### Seeding

A migration seeds ~50-100 habitable planets across the galaxy at varied coordinates. Density is low enough that finding one feels like a meaningful discovery.

### Probe Integration

Modify `send_probe` in the edge function:
1. Before rolling `rollLocationType()`, check if `galaxy_planets` has an unclaimed entry at the target coordinate
2. If found: reveal as `habitable_planet` location type with the planet's name
3. If not found: proceed with existing RNG roll

New entry in `LOCATION_TYPES` display (client-side only — not in the weight table):
- Type: `habitable_planet`
- Galaxy map icon: distinct planet marker (green/blue)
- Shows "Colonize" action button when player has a colony ship

---

## Colonization Flow

1. **Discover**: Probe reveals "Habitable Planet: [name]" at coordinate X
2. **Prepare**: Player builds a Colony Ship (requires tech + shipyard level + resources)
3. **Dispatch**: From galaxy map, select the habitable planet → "Colonize" action
   - Creates a `colonize` mission type
   - Colony ship is removed from planet_ships
   - Travel time based on distance and colony ship speed (3)
4. **Arrival**: Edge function `resolve_colonize` mission:
   - Check `galaxy_planets` entry is still unclaimed (race condition guard)
   - Mark `galaxy_planets.claimed_by` = player, `claimed_at` = now
   - Create new planet in `planets` table with:
     - `player_id` = current player
     - `name` = galaxy_planets.name (editable later)
     - `coordinates` = the colonized coordinate
     - Starting resources: 500 metal, 200 gas (same as initial planet)
   - Initialize buildings: HQ Lv.1, Solar Array Lv.1, all others Lv.0
   - Initialize weather as Calm Skies
   - Add welcome event: "Colony established! Your settlers begin building."
   - Colony ship is consumed (not returned)
5. **Failure**: If planet was claimed by another player during transit → mission fails, colony ship is lost, player gets event notification

---

## Planet Switching

### UI: Planet Selector

Located in the top navigation bar, next to QueueStrip:
- Dropdown showing all player's planets: name + coordinates
- Active planet highlighted
- Click to switch → re-fetches all planet-scoped data

### Planet Naming

- Click planet name in selector to edit inline
- New edge function action: `rename_planet`
- Validation: 2-24 characters, alphanumeric + spaces/hyphens, unique per player
- Starting planet ("Homeworld") can be renamed too

### State Management

- Modify `usePlanet.ts` to accept a `planetId` parameter instead of using `LIMIT 1`
- Store selected planet ID in `localStorage` for persistence across sessions
- Add `usePlanets()` hook (plural) to fetch the list of all player's planets (lightweight: id, name, coordinates only)
- When switching planets, all planet-scoped data re-fetches (buildings, ships, queues, missions, weather, events)

---

## Resource Transfer

### Transfer Missions

New mission type `transfer`:
- Player selects source planet (current), destination planet (another of their own), resources, and fleet
- Cargo ships carry resources up to their total cargo capacity
- Travel time based on coordinate distance between planets
- On arrival: resources added to destination planet, ships move to destination planet's fleet
- Ships stay at destination (player can send them back in another transfer)

### Edge Function

New action `dispatch_transfer`:
- Validates both planets belong to the same player
- Validates fleet has enough cargo capacity for the resources
- Deducts resources and ships from source planet
- Creates mission with type `transfer` and metadata containing resource amounts
- On resolve: adds resources and ships to destination planet

---

## Verification

1. Send probe to a seeded habitable planet coordinate → should reveal as "Habitable Planet"
2. Build colony ship (requires Colonization Theory Lv.1 + Shipyard Lv.8)
3. Dispatch colonization mission → watch fleet travel on galaxy map
4. New planet appears in planet selector after colonization completes
5. Switch between planets → each has independent buildings, ships, resources
6. Rename a planet → name persists and shows in selector
7. Send cargo ships with resources between planets → resources arrive correctly
