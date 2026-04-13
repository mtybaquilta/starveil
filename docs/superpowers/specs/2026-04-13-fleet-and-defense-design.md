# Fleet Page Redesign & Defense Structures

## Goal

Two changes:
1. **Redesign the Fleet page** from a read-only roster into a useful management hub with fleet power overview, ship scrapping, and quick mission dispatch.
2. **Add 6 defense structures** as a new building category. Buildable and upgradeable but not yet wired into attack mechanics.

---

## Feature 1: Fleet Page Redesign

### Layout

Replace the current 3-column card grid with a **list-row layout**:

- **Power Banner** at the top — aggregate stats across all owned ships:
  - Total Attack, Total Defense, Total Cargo Capacity, Total Ship Count
  - Styled as a gradient banner (indigo→slate) matching the game's visual language
- **Ship Rows** below — one horizontal row per ship type (all types shown; rows with 0 ships are dimmed like the current Fleet page):
  - Ship icon, name, inline stats (Spd / Atk / Def / Cargo)
  - Count display: `available/total` with deployment status ("2 deployed" or "all home")
  - **Scrap** button — removes 1 ship, returns 50% of its metal/gas build cost
  - **Deploy →** button — navigates to `/missions?ship=<shipType>` to pre-filter that ship in the fleet selector
- **Under Construction** section stays at the top (above the power banner) when a ship is being built, same as current

### Scrap Mechanic

- Backend: new `scrap_ship` action in `game-action` edge function
- Validates: player owns ≥1 of that ship type, ship is not deployed on a mission
- Returns 50% of `ship.cost.metal` and `ship.cost.gas` (floored)
- Decrements `ship_fleet.count` by 1
- Adds resources to `planets.metal_amount` / `planets.gas_amount`
- Creates a `planet_events` entry: "Scrapped 1 Scout — recovered 30 metal, 10 gas"
- Frontend: Scrap button disabled when count is 0 or all ships are deployed. Shows "Scrapping..." feedback on click.

### Deploy Shortcut

- Deploy button navigates to `/missions?ship=<shipType>`
- MissionsPage reads `ship` query param and pre-increments that ship type's count in the fleet selector by 1
- Disabled when no ships of that type are available (all deployed or count is 0)

### Data Flow

No new database tables. Uses existing `ship_fleet` and `planets` tables. The power banner computes aggregates client-side from `shipFleet` and `SHIPS` config.

---

## Feature 2: Defense Structures

### New Building Category

Add `'defense'` to the `BuildingCategory` type. The Buildings page will show a new "Defense" tab alongside Resource, Storage, and Infrastructure.

### Structures

All defense structures follow the existing building pattern: levels 1–20, metal/gas cost, energy consumption, build time, prerequisites. Each has a `defenseRating` field (per level) that contributes to a planet-wide **Planet Defense Rating** displayed on the Overview page.

| ID | Name | Description | Base Cost | Energy | Build Time | Prereqs | Base Defense Rating |
|----|------|-------------|-----------|--------|------------|---------|-------------------|
| `perimeter_turret` | Perimeter Turret | Automated ballistic turrets forming the first line of planetary defense. Fast to build, cheap to maintain. | 150 metal, 50 gas | 8 | 45s | HQ Lv.2 | 10/level |
| `ion_cannon` | Ion Cannon | High-energy directed beam weapon. Devastating against capital ships but draws significant power. | 400 metal, 250 gas | 25 | 120s | HQ Lv.4, Research Lab Lv.2 | 25/level |
| `missile_battery` | Missile Battery | Guided warhead launchers with excellent range. A balanced mix of firepower and efficiency. | 250 metal, 150 gas | 15 | 90s | HQ Lv.3, Perimeter Turret Lv.3 | 18/level |
| `shield_generator` | Shield Generator | Projects an energy barrier that absorbs incoming damage before structures take hits. The defensive cornerstone of any fortified colony. | 500 metal, 350 gas | 30 | 150s | HQ Lv.5, Research Lab Lv.3 | 30/level |
| `sensor_jammer` | Sensor Jammer | Electronic warfare array that disrupts targeting systems, reducing attacker accuracy. Low power, high utility. | 200 metal, 200 gas | 10 | 75s | HQ Lv.4 | 12/level |
| `orbital_platform` | Orbital Platform | A weapons platform in low orbit. The ultimate planetary defense — expensive to build and maintain but unmatched in firepower. | 800 metal, 500 gas | 40 | 200s | HQ Lv.7, Ion Cannon Lv.5 | 50/level |

### Defense Rating

- Each defense structure contributes `baseDefenseRating * level` to the planet's total
- The **Planet Defense Rating** is displayed on the Overview page as a simple aggregate number
- For now this number is purely informational — no attack mechanics consume it yet

### Config Changes

- Add `'defense'` to `BuildingCategory` type
- Add `defenseRating` (optional) to `BuildingConfig` — only defense buildings have it
- Add 6 new entries to the `BUILDINGS` array
- Existing buildings get `defenseRating: 0` (or field is omitted since it's optional)

### Database Changes

- The `planet_buildings` table already supports arbitrary building IDs — no schema migration needed
- The `initialize_player` function (in the migration that creates a new player) needs to insert rows for the 6 new defense buildings at level 0
- For the existing player: a one-time SQL migration to insert the missing building rows

### Building Images

- Each defense structure needs a building image at `/images/buildings/<id>.png`
- Use the `generate-image` skill to create these during implementation

### Buildings Page

- Add "Defense" tab to the branch tab bar
- Defense buildings render with the same card/detail pattern as existing buildings
- No changes to the build queue mechanics — defense structures use the same single build queue

---

## Out of Scope

- Attack events / bandit raids consuming the defense rating
- PvP attack mechanics
- Defense structure damage/repair
- Fleet page: fleet presets, formation saving
- Any new database tables
