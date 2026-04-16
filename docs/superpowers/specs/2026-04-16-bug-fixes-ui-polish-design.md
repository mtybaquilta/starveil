# Bug Fixes & UI Polish

## Context

Three issues need addressing: a timer display bug in the QueueStrip, a lackluster research page missing icons and flavor text, and ship/building card images with wrong proportions.

---

## 1. Research Timer Bug

**Root cause**: `src/hooks/useResearchQueue.ts:45` calculates remaining time in **seconds** (divides `getTime()` by 1000), but `QueueStrip` passes the value to `formatTime()` from `useConstructionQueue` which expects **milliseconds**. Result: 420 seconds (7 min) becomes `Math.ceil(420/1000) = 1` second.

**Fix**:
- `src/hooks/useResearchQueue.ts:45` — remove the `/ 1000` divisions so it returns milliseconds:
  ```ts
  // Before
  const remaining = new Date(activeResearch.completes_at).getTime() / 1000 - Date.now() / 1000
  // After
  const remaining = new Date(activeResearch.completes_at).getTime() - Date.now()
  ```
- `src/pages/ResearchPage.tsx:143` — the ResearchPage has its own `formatTime` that expects seconds, so divide by 1000 when displaying:
  ```ts
  formatTime(researchTimeRemaining / 1000)
  ```

**Files**: `src/hooks/useResearchQueue.ts`, `src/pages/ResearchPage.tsx`, `src/components/QueueStrip.tsx`

---

## 2. Research Page — Icons & Lore

### Config changes (`src/config/technologies.ts`)

Add two new fields to `TechConfig`:
- `icon: string` — image path (same pattern as ships/buildings). Defaults to a per-branch placeholder SVG
- `lore: string` — 1-2 sentence immersive flavor text

Example:
```ts
{
  id: 'reinforced_hulls',
  name: 'Reinforced Hulls',
  lore: 'Composite alloys forged in zero-gravity foundries, layered for maximum deflection.',
  icon: reinforcedHullsIcon, // placeholder initially
  // ... rest unchanged
}
```

### Placeholder icons

Use simple SVG icons per branch as defaults (replaceable with real assets later):
- Military: shield icon
- Economy: pickaxe/coin icon
- Exploration: compass icon
- Energy: lightning bolt icon

### UI changes (`src/pages/ResearchPage.tsx`)

Update tech card layout:
- Add 32×32 icon on the left side of each card
- Show `lore` as italic slate-400 text between the tech name and mechanical bonuses
- Keep existing layout structure (flex row with button on right)

---

## 3. Image Proportions

The current card images are AI-generated at proportions that don't fit the card layout. The cards use:
- Building cards: `w-full h-32` (full-width, 128px tall) → **~2.6:1 aspect ratio**
- Ship cards: `w-full h-36` (full-width, 144px tall) → **~2.3:1 aspect ratio**
- Detail view: `w-28 h-28` (112×112 square)

### Recommended regeneration dimensions (2x retina):
- **Building images**: 660 × 256px
- **Ship images**: 660 × 288px
- **Detail thumbnails**: 224 × 224px

No code changes needed — `object-cover` handles the fit. Just regenerate images at correct proportions.

---

## Verification

1. Start dev server, open QueueStrip with active research — timer should show correct minutes
2. Research page should display icons and lore text for each technology
3. Regenerated images (when ready) should fill cards without awkward cropping
