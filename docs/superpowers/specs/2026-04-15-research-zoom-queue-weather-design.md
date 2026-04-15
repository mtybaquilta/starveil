# Research Fix, Galaxy Map Zoom, Queue Strip & Weather Impact — Design Spec

## Overview

Four independent improvements to StarVeil:

1. **Tech Bonus Fix + Visibility** — fix the bug where researched tech bonuses are never applied, and show production/stat breakdowns everywhere
2. **Galaxy Map Zoom & Minimap Navigation** — add scroll/pinch zoom with +/− buttons and click-to-navigate minimap
3. **Construction Queue Strip** — persistent horizontal bar below the resource bar showing all active queues
4. **Weather Impact Display** — show weather effects in the resource bar and integrate into production breakdowns

---

## 1. Tech Bonus System (Bug Fix + Display)

### The Bug

Tech bonuses are defined in `src/config/technologies.ts` with `bonuses: TechBonus[]` per technology (e.g., `solar_efficiency` → `+5% energy_production per level`). However, bonuses are **never consumed** anywhere:

- `useResources` hook (`src/hooks/useResources.ts`) doesn't receive technologies — production calculations ignore bonuses entirely
- `recalculateResources()` in the edge function (`supabase/functions/game-action/index.ts`) also ignores tech bonuses — resource deductions on build/research use wrong production rates
- Ship stats on Fleet and Shipyard pages are read from static config — `reinforced_hulls` / `advanced_weapons` bonuses have no effect

### Fix: Shared Bonus Calculation

New utility function in `src/lib/techBonuses.ts`:

```ts
function getTechBonuses(technologies: { tech_id: string; level: number }[]): Record<string, number>
```

Returns a map of cumulative percentage bonuses per stat, e.g.:
```ts
{ metal_production: 0.10, gas_production: 0.05, energy_production: 0.15, ship_attack: 0.10, ship_defense: 0.05 }
```

Consumes the `bonuses` array from each technology config, multiplied by the player's current level for that tech.

### Where Bonuses Are Applied

| Location | What changes |
|----------|-------------|
| `useResources` hook | Accept `technologies` param. Multiply base production by `(1 + bonus)` before weather/energy penalty. |
| Edge function `recalculateResources` | Same math server-side. Fetch `planet_technologies` and apply bonuses. |
| Fleet page ship rows | Multiply base attack/defense by `(1 + bonus)` for display. |
| Shipyard page ship cards | Same — show boosted stats. |
| Mission dispatch (edge function) | Use boosted ship stats for combat/mining resolution. |

### Application Order

```
effective = base × (1 + research_bonus) × weather_multiplier × energy_ratio
```

Research bonus applies first, then weather, then energy penalty. This matches the order in which they appear in the breakdown display.

### Production Breakdown Display

A reusable `ProductionBreakdown` component that renders:

```
Base production       778/h
Research (Solar Eff.) +10%
Weather (Solar Flare) ×1.3
Energy penalty        ×0.98
─────────────────────
Effective            1,115/h
```

Lines are only shown when they contribute (e.g., weather line hidden when multiplier is 1.0×, research line hidden when bonus is 0%).

This breakdown appears in:
- **Resource bar** — as a hover tooltip on each resource's rate
- **Resources page** — inline under each resource section
- **Building detail page** — in the "Current Output" area for production buildings

### Ship Stat Display with Bonuses

On Fleet page rows and Shipyard cards, when a tech bonus applies:

```
Attack: 80 → 92 (+15%)
```

- Base value dimmed (`text-slate-500`)
- Arrow separator
- Boosted value highlighted (`text-slate-200 font-medium`)
- Percentage in accent color (`text-emerald-400`)

When no bonus applies, just show the plain value as today.

---

## 2. Galaxy Map — Zoom & Minimap Navigation

### Current State

- Fixed 2400×1600 canvas with drag-to-pan via pointer events
- Minimap at bottom-right shows location dots, viewport rectangle, and Home button — display only
- No zoom

### Zoom Mechanics

- **Zoom range:** 0.5× to 2.0× (default 1.0×)
- **Scroll wheel:** zooms toward cursor position (point under cursor stays fixed)
- **Trackpad pinch:** works via the same wheel event on macOS
- **+/− buttons:** stacked vertically near the minimap (bottom-right area), zoom in 0.25× steps toward canvas center
- Visual: small rounded buttons, same dark styling as existing minimap

### Minimap Click-to-Navigate

- Click anywhere on the minimap → main view pans to center on that point
- The existing viewport rectangle updates in real-time as zoom/pan changes
- Home button remains as a shortcut to center on home planet

### Camera Clamping

