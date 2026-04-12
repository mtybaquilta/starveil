# Galaxy Map Redesign

## Goal

Replace the flat emoji grid galaxy map with a pannable 2D space canvas where the player's home planet sits at the center and discovered locations are scattered across the map as visually distinct, interactive tiles.

## Architecture

The galaxy map becomes a single full-height canvas (`2400x1600` base size) rendered inside a viewport container. The player pans by click-dragging. Locations are absolutely positioned based on their `galaxy:system:position` coordinates. A minimap in the corner shows the full map with a viewport indicator. Clicking a location opens a detail panel that slides up from the bottom of the screen.

The existing data flow is unchanged — `usePlanet` fetches `galaxy_map` entries, and `GalaxyMapPage` renders them. The main changes are purely in the presentation layer (`GalaxyMapPage.tsx`).

## Visual Elements

### Space Background

- Dark canvas (`#05050f`) with procedural CSS stars via `radial-gradient` dots
- Subtle grid overlay (`rgba(100,140,255,0.03)`, 120px spacing) for spatial orientation
- Faint nebula gradients (indigo, purple) for depth

### Home Planet

- Large sphere (80px) using `radial-gradient` to simulate 3D lighting
- Two concentric orbital rings (faint indigo borders)
- "HOME" label above, planet name and coordinates below
- Indigo glow (`box-shadow`)
- Always positioned at canvas center (1200, 800)

### Location Tiles

Each revealed location renders as a 50x50px rounded tile with CSS-drawn contents:

**Asteroid Fields** — amber theme
- Tile contains 2-3 CSS ellipses simulating rocks (`radial-gradient`)
- Border: `rgba(245,158,11,0.15)`
- Faint amber glow behind tile
- Label color: `#f59e0b`

**Bandit Camps** — red theme
- Tile contains a rotated square (station shape) with a small red glowing dot (warning light)
- Border: `rgba(239,68,68,0.2)`
- Faint red glow behind tile
- Label color: `#ef4444`

**Debris Fields** — slate theme
- Tile contains 2-3 small rotated rectangles (metal chunks)
- Border: `rgba(148,163,184,0.12)`
- No glow
- Label color: `#94a3b8`

**Detected Signals** (not yet revealed)
- Circular shape (36px), not square
- Dashed border: `rgba(234,179,8,0.35)`
- Contains a pulsing "?" character (CSS `@keyframes` opacity animation, 2.5s cycle)
- Label shows raw coordinates instead of a name
- Label color: `rgba(234,179,8,0.45)`

### Cleared/Depleted Locations

Hidden entirely — not rendered on the map. When a location's `cleared_at` is set, it disappears. To see it again after respawn, the player must run another radar scan (which is free).

### Connection Lines

Faint dashed SVG lines from the home planet to locations within a certain pixel radius (~400px). Stroke: `rgba(100,140,255,0.06)`, dash pattern `6,6`. Provides visual structure without clutter.

## Coordinate-to-Position Mapping

The `galaxy:system:position` coordinate format (e.g., `1:3:5`) maps to canvas position:

- **System** determines horizontal band — each system occupies a ~400px-wide column, centered so the home planet's system is in the middle
- **Position** determines vertical placement within that band, spread across the canvas height with some randomized jitter (seeded by the entry ID) to avoid perfect grid alignment
- The home planet's coordinates define the center point; all other locations are placed relative to it

This ensures locations that are "nearby" in coordinate space appear nearby on the canvas.

## Interaction

### Panning

- Click and drag on empty space to pan the canvas
- Cursor changes to `grab` / `grabbing`
- Canvas position is clamped to prevent panning past edges

### Coordinate Search

- Monospace input field in the header, right side, next to "Run Radar Scan"
- Placeholder text: `1:3:5`
- On Enter: canvas smoothly pans (`transition` or `requestAnimationFrame`) to center on matching coordinates
- If coordinates match a known location, auto-select it (detail panel opens)
- If no match, show a brief inline message: "No location at those coordinates"

