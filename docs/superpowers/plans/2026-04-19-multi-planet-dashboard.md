# Multi-Planet Dashboard — Implementation Plan

**Goal:** Replace the Overview page's PlanetVisual image and Buildings grid with a read-only multi-planet dashboard that doubles as the planet selector.

**Architecture:** New `ColoniesDashboard` component driven by a `useColonySummaries` hook that fetches per-planet summary data in parallel. Rendered at the top of OverviewPage. Clicking a row calls the existing `selectPlanet(id)` so the detail sections below update in place.

**Tech Stack:** React 19, TypeScript, Tailwind, Supabase-js.

**Reference brainstorm:** conversation on 2026-04-19 (see `docs/backlog.md` → "Multi-planet production overview").

---

## Scope notes

- **Read-only v1.** No start-build / dispatch-from-row actions yet.
- **No alerts / warning icons in v1.** Just data. Alerts can be layered on later once we see how the view feels.
- Single-planet players see a one-row dashboard. That's fine.
- Current `PlanetVisual` component should be removed from the Overview page but not deleted from the repo yet — keep it for potential future use / reference.

---

## File Structure

**New:**
- `src/hooks/useColonySummaries.ts` — fetch + poll per-planet summary data.
- `src/components/ColoniesDashboard.tsx` — the table/rows component.

**Modified:**
- `src/pages/OverviewPage.tsx` — remove PlanetVisual + Buildings grid, mount dashboard.

---

## Task 1 — `useColonySummaries` hook

**Files:**
- Create: `src/hooks/useColonySummaries.ts`

**Shape of returned data, per planet:**
```typescript
export type ColonySummary = {
  id: string
  name: string
  coordinates: string
  metal_amount: number
  gas_amount: number
  metal_storage_cap: number
  gas_storage_cap: number
  metal_per_hour: number
  gas_per_hour: number
  energy_ratio: number          // 0–1
  weather_type: string | null
  construction: { label: string; completesAt: string } | null
  shipBuild:    { label: string; completesAt: string } | null
  research:     { label: string; completesAt: string } | null
  activeMissions: number         // outgoing + returning count
}
```

- [ ] **Step 1:** Implement the hook. Fetch in this order:
  1. All planets owned by the current user (reuse pattern from `usePlanets`).
  2. In parallel for each planet id: `buildings`, `construction_queue` (active item), `ship_queue` (active item), `research_queue` (active item), `weather`, `missions` (status in_transit/returning).
  3. Derive metal/gas rates + energy ratio from buildings (mirror logic in `useResources.ts`, pulled into a shared helper if needed).
  4. Return `{ summaries, loading, refetch }`.
- [ ] **Step 2:** Set up a 15-second polling interval that calls `refetch`.
- [ ] **Step 3:** Typecheck with `npm run build`.
- [ ] **Step 4:** Commit `feat(overview): useColonySummaries hook`.

**Note on resource math:** `useResources.ts` has the canonical production logic. If its inputs can be recombined cleanly, extract the pure calc into `src/lib/resourceRates.ts` and call it from both places. If that gets hairy, duplicate the minimum needed for the dashboard with a code comment, and leave the extraction as a follow-up.

---

## Task 2 — `ColoniesDashboard` component

**Files:**
- Create: `src/components/ColoniesDashboard.tsx`

**Row content (one per planet):**
- Active planet indicator (dot / highlight when `id === selectedPlanetId`).
- Name + coordinates + energy ratio + weather pill.
- `Metal N/cap ↑ rate/h` and `Gas N/cap ↑ rate/h`.
- Three queue slots side-by-side — construction / ship / research — each showing `label · time remaining` or "(idle)".
- Fleet status: `activeMissions > 0 ? "N in transit" : "Idle"`.
- Whole row is a `<button>` that calls `onSelect(id)` (passed in from OverviewPage).

**Visual guidance:** match the existing StarVeil aesthetic — small text (`text-[10px]`–`text-[11px]`), slate background (`bg-slate-800/30`), thin borders (`border-slate-700/20`), fuchsia/indigo accents only on the active row. No large iconography. Dense.

- [ ] **Step 1:** Implement the component. Accept `summaries`, `selectedPlanetId`, `onSelect` as props.
- [ ] **Step 2:** Handle `loading` (skeleton rows) and empty state (shouldn't happen in practice, but guard anyway).
- [ ] **Step 3:** Typecheck.
- [ ] **Step 4:** Commit `feat(overview): ColoniesDashboard component`.

---

## Task 3 — Rewire OverviewPage

**Files:**
- Modify: `src/pages/OverviewPage.tsx`

- [ ] **Step 1:** Remove the `<PlanetVisual />` block (lines ~114–117) and the entire "Building Grid" block (lines ~125–143), plus the now-unused imports (`PlanetVisual`, `BuildingCard`, `BUILDINGS`, `isBuildingUnlocked` logic).
- [ ] **Step 2:** Pull `planets`, `selectPlanet` from `useOutletContext<GameContext>()` (already available).
- [ ] **Step 3:** Call `useColonySummaries()` near the top of the component.
- [ ] **Step 4:** Render `<ColoniesDashboard summaries={...} selectedPlanetId={planet.id} onSelect={selectPlanet} />` as the first section (above the planet header).
- [ ] **Step 5:** Manually verify in `npm run dev`:
  - Single-planet account: dashboard shows one row; detail sections below still work.
  - Multi-planet account: all colonies listed; clicking a row switches the planet context so the header/weather/events below update.
  - Queues render with countdowns that tick down.
- [ ] **Step 6:** Commit `feat(overview): replace buildings grid with multi-planet dashboard`.

---

## Task 4 — PR

- [ ] Push branch, open PR, summary + test plan in the body.

---

## Self-Review Notes

- No migration or edge-function changes; purely additive client work.
- `PlanetVisual.tsx` left on disk (may be repurposed); only the import/usage is removed.
- No alerts in v1 by explicit user decision — a follow-up can layer them on using the same summary data.
- Parallel fetch of N planets' queues is fine at current scale; revisit with an RPC if player colony counts grow past ~8.