Existing clamp logic adjusted for zoom level:
- At 2× zoom, viewable area is half the canvas → tighter camera bounds
- At 0.5× zoom, viewable area is double → looser bounds (may see entire canvas)

### Transform Approach

Apply `transform: scale(zoom)` with `transform-origin: 0 0` on the canvas container. Camera position (`camX`, `camY`) represents the top-left corner in canvas coordinates. Viewport size in canvas coords = `containerWidth / zoom` × `containerHeight / zoom`.

### Implementation Scope

All changes in `src/pages/GalaxyMapPage.tsx`:
- New `zoom` state (default 1.0)
- `onWheel` handler with `e.preventDefault()` to capture scroll
- Updated canvas transform to include scale
- Updated minimap viewport rectangle calculation
- `onClick` handler on minimap SVG
- +/− button UI elements

---

## 3. Construction Queue Strip

### Current State

`ConstructionTimer` in the sidebar (bottom) shows one active build. Ship build queue visible on FleetPage, research timer on ResearchPage. No single place shows all progress at once.

### Design

A persistent horizontal strip rendered in `Layout.tsx` between the `ResourceBar` and the page content (`<Outlet />`). Shows up to 3 active queues side by side:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [img] Metal Mine → Lv.8  2h 14m  │  [img] Cruiser ×1  34m  │  [img] Solar Eff. → Lv.3  1h 02m │
│ ████████░░░░░░░                   │  ██████████████░░░       │  █████░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Three Slots

| Slot | Source data | Display |
|------|-----------|---------|
| Building | `activeBuild` | Building image (20px), name → Lv.X, time remaining, progress bar |
| Shipyard | `shipBuildQueue[0]` (active item) | Ship image (20px), name ×quantity, time remaining, progress bar |
| Research | `activeResearch` | Tech icon/image (20px), name → Lv.X, time remaining, progress bar |

### Behavior

- **Hidden entirely** when no queues are active (no empty strip taking up space)
- Compact: single row, ~40px tall
- Same dark background treatment as resource bar (`bg-slate-950/90 border-b border-slate-800/50`)
- Progress bars: thin (2px), colored per type (indigo for building, sky for shipyard, violet for research)

### Implementation

- New `QueueStrip` component in `src/components/QueueStrip.tsx`
- Rendered in `Layout.tsx` between `ResourceBar` and `<Outlet />`
- Receives all queue data from the existing Layout context
- Remove `ConstructionTimer` from the sidebar (now redundant)

---

## 4. Weather Impact Display

### Resource Bar — Compact Impact Summary

Currently shows: `🔆 Solar Flare 2h 14m`

Change to: `🔆 Solar Flare · Energy +30% · 2h 14m`

Rules:
- Only show multipliers that deviate from 1.0×
- Format: `+30%` for buffs (green), `−20%` for debuffs (red)
- Calm Skies: just `☀ Calm Skies` (no effects to show)
- Gated by Weather Station level: level 0 shows name only, no effects (matching existing forecast detail gating)

### Production Breakdowns

Weather integrates into the `ProductionBreakdown` component from Section 1:

```
Base production       778/h
Research (Solar Eff.) +10%
Weather (Solar Flare) ×1.3
Energy penalty        ×0.98
─────────────────────
Effective            1,115/h
```

Weather line only appears when multiplier ≠ 1.0×. Uses the same component — no separate UI needed.

### Data Flow

Weather multipliers are already available in `useResources` via the `weather` param. The `ResourceBar` already receives `weatherType` — it just needs the multipliers passed through as well to display the impact summary.

---

## Files Changed

### New Files
- `src/lib/techBonuses.ts` — `getTechBonuses()` utility
- `src/components/QueueStrip.tsx` — persistent queue strip
- `src/components/ProductionBreakdown.tsx` — reusable breakdown tooltip/display

### Modified Files
- `src/hooks/useResources.ts` — accept technologies, apply bonuses
- `src/components/Layout.tsx` — pass technologies to useResources, render QueueStrip
- `src/components/ResourceBar.tsx` — add breakdown tooltips, weather impact summary
- `src/pages/ResourcesPage.tsx` — inline breakdowns
- `src/components/BuildingDetail.tsx` — breakdown in output stats
- `src/pages/FleetPage.tsx` — boosted ship stats
- `src/pages/ShipyardPage.tsx` — boosted ship stats
- `src/pages/GalaxyMapPage.tsx` — zoom + minimap click
- `src/components/Sidebar.tsx` — remove ConstructionTimer
- `supabase/functions/game-action/index.ts` — apply tech bonuses in recalculateResources and mission resolution

### Removed
- `src/components/ConstructionTimer.tsx` — replaced by QueueStrip