### Location Selection

- Click a location tile to select it
- Selected tile gets indigo border (`rgba(99,102,241,0.7)`) and glow (`box-shadow`)
- Detail panel slides up from the bottom of the viewport (`transform: translateY` transition, 0.25s ease)
- Click the same tile again or click "Deselect" to close
- Only one location selected at a time

### Detail Panel

Slides up from the bottom, full width, with a blurred backdrop. Contains:

**Left side (info):**
- Location name (large, colored by type) + type badge (small pill)
- Description text (1-2 sentences)
- Stats row: type-specific metadata + coordinates + status
  - Asteroid: Richness (X/5), Coordinates, Status (Active)
  - Bandit: Size (small/medium/large), Coordinates, Threat (Low/Medium/High)
  - Debris: Est. Salvage (~X metal), Coordinates, Status (Active)
  - Detected: Coordinates only

**Right side (actions):**
- Primary action button, styled by type:
  - Asteroid → "Send Mining Fleet" (amber gradient) — navigates to `/missions` with `?target=<coords>&type=mining` so the missions page can pre-select the target
  - Bandit → "Send Raid Fleet" (red gradient) — navigates to `/missions` with `?target=<coords>&type=raid`
  - Debris → "Send Salvage Fleet" (slate gradient) — navigates to `/missions` with `?target=<coords>&type=salvage`
  - Detected → "Send Probe" (yellow/amber outline) — calls `send_probe` action directly (same as current implementation)
- "Deselect" secondary button below

### Minimap

- Fixed position: bottom-right corner of the viewport
- Size: 180x120px, dark background with border
- Contains:
  - Colored dots for each location (matching type colors)
  - Larger indigo dot for home planet
  - Semi-transparent rectangle showing current viewport position
  - "Home" button to snap camera back to home planet
- Viewport indicator updates on every pan

### Header

- Left: "Galaxy Map" title + subtitle showing counts ("X detected · Y revealed")
- Right: coordinate search input + "Run Radar Scan" button

## Data Filtering

The `GalaxyMapPage` component filters the `galaxyMap` array before rendering:

```
visibleLocations = galaxyMap.filter(entry => {
  // Hide cleared locations
  if (entry.cleared_at) return false
  return true
})
```

Cleared locations are hidden regardless of `respawns_at` state. After respawn, the player runs a radar scan (free) to re-detect the location, which creates a new `galaxy_map` entry.

The "revealed" count in the header subtitle only counts visible (non-cleared) revealed entries.

## Component Structure

All changes are in `src/pages/GalaxyMapPage.tsx`. No new files needed — the page is self-contained.

Internal structure within the file:
- `GalaxyMapPage` — main component: filters data, manages pan state, selection state, renders canvas
- `LocationNode` — renders a single location tile with CSS illustrations based on type
- `HomePlanet` — renders the home planet sphere
- `DetailPanel` — renders the slide-up panel for the selected location
- `Minimap` — renders the minimap overlay
- `coordsToPosition(coords, homeCoords, canvasW, canvasH, entryId)` — pure function mapping coordinates to canvas position
- Constants: `CANVAS_W = 2400`, `CANVAS_H = 1600`

## Edge Cases

- **Empty map (no locations):** Show centered home planet with message "Run a radar scan to discover nearby coordinates"
- **Single location:** Map still renders full canvas, minimap still shows
- **Location at same coordinates as home:** Offset slightly so it doesn't overlap the planet
- **Very many locations (50+):** Canvas size scales — no performance concern since these are simple CSS tiles, not canvas/WebGL

## What Does NOT Change

- `usePlanet.ts` — no changes to data fetching
- `useGalaxyMap.ts` — no changes (but the page may not use this hook if it accesses context directly)
- `galaxy_map` database table — no schema changes
- Edge function handlers for `run_radar`, `send_probe` — no changes
- Mission dispatch flow — the detail panel action buttons call the same `dispatchMission` from context
