# Research Fix, Galaxy Map Zoom, Queue Strip & Weather Impact — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the tech bonus bug (bonuses defined but never applied), show production/stat breakdowns everywhere, add galaxy map zoom + minimap click-to-navigate, add a persistent queue strip below the resource bar, and surface weather impact in the resource bar.

**Architecture:** Four independent feature tracks sharing one new utility (`getTechBonuses`) and one new display component (`ProductionBreakdown`). The tech bonus fix threads through frontend hook, backend edge function, and display pages. The galaxy map changes are contained entirely in `GalaxyMapPage.tsx`. The queue strip replaces `ConstructionTimer` in the sidebar.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind CSS 4, Supabase Edge Functions (Deno), Vitest + Testing Library

---

## File Map

### New Files
- `src/lib/techBonuses.ts` — `getTechBonuses()` pure function (frontend)
- `src/lib/__tests__/techBonuses.test.ts` — unit tests for bonus calculation
- `src/components/ProductionBreakdown.tsx` — reusable breakdown display component
- `src/components/QueueStrip.tsx` — persistent queue strip shown on all pages

### Modified Files
- `src/hooks/useResources.ts` — accept `technologies` param, apply bonuses before weather/energy
- `src/components/Layout.tsx` — pass `technologies` to `useResources`, render `QueueStrip`, pass weather multipliers to `ResourceBar`
- `src/components/ResourceBar.tsx` — add weather impact summary (notable multipliers), add breakdown tooltip on resource rates
- `src/pages/ResourcesPage.tsx` — use `ProductionBreakdown` in `ResourcePanel`
- `src/components/BuildingDetail.tsx` — use `ProductionBreakdown` in output stats
- `src/pages/FleetPage.tsx` — show boosted ship stats (attack/defense)
- `src/pages/ShipyardPage.tsx` — show boosted ship stats
- `src/pages/GalaxyMapPage.tsx` — add zoom state, wheel handler, +/− buttons, minimap click
- `src/components/Sidebar.tsx` — remove `ConstructionTimer`
- `supabase/functions/game-action/index.ts` — fetch `planet_technologies`, apply bonuses in `recalculateResources`

### Deleted Files
- `src/components/ConstructionTimer.tsx` — replaced by `QueueStrip`

---

## Task 1: Tech Bonus Utility

**Files:**
- Create: `src/lib/techBonuses.ts`
- Create: `src/lib/__tests__/techBonuses.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/techBonuses.test.ts
import { describe, it, expect } from 'vitest'
import { getTechBonuses } from '../techBonuses'

describe('getTechBonuses', () => {
  it('returns all zeros for empty technologies', () => {
    const bonuses = getTechBonuses([])
    expect(bonuses.metal_production).toBe(0)
    expect(bonuses.gas_production).toBe(0)
    expect(bonuses.energy_production).toBe(0)
    expect(bonuses.ship_attack).toBe(0)
    expect(bonuses.ship_defense).toBe(0)
  })

  it('returns 0.10 metal bonus for efficient_refining level 2', () => {
    const bonuses = getTechBonuses([{ tech_id: 'efficient_refining', level: 2 }])
    // 5% per level × 2 levels = 10% = 0.10
    expect(bonuses.metal_production).toBeCloseTo(0.10)
    expect(bonuses.gas_production).toBe(0)
  })

  it('stacks bonuses from multiple techs for energy', () => {
    // solar_efficiency: +5%/level at level 3 = 15%
    // fusion_theory: +8%/level at level 2 = 16%
    // total: 31% = 0.31
    const bonuses = getTechBonuses([
      { tech_id: 'solar_efficiency', level: 3 },
      { tech_id: 'fusion_theory', level: 2 },
    ])
    expect(bonuses.energy_production).toBeCloseTo(0.31)
  })

  it('ignores unlock-type bonuses', () => {
    const bonuses = getTechBonuses([{ tech_id: 'capital_ship_engineering', level: 3 }])
    expect(bonuses.ship_attack).toBe(0)
    expect(bonuses.ship_defense).toBe(0)
  })

  it('returns 0.05 ship_defense for reinforced_hulls level 1', () => {
    const bonuses = getTechBonuses([{ tech_id: 'reinforced_hulls', level: 1 }])
    expect(bonuses.ship_defense).toBeCloseTo(0.05)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/lib/__tests__/techBonuses.test.ts
```
Expected: FAIL — `Cannot find module '../techBonuses'`

- [ ] **Step 3: Write implementation**

```ts
// src/lib/techBonuses.ts
import { TECHNOLOGIES } from '../config/technologies'

export type TechBonusMap = {
  metal_production: number
  gas_production: number
  energy_production: number
  ship_attack: number
  ship_defense: number
  mining_yield: number
  storage_capacity: number
}

export function getTechBonuses(technologies: { tech_id: string; level: number }[]): TechBonusMap {
  const result: TechBonusMap = {
    metal_production: 0,
    gas_production: 0,
    energy_production: 0,
    ship_attack: 0,
    ship_defense: 0,
    mining_yield: 0,
    storage_capacity: 0,
  }

  for (const { tech_id, level } of technologies) {
    if (level <= 0) continue
    const config = TECHNOLOGIES.find((t) => t.id === tech_id)
    if (!config) continue
    for (const bonus of config.bonuses) {
      if (bonus.type !== 'percentage') continue
      const stat = bonus.stat as keyof TechBonusMap
      if (stat in result) {
        result[stat] += (bonus.valuePerLevel / 100) * level
      }
    }
  }

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/lib/__tests__/techBonuses.test.ts
```
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/techBonuses.ts src/lib/__tests__/techBonuses.test.ts
git commit -m "feat: add getTechBonuses utility for applying research bonuses"
```

---

## Task 2: Apply Tech Bonuses in useResources

**Files:**
- Modify: `src/hooks/useResources.ts`

- [ ] **Step 1: Update the hook signature and apply bonuses**

In `src/hooks/useResources.ts`, make the following changes:

```ts
import { useState, useEffect, useRef } from 'react'
import { calculateResources, calculateEnergyRatio } from '../lib/resources'
import { productionPerHour, energyConsumption, storageCapacity, BASE_METAL_PRODUCTION_PER_HOUR, BASE_GAS_PRODUCTION_PER_HOUR } from '../config/formulas'
import { getBuildingConfig } from '../config/buildings'
import { getTechBonuses } from '../lib/techBonuses'
import type { Planet, PlanetBuilding, PlanetWeather, PlanetTechnology } from './usePlanet'

type ResourceState = {
  metal: number
  gas: number
  metalPerHour: number
  gasPerHour: number
  metalBaseFromBuildings: number   // pre-research base rate for breakdown display
  gasBaseFromBuildings: number     // pre-research base rate for breakdown display
  energyProduced: number
  energyConsumed: number
  energyRatio: number
  metalStorageCap: number
  gasStorageCap: number
  // Bonus breakdown for display
  metalResearchBonus: number
  gasResearchBonus: number
  energyResearchBonus: number
}

const BASE_METAL_STORAGE = 10000
const BASE_GAS_STORAGE = 10000

export function useResources(
  planet: Planet | null,
  buildings: PlanetBuilding[],
  weather: PlanetWeather | null,
  technologies: PlanetTechnology[]
): ResourceState {
  const [resources, setResources] = useState<ResourceState>({
    metal: 0,
    gas: 0,
    metalPerHour: 0,
    gasPerHour: 0,
    metalBaseFromBuildings: 0,
    gasBaseFromBuildings: 0,
    energyProduced: 0,
    energyConsumed: 0,
    energyRatio: 1,
    metalStorageCap: BASE_METAL_STORAGE,
    gasStorageCap: BASE_GAS_STORAGE,
    metalResearchBonus: 0,
    gasResearchBonus: 0,
    energyResearchBonus: 0,
  })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!planet || buildings.length === 0) return

    const buildingMap = new Map(buildings.map((b) => [b.building_id, b.level]))
    const techBonuses = getTechBonuses(technologies)

    let metalPerHourBase = 0
    let gasPerHourBase = 0
    let energyProducedBase = 0
    let energyConsumed = 0
    let metalCap = BASE_METAL_STORAGE
    let gasCap = BASE_GAS_STORAGE

    for (const [id, level] of buildingMap) {
      const config = getBuildingConfig(id)
      if (id === 'metal_mine') metalPerHourBase += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'gas_refinery') gasPerHourBase += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'solar_array') energyProducedBase += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'metal_storage') metalCap = storageCapacity(BASE_METAL_STORAGE, level)
      if (id === 'gas_storage') gasCap = storageCapacity(BASE_GAS_STORAGE, level)
      energyConsumed += energyConsumption(config.baseEnergyConsumption, level)
    }

    metalPerHourBase = Math.max(metalPerHourBase, BASE_METAL_PRODUCTION_PER_HOUR)
    gasPerHourBase = Math.max(gasPerHourBase, BASE_GAS_PRODUCTION_PER_HOUR)

    // Apply research bonuses
    const metalPerHour = metalPerHourBase * (1 + techBonuses.metal_production)
    const gasPerHour = gasPerHourBase * (1 + techBonuses.gas_production)
    const energyProduced = energyProducedBase * (1 + techBonuses.energy_production)

    const eRatio = calculateEnergyRatio(energyProduced, energyConsumed)
    const weatherMetalMult = weather ? Number(weather.metal_multiplier) : 1
    const weatherGasMult = weather ? Number(weather.gas_multiplier) : 1

    function tick() {
      const { metal, gas } = calculateResources({
        metalAmount: planet!.metal_amount,
        gasAmount: planet!.gas_amount,
        lastCalculatedAt: new Date(planet!.last_calculated_at),
        now: new Date(),
        metalPerHour,
        gasPerHour,
        energyRatio: eRatio,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
        weatherMetalMultiplier: weatherMetalMult,
        weatherGasMultiplier: weatherGasMult,
      })

      setResources({
        metal,
        gas,
        metalPerHour: metalPerHour * eRatio * weatherMetalMult,
        gasPerHour: gasPerHour * eRatio * weatherGasMult,
        metalBaseFromBuildings: metalPerHourBase,
        gasBaseFromBuildings: gasPerHourBase,
        energyProduced,
        energyConsumed,
        energyRatio: eRatio,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
        metalResearchBonus: techBonuses.metal_production,
        gasResearchBonus: techBonuses.gas_production,
        energyResearchBonus: techBonuses.energy_production,
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [planet, buildings, weather, technologies])

  return resources
}
```

- [ ] **Step 2: Check if `PlanetTechnology` type exists in usePlanet**

```bash
grep -n "PlanetTechnology\|technologies" src/hooks/usePlanet.ts | head -20
```

If `PlanetTechnology` is not exported, find the actual type name for `technologies` array items and use that instead.

- [ ] **Step 3: Fix Layout.tsx to pass technologies**

In `src/components/Layout.tsx`, change the `useResources` call from:
```ts
const resources = useResources(planet, buildings, weather)
```
to:
```ts
const resources = useResources(planet, buildings, weather, technologies)
```

Also update the `GameContext` type: add `metalResearchBonus`, `gasResearchBonus`, `energyResearchBonus` to the `resources` return type (these come through automatically since `ResourceState` is inferred).

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useResources.ts src/components/Layout.tsx
git commit -m "fix: apply tech research bonuses to resource production in useResources"
```

---

## Task 3: Apply Tech Bonuses in Edge Function

**Files:**
- Modify: `supabase/functions/game-action/index.ts`

- [ ] **Step 1: Add bonus calculation helper at top of file**

Find the section near the top of `supabase/functions/game-action/index.ts` where `BUILDINGS` and `SHIP_STATS` are defined, and add this helper after them:

```ts
// Tech bonus calculation (mirrors src/lib/techBonuses.ts)
function calcTechBonuses(technologies: { tech_id: string; level: number }[]): {
  metal_production: number
  gas_production: number
  energy_production: number
  ship_attack: number
  ship_defense: number
} {
  const BONUS_STATS: Record<string, Record<string, number>> = {
    'efficient_refining':  { metal_production: 5 },
    'rapid_extraction':    { gas_production: 5 },
    'solar_efficiency':    { energy_production: 5 },
    'fusion_theory':       { energy_production: 8 },
    'reinforced_hulls':    { ship_defense: 5 },
    'advanced_weapons':    { ship_attack: 5 },
  }
  const result = { metal_production: 0, gas_production: 0, energy_production: 0, ship_attack: 0, ship_defense: 0 }
  for (const { tech_id, level } of technologies) {
    if (level <= 0) continue
    const stats = BONUS_STATS[tech_id]
    if (!stats) continue
    for (const [stat, valuePerLevel] of Object.entries(stats)) {
      result[stat as keyof typeof result] += (valuePerLevel / 100) * level
    }
  }
  return result
}
```

- [ ] **Step 2: Update recalculateResources to fetch and apply tech bonuses**

Replace the existing `recalculateResources` function (lines ~294–328) with:

```ts
async function recalculateResources(supabase: any, planetId: string): Promise<{ metal: number; gas: number }> {
  const { data: planet } = await supabase.from('planets').select('metal_amount, gas_amount, last_calculated_at').eq('id', planetId).single()
  const { data: buildings } = await supabase.from('planet_buildings').select('building_id, level').eq('planet_id', planetId)
  const { data: weather } = await supabase.from('planet_weather').select('metal_multiplier, gas_multiplier, energy_multiplier, expires_at').eq('planet_id', planetId).order('started_at', { ascending: false }).limit(1).single()
  const { data: techRows } = await supabase.from('planet_technologies').select('tech_id, level').eq('planet_id', planetId)

  const now = new Date()
  const elapsed = (now.getTime() - new Date(planet.last_calculated_at).getTime()) / (1000 * 3600)

  let totalMetalPerHour = 0, totalGasPerHour = 0, totalEnergyProduced = 0, totalEnergyConsumed = 0
  // deno-lint-ignore no-explicit-any
  const buildingMap = new Map(buildings.map((b: any) => [b.building_id, b.level]))

  for (const [id, level] of buildingMap) {
    const config = BUILDINGS[id as string]
    if (!config) continue
    if (id === 'metal_mine')  totalMetalPerHour  += productionPerHour(config.baseProductionPerHour, level as number)
    if (id === 'gas_refinery') totalGasPerHour   += productionPerHour(config.baseProductionPerHour, level as number)
    if (id === 'solar_array')  totalEnergyProduced += productionPerHour(config.baseProductionPerHour, level as number)
    totalEnergyConsumed += energyConsumption(config.baseEnergyConsumption, level as number)
  }

  totalMetalPerHour = Math.max(totalMetalPerHour, BASE_METAL_PRODUCTION)
  totalGasPerHour = Math.max(totalGasPerHour, BASE_GAS_PRODUCTION)

  // Apply tech bonuses
  const techBonuses = calcTechBonuses(techRows ?? [])
  totalMetalPerHour *= (1 + techBonuses.metal_production)
  totalGasPerHour *= (1 + techBonuses.gas_production)
  totalEnergyProduced *= (1 + techBonuses.energy_production)

  const energyRatio = totalEnergyConsumed <= 0 ? 1 : Math.min(1, totalEnergyProduced / totalEnergyConsumed)

  const weatherActive = weather && (!weather.expires_at || new Date(weather.expires_at) > now)
  const metalMult = weatherActive ? Number(weather.metal_multiplier) : 1
  const gasMult = weatherActive ? Number(weather.gas_multiplier) : 1

  const newMetal = planet.metal_amount + totalMetalPerHour * energyRatio * metalMult * elapsed
  const newGas = planet.gas_amount + totalGasPerHour * energyRatio * gasMult * elapsed

  await supabase.from('planets').update({ metal_amount: newMetal, gas_amount: newGas, last_calculated_at: now.toISOString() }).eq('id', planetId)
  return { metal: newMetal, gas: newGas }
}
```

- [ ] **Step 3: Type-check frontend (edge function doesn't have a local TS check)**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 4: Deploy the edge function**

```bash
supabase functions deploy game-action --no-verify-jwt
```
Expected: `Deployed game-action`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "fix: apply tech research bonuses in edge function recalculateResources"
```

---

## Task 4: ProductionBreakdown Component

**Files:**
- Create: `src/components/ProductionBreakdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ProductionBreakdown.tsx

type Props = {
  baseRate: number
  researchBonus: number       // e.g. 0.10 for 10%
  researchLabel?: string      // e.g. "Solar Efficiency" — omit to use generic label
  weatherMultiplier: number   // e.g. 1.3 for Solar Flare
  weatherLabel?: string       // e.g. "Solar Flare"
  energyRatio: number         // e.g. 0.98
  effectiveRate: number
  unit?: string               // defaults to "/h"
}

export function ProductionBreakdown({
  baseRate,
  researchBonus,
  researchLabel,
  weatherMultiplier,
  weatherLabel,
  energyRatio,
  effectiveRate,
  unit = '/h',
}: Props) {
  const hasResearch = researchBonus > 0.001
  const hasWeather = Math.abs(weatherMultiplier - 1) > 0.001
  const hasEnergyPenalty = energyRatio < 0.999

  return (
    <div className="space-y-1">
      <Row label="Base production" value={`${Math.floor(baseRate).toLocaleString()}${unit}`} valueClass="text-slate-300" />
      {hasResearch && (
        <Row
          label={researchLabel ? `Research (${researchLabel})` : 'Research bonus'}
          value={`+${Math.round(researchBonus * 100)}%`}
          valueClass="text-emerald-400"
        />
      )}
      {hasWeather && (
        <Row
          label={weatherLabel ? `Weather (${weatherLabel})` : 'Weather'}
          value={`×${weatherMultiplier.toFixed(2)}`}
          valueClass={weatherMultiplier >= 1 ? 'text-emerald-400' : 'text-red-400'}
        />
      )}
      {hasEnergyPenalty && (
        <Row
          label="Energy penalty"
          value={`×${energyRatio.toFixed(2)}`}
          valueClass="text-yellow-400"
        />
      )}
      <div className="border-t border-slate-700/30 pt-1 mt-1">
        <Row label="Effective" value={`${Math.floor(effectiveRate).toLocaleString()}${unit}`} valueClass="text-slate-100 font-semibold" />
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductionBreakdown.tsx
git commit -m "feat: add ProductionBreakdown component for resource/energy stat display"
```

---

## Task 5: Update ResourceBar with Weather Impact + Breakdown Tooltip

**Files:**
- Modify: `src/components/ResourceBar.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Pass weather multipliers from Layout to ResourceBar**

In `src/components/Layout.tsx`, update the `ResourceBar` props to include multipliers and resource base rates:

```tsx
<ResourceBar
  metal={resources.metal}
  gas={resources.gas}
  metalPerHour={resources.metalPerHour}
  gasPerHour={resources.gasPerHour}
  metalBaseRate={resources.metalBaseFromBuildings}
  gasBaseRate={resources.gasBaseFromBuildings}
  metalResearchBonus={resources.metalResearchBonus}
  gasResearchBonus={resources.gasResearchBonus}
  energyProduced={resources.energyProduced}
  energyConsumed={resources.energyConsumed}
  energyRatio={resources.energyRatio}
  planetName={planet.name}
  coordinates={planet.coordinates}
  weatherType={weather?.weather_type ?? 'calm_skies'}
  weatherExpiresAt={weather?.expires_at ?? null}
  weatherMetalMultiplier={weather ? Number(weather.metal_multiplier) : 1}
  weatherGasMultiplier={weather ? Number(weather.gas_multiplier) : 1}
  weatherStationLevel={buildings.find((b) => b.building_id === 'weather_station')?.level ?? 0}
/>
```

- [ ] **Step 2: Rewrite ResourceBar.tsx**

```tsx
// src/components/ResourceBar.tsx
import { useState, useEffect } from 'react'
import { ProductionBreakdown } from './ProductionBreakdown'

type Props = {
  metal: number
  gas: number
  metalPerHour: number
  gasPerHour: number
  metalBaseRate: number
  gasBaseRate: number
  metalResearchBonus: number
  gasResearchBonus: number
  energyProduced: number
  energyConsumed: number
  energyRatio: number
  planetName: string
  coordinates: string
  weatherType: string
  weatherExpiresAt: string | null
  weatherMetalMultiplier: number
  weatherGasMultiplier: number
  weatherStationLevel: number
}

const WEATHER_LABELS: Record<string, string> = {
  calm_skies:      '☀ Calm Skies',
  solar_flare:     '🔆 Solar Flare',
  metal_vein:      '⛏️ Metal Vein',
  gas_pocket:      '💨 Gas Pocket',
  ion_storm:       '⚡ Ion Storm',
  dust_storm:      '🌪️ Dust Storm',
  solar_storm:     '☄️ Solar Storm',
  asteroid_shower: '🪨 Asteroid Shower',
  nebula_drift:    '🌌 Nebula Drift',
}

const WEATHER_NAMES: Record<string, string> = {
  calm_skies: 'Calm Skies', solar_flare: 'Solar Flare', metal_vein: 'Metal Vein',
  gas_pocket: 'Gas Pocket', ion_storm: 'Ion Storm', dust_storm: 'Dust Storm',
  solar_storm: 'Solar Storm', asteroid_shower: 'Asteroid Shower', nebula_drift: 'Nebula Drift',
}

function formatWeatherTime(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}

function weatherImpactSummary(
  metalMult: number,
  gasMult: number,
  stationLevel: number
): string {
  if (stationLevel === 0) return ''
  const parts: string[] = []
  if (Math.abs(metalMult - 1) > 0.001) {
    const pct = Math.round(Math.abs(metalMult - 1) * 100)
    parts.push(`Metal ${metalMult > 1 ? '+' : '−'}${pct}%`)
  }
  if (Math.abs(gasMult - 1) > 0.001) {
    const pct = Math.round(Math.abs(gasMult - 1) * 100)
    parts.push(`Gas ${gasMult > 1 ? '+' : '−'}${pct}%`)
  }
  return parts.join(' · ')
}

export function ResourceBar({
  metal, gas, metalPerHour, gasPerHour,
  metalBaseRate, gasBaseRate, metalResearchBonus, gasResearchBonus,
  energyProduced, energyConsumed, energyRatio,
  planetName, coordinates, weatherType, weatherExpiresAt,
  weatherMetalMultiplier, weatherGasMultiplier, weatherStationLevel,
}: Props) {
  const [weatherRemaining, setWeatherRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!weatherExpiresAt) { setWeatherRemaining(null); return }
    const update = () => {
      const remaining = new Date(weatherExpiresAt).getTime() - Date.now()
      setWeatherRemaining(remaining > 0 ? remaining : 0)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [weatherExpiresAt])

  const weatherName = WEATHER_NAMES[weatherType] ?? weatherType
  const impact = weatherImpactSummary(weatherMetalMultiplier, weatherGasMultiplier, weatherStationLevel)

  return (
    <div className="flex items-center px-5 py-2.5 bg-slate-950/90 border-b border-slate-800/50">
      <div className="text-sm font-bold text-slate-100 mr-6 tracking-wide">STARVEIL: Interstellar Siege</div>

      <div className="flex gap-5 flex-1">
        <ResourceItem
          color="bg-orange-400"
          value={metal}
          rate={metalPerHour}
          textColor="text-orange-400"
          label="Metal"
          baseRate={metalBaseRate}
          researchBonus={metalResearchBonus}
          weatherMultiplier={weatherMetalMultiplier}
          weatherLabel={weatherName}
          energyRatio={energyRatio}
        />
        <ResourceItem
          color="bg-violet-400"
          value={gas}
          rate={gasPerHour}
          textColor="text-violet-400"
          label="Gas"
          baseRate={gasBaseRate}
          researchBonus={gasResearchBonus}
          weatherMultiplier={weatherGasMultiplier}
          weatherLabel={weatherName}
          energyRatio={energyRatio}
        />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-green-400" />
          <span className="text-green-400 font-semibold text-sm">
            {Math.floor(energyProduced)}/{Math.floor(energyConsumed)}
          </span>
          <span className="text-slate-500 text-[10px]">energy</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-500 text-xs">
        <span className="text-slate-400">
          {WEATHER_LABELS[weatherType] ?? weatherType}
          {impact && <span className="text-slate-500 ml-1.5">{impact}</span>}
          {weatherRemaining !== null && weatherRemaining > 0 && (
            <span className="text-slate-600 ml-1.5">{formatWeatherTime(weatherRemaining)}</span>
          )}
        </span>
        <span>{planetName} · {coordinates}</span>
      </div>
    </div>
  )
}

function ResourceItem({
  color, value, rate, textColor, label,
  baseRate, researchBonus, weatherMultiplier, weatherLabel, energyRatio,
}: {
  color: string; value: number; rate: number; textColor: string; label: string
  baseRate: number; researchBonus: number; weatherMultiplier: number; weatherLabel: string; energyRatio: number
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className={`font-semibold text-sm ${textColor}`}>
        {Math.floor(value).toLocaleString()}
      </span>
      <button
        className="text-slate-500 text-[10px] hover:text-slate-300 transition-colors cursor-pointer"
        onClick={() => setShowTooltip((s) => !s)}
        onBlur={() => setShowTooltip(false)}
      >
        +{Math.floor(rate).toLocaleString()}/h
      </button>
      <span className="sr-only">{label}</span>

      {showTooltip && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-slate-900 border border-slate-700/40 rounded-lg p-3 shadow-xl min-w-[200px]">
          <div className={`text-[10px] font-semibold ${textColor} mb-2`}>{label} Production</div>
          <ProductionBreakdown
            baseRate={baseRate}
            researchBonus={researchBonus}
            weatherMultiplier={weatherMultiplier}
            weatherLabel={weatherLabel}
            energyRatio={energyRatio}
            effectiveRate={rate}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ResourceBar.tsx src/components/Layout.tsx
git commit -m "feat: add weather impact summary and breakdown tooltip to ResourceBar"
```

---

## Task 6: Update ResourcesPage with Breakdown

**Files:**
- Modify: `src/pages/ResourcesPage.tsx`

- [ ] **Step 1: Update ResourcePanel to use ProductionBreakdown**

Replace the `ResourcePanel` component in `src/pages/ResourcesPage.tsx`. The page receives `weather` from context and `resources` which now includes the bonus fields.

First update the `useOutletContext` destructure at the top:
```ts
const { buildings, resources, weather } = useOutletContext<GameContext>()
```

Then add `weatherLabel` computation (remove the manual `metalBaseRate`/`gasBaseRate` calculation — these come from `resources` now):
```ts
const WEATHER_NAMES: Record<string, string> = {
  calm_skies: 'Calm Skies', solar_flare: 'Solar Flare', metal_vein: 'Metal Vein',
  gas_pocket: 'Gas Pocket', ion_storm: 'Ion Storm', dust_storm: 'Dust Storm',
  solar_storm: 'Solar Storm', asteroid_shower: 'Asteroid Shower', nebula_drift: 'Nebula Drift',
}
const weatherName = weather ? (WEATHER_NAMES[weather.weather_type] ?? weather.weather_type) : 'Calm Skies'
```

Update the `ResourcePanel` calls:
```tsx
<ResourcePanel
  label="Metal"
  color="text-orange-400"
  bgColor="bg-orange-400"
  baseRate={resources.metalBaseFromBuildings}
  researchBonus={resources.metalResearchBonus}
  weatherMultiplier={weather ? Number(weather.metal_multiplier) : 1}
  weatherLabel={weatherName}
  energyRatio={resources.energyRatio}
  effectiveProduction={resources.metalPerHour}
  current={resources.metal}
  cap={resources.metalStorageCap}
  source={`Metal Mine Lv.${metalMineLevel}`}
/>
<ResourcePanel
  label="Gas"
  color="text-violet-400"
  bgColor="bg-violet-400"
  baseRate={resources.gasBaseFromBuildings}
  researchBonus={resources.gasResearchBonus}
  weatherMultiplier={weather ? Number(weather.gas_multiplier) : 1}
  weatherLabel={weatherName}
  energyRatio={resources.energyRatio}
  effectiveProduction={resources.gasPerHour}
  current={resources.gas}
  cap={resources.gasStorageCap}
  source={`Gas Refinery Lv.${gasRefineryLevel}`}
/>
```

Replace the `ResourcePanel` function:
```tsx
function ResourcePanel({
  label, color, bgColor, baseRate, researchBonus, weatherMultiplier, weatherLabel,
  energyRatio, effectiveProduction, current, cap, source,
}: {
  label: string; color: string; bgColor: string; baseRate: number
  researchBonus: number; weatherMultiplier: number; weatherLabel: string
  energyRatio: number; effectiveProduction: number; current: number; cap: number; source: string
}) {
  return (
    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-sm ${bgColor}`} />
        <span className={`text-sm font-semibold ${color}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {Math.floor(current).toLocaleString()}
      </div>
      <div className="text-[10px] text-slate-500 mt-1">
        of {Math.floor(cap).toLocaleString()} capacity
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700/10">
        <ProductionBreakdown
          baseRate={baseRate}
          researchBonus={researchBonus}
          weatherMultiplier={weatherMultiplier}
          weatherLabel={weatherLabel}
          energyRatio={energyRatio}
          effectiveRate={effectiveProduction}
        />
        <div className="text-[10px] text-slate-600 mt-2">{source}</div>
      </div>
    </div>
  )
}
```

Add the import at top of file:
```ts
import { ProductionBreakdown } from '../components/ProductionBreakdown'
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/ResourcesPage.tsx
git commit -m "feat: show production breakdown with research and weather on ResourcesPage"
```

---

## Task 7: BuildingDetail Output Breakdown

**Files:**
- Modify: `src/components/BuildingDetail.tsx`

- [ ] **Step 1: Update BuildingDetail to accept and show breakdown**

The `BuildingDetail` component currently receives `buildings` but not `resources` or `technologies`. Update its props and the `BuildingDetail` call in `BuildingsPage.tsx`.

In `src/pages/BuildingsPage.tsx`, update the destructure and call:
```ts
const { buildings, resources, weather } = useOutletContext<GameContext>()
```
```tsx
<BuildingDetail
  buildingId={buildingId}
  buildings={buildings}
  metal={resources.metal}
  gas={resources.gas}
  activeBuild={activeBuild}
  onStartBuild={startBuild}
  resources={resources}
  weather={weather}
/>
```

In `src/components/BuildingDetail.tsx`, add `resources` and `weather` props:
```ts
import { ProductionBreakdown } from './ProductionBreakdown'
import type { PlanetWeather } from '../hooks/usePlanet'

const WEATHER_NAMES: Record<string, string> = {
  calm_skies: 'Calm Skies', solar_flare: 'Solar Flare', metal_vein: 'Metal Vein',
  gas_pocket: 'Gas Pocket', ion_storm: 'Ion Storm', dust_storm: 'Dust Storm',
  solar_storm: 'Solar Storm', asteroid_shower: 'Asteroid Shower', nebula_drift: 'Nebula Drift',
}

type Props = {
  buildingId: string
  buildings: PlanetBuilding[]
  metal: number
  gas: number
  activeBuild: ConstructionItem | null
  onStartBuild: (buildingId: string) => Promise<void>
  resources: { metalResearchBonus: number; gasResearchBonus: number; energyResearchBonus: number; energyRatio: number; metalPerHour: number; gasPerHour: number; energyProduced: number }
  weather: PlanetWeather | null
}
```

In the production stat area (after the `StatBlock` components for `config.baseProductionPerHour > 0`), replace the current output display with a breakdown for production buildings. Find the section:
```tsx
{config.baseProductionPerHour > 0 && (
  <>
    <StatBlock label="Current Output" value={`${Math.floor(currentProduction)}`} suffix="/hr" color="text-orange-400" />
    ...
  </>
)}
```

Replace with:
```tsx
{config.baseProductionPerHour > 0 && level > 0 && (
  <div className="flex-1">
    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
      {buildingId === 'solar_array' ? 'Energy Output' : 'Current Output'}
    </div>
    <ProductionBreakdown
      baseRate={currentProduction}
      researchBonus={
        buildingId === 'metal_mine' ? resources.metalResearchBonus
        : buildingId === 'gas_refinery' ? resources.gasResearchBonus
        : buildingId === 'solar_array' ? resources.energyResearchBonus
        : 0
      }
      weatherMultiplier={
        buildingId === 'metal_mine' ? (weather ? Number(weather.metal_multiplier) : 1)
        : buildingId === 'gas_refinery' ? (weather ? Number(weather.gas_multiplier) : 1)
        : 1
      }
      weatherLabel={weather ? (WEATHER_NAMES[weather.weather_type] ?? weather.weather_type) : 'Calm Skies'}
      energyRatio={buildingId === 'solar_array' ? 1 : resources.energyRatio}
      effectiveRate={
        buildingId === 'metal_mine' ? resources.metalPerHour
        : buildingId === 'gas_refinery' ? resources.gasPerHour
        : resources.energyProduced
      }
      unit={buildingId === 'solar_array' ? '' : '/h'}
    />
    {!isMaxLevel && (
      <div className="mt-2 text-[10px] text-green-400">
        Next level: {Math.floor(nextProduction)}{buildingId === 'solar_array' ? '' : '/h'}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BuildingDetail.tsx src/pages/BuildingsPage.tsx
git commit -m "feat: show production breakdown in BuildingDetail for production buildings"
```

---

## Task 8: Boosted Ship Stats on Fleet and Shipyard Pages

**Files:**
- Modify: `src/pages/FleetPage.tsx`
- Modify: `src/pages/ShipyardPage.tsx`

- [ ] **Step 1: Update FleetPage ShipRow to show boosted stats**

In `src/pages/FleetPage.tsx`, import `getTechBonuses`:
```ts
import { getTechBonuses } from '../lib/techBonuses'
```

In `FleetPage`, compute boosted stats from technologies:
```ts
const { planet, shipFleet, activeShipBuild, shipBuildQueue, shipTimeRemaining, activeMissions, refetch, technologies } = useOutletContext<GameContext>()
const techBonuses = getTechBonuses(technologies)
```

Pass bonuses to `ShipRow`:
```tsx
<ShipRow
  key={ship.id}
  ship={ship}
  count={count}
  available={available}
  deployed={deployed}
  planetId={planet.id}
  onScrap={refetch}
  onDeploy={() => navigate(`/missions?ship=${ship.id}`)}
  attackBonus={techBonuses.ship_attack}
  defenseBonus={techBonuses.ship_defense}
/>
```

Add `attackBonus` and `defenseBonus` to `ShipRow` props and update the stats display:
```tsx
function ShipRow({ ship, count, available, deployed, planetId, onScrap, onDeploy, attackBonus, defenseBonus }: {
  ship: (typeof SHIPS)[number]
  count: number; available: number; deployed: number; planetId: string
  onScrap: () => Promise<void>; onDeploy: () => void
  attackBonus: number; defenseBonus: number
}) {
```

Replace the stats line in `ShipRow`:
```tsx
<div className="text-[10px] text-slate-500">
  Spd {ship.stats.speed} · 
  {attackBonus > 0.001 ? (
    <><span className="text-slate-600 line-through">{ship.stats.attackPower}</span> <span className="text-slate-200">{Math.round(ship.stats.attackPower * (1 + attackBonus))}</span> Atk</>
  ) : (
    <>Atk {ship.stats.attackPower}</>
  )}
  {' · '}
  {defenseBonus > 0.001 ? (
    <><span className="text-slate-600 line-through">{ship.stats.defenseRating}</span> <span className="text-slate-200">{Math.round(ship.stats.defenseRating * (1 + defenseBonus))}</span> Def</>
  ) : (
    <>Def {ship.stats.defenseRating}</>
  )}
  {' · '}Cargo {ship.stats.cargoCapacity.toLocaleString()}
</div>
```

Also update the Fleet Power totals banner to use boosted values:
```ts
const totals = SHIPS.reduce(
  (acc, ship) => {
    const count = fleetCounts.get(ship.id) ?? 0
    acc.attack += count * Math.round(ship.stats.attackPower * (1 + techBonuses.ship_attack))
    acc.defense += count * Math.round(ship.stats.defenseRating * (1 + techBonuses.ship_defense))
    acc.cargo += count * ship.stats.cargoCapacity
    acc.ships += count
    return acc
  },
  { attack: 0, defense: 0, cargo: 0, ships: 0 }
)
```

- [ ] **Step 2: Update ShipyardPage ship cards to show boosted stats**

In `src/pages/ShipyardPage.tsx`, the `technologies` is already destructured. Pass bonuses to `ShipCard`:

```ts
const techBonuses = getTechBonuses(technologies.map(t => ({ tech_id: t.tech_id, level: t.level })))
```

Add `attackBonus` and `defenseBonus` to `ShipCard` props and update the stats grid:
```tsx
{/* Stats — 4-column: label value | label value */}
<div className="grid grid-cols-2 gap-x-4 gap-y-1">
  <StatRow label="Speed" value={ship.stats.speed} />
  <StatRow label="Cargo" value={ship.stats.cargoCapacity} />
  <BoostedStatRow label="Attack" base={ship.stats.attackPower} bonus={attackBonus} />
  <BoostedStatRow label="Defense" base={ship.stats.defenseRating} bonus={defenseBonus} />
</div>
```

Add helper components at the bottom of the file:
```tsx
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value.toLocaleString()}</span>
    </div>
  )
}

function BoostedStatRow({ label, base, bonus }: { label: string; base: number; bonus: number }) {
  const boosted = Math.round(base * (1 + bonus))
  const hasBonuses = bonus > 0.001
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">
        {hasBonuses ? (
          <>
            <span className="text-slate-600 line-through mr-1">{base}</span>
            {boosted}
            <span className="text-emerald-400 ml-1">(+{Math.round(bonus * 100)}%)</span>
          </>
        ) : (
          base
        )}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/FleetPage.tsx src/pages/ShipyardPage.tsx
git commit -m "feat: show tech-boosted attack/defense stats on Fleet and Shipyard pages"
```

---

## Task 9: Galaxy Map Zoom + Minimap Click Navigation

**Files:**
- Modify: `src/pages/GalaxyMapPage.tsx`

- [ ] **Step 1: Add zoom state and constants**

In `GalaxyMapPage`, add zoom state and constants near the top of the component:
```ts
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0
const ZOOM_STEP = 0.25

// In component:
const [zoom, setZoom] = useState(1.0)
```

- [ ] **Step 2: Update clamp to account for zoom**

Replace the existing `clamp` function:
```ts
const clamp = useCallback((x: number, y: number, z = zoom) => {
  const w = wrapRef.current?.clientWidth ?? 800
  const h = wrapRef.current?.clientHeight ?? 600
  const visibleW = w / z
  const visibleH = h / z
  return {
    x: Math.max(0, Math.min(CANVAS_W - visibleW, x)),
    y: Math.max(0, Math.min(CANVAS_H - visibleH, y)),
  }
}, [zoom])
```

- [ ] **Step 3: Add wheel handler for scroll zoom**

Add `onWheel` handler in the component:
```ts
const onWheel = useCallback((e: React.WheelEvent) => {
  e.preventDefault()
  const w = wrapRef.current?.clientWidth ?? 800
  const h = wrapRef.current?.clientHeight ?? 600

  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta))
  if (newZoom === zoom) return

  // Zoom toward cursor position
  const rect = wrapRef.current!.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // Canvas point under cursor = camX + mouseX/zoom
  const canvasX = camX + mouseX / zoom
  const canvasY = camY + mouseY / zoom

  // New cam so same canvas point is under cursor
  const newCamX = canvasX - mouseX / newZoom
  const newCamY = canvasY - mouseY / newZoom

  const clamped = clamp(newCamX, newCamY, newZoom)
  setCamX(clamped.x)
  setCamY(clamped.y)
  setZoom(newZoom)
}, [zoom, camX, camY, clamp])
```

Add it to the viewport div:
```tsx
<div
  ref={wrapRef}
  className="flex-1 relative overflow-hidden select-none"
  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={onPointerUp}
  onPointerLeave={onPointerUp}
  onWheel={onWheel}
>
```

- [ ] **Step 4: Apply zoom transform to canvas**

Update the canvas inner div transform:
```tsx
<div
  className="absolute"
  style={{
    width: CANVAS_W,
    height: CANVAS_H,
    transform: `translate(${-camX}px, ${-camY}px) scale(${zoom})`,
    transformOrigin: '0 0',
    background: `...`
  }}
>
```

- [ ] **Step 5: Update Minimap to accept zoom and handle click**

Update `Minimap` props and component:
```ts
function Minimap({
  locations, homeCoords, camX, camY, viewportW, viewportH,
  zoom, onScrollHome, panelOpen, onMinimapClick,
}: {
  locations: GalaxyMapEntry[]; homeCoords: string
  camX: number; camY: number; viewportW: number; viewportH: number
  zoom: number; onScrollHome: () => void; panelOpen: boolean
  onMinimapClick: (camX: number, camY: number) => void
}) {
  // Account for zoom in viewport indicator
  const visibleW = viewportW / zoom
  const visibleH = viewportH / zoom
  const vpW = (visibleW / CANVAS_W) * 100
  const vpH = (visibleH / CANVAS_H) * 100
  const vpX = (camX / CANVAS_W) * 100
  const vpY = (camY / CANVAS_H) * 100

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height
    const canvasX = relX * CANVAS_W
    const canvasY = relY * CANVAS_H
    // Center view on clicked point
    const newCamX = canvasX - (viewportW / zoom) / 2
    const newCamY = canvasY - (viewportH / zoom) / 2
    onMinimapClick(newCamX, newCamY)
  }
```

Add `onClick={handleClick}` to the minimap div and remove `data-clickable` (it should be clickable for navigation).

- [ ] **Step 6: Add +/− zoom buttons**

In `GalaxyMapPage`, add handlers:
```ts
const zoomIn = useCallback(() => {
  setZoom((z) => {
    const newZoom = Math.min(MAX_ZOOM, z + ZOOM_STEP)
    if (!wrapRef.current) return newZoom
    const w = wrapRef.current.clientWidth
    const h = wrapRef.current.clientHeight
    const clamped = clamp(camX + w * (1/z - 1/newZoom) / 2, camY + h * (1/z - 1/newZoom) / 2, newZoom)
    setCamX(clamped.x)
    setCamY(clamped.y)
    return newZoom
  })
}, [camX, camY, clamp])

const zoomOut = useCallback(() => {
  setZoom((z) => {
    const newZoom = Math.max(MIN_ZOOM, z - ZOOM_STEP)
    if (!wrapRef.current) return newZoom
    const w = wrapRef.current.clientWidth
    const h = wrapRef.current.clientHeight
    const clamped = clamp(camX + w * (1/z - 1/newZoom) / 2, camY + h * (1/z - 1/newZoom) / 2, newZoom)
    setCamX(clamped.x)
    setCamY(clamped.y)
    return newZoom
  })
}, [camX, camY, clamp])
```

Add the buttons in the JSX, positioned above the minimap (use `data-clickable` so pointer events don't trigger drag):
```tsx
{/* Zoom controls */}
<div
  data-clickable
  className="absolute z-[31] flex flex-col gap-1"
  style={{ right: '12px', bottom: panelOpen ? '286px' : '144px' }}
>
  <button
    onClick={zoomIn}
    disabled={zoom >= MAX_ZOOM}
    className="w-7 h-7 flex items-center justify-center rounded bg-slate-900/80 border border-slate-700/20 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
  >
    +
  </button>
  <button
    onClick={zoomOut}
    disabled={zoom <= MIN_ZOOM}
    className="w-7 h-7 flex items-center justify-center rounded bg-slate-900/80 border border-slate-700/20 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
  >
    −
  </button>
</div>
```

Note: `panelOpen` is derived from `selected !== null`. Add `const panelOpen = selected !== null` before the return.

Pass the new props to `Minimap`:
```tsx
<Minimap
  locations={visibleLocations}
  homeCoords={planet.coordinates}
  camX={camX}
  camY={camY}
  viewportW={wrapRef.current?.clientWidth ?? 800}
  viewportH={wrapRef.current?.clientHeight ?? 600}
  zoom={zoom}
  onScrollHome={scrollToHome}
  panelOpen={panelOpen}
  onMinimapClick={(x, y) => {
    const clamped = clamp(x, y)
    setCamX(clamped.x)
    setCamY(clamped.y)
  }}
/>
```

Also move `panelOpen` derivation up before the Minimap call if it's not already there.

- [ ] **Step 7: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/pages/GalaxyMapPage.tsx
git commit -m "feat: add zoom (scroll/pinch/buttons) and minimap click-to-navigate on galaxy map"
```

---

## Task 10: Queue Strip — Replace ConstructionTimer

**Files:**
- Create: `src/components/QueueStrip.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Delete: `src/components/ConstructionTimer.tsx`

- [ ] **Step 1: Create QueueStrip component**

```tsx
// src/components/QueueStrip.tsx
import { getBuildingConfig } from '../config/buildings'
import { getShipConfig } from '../config/ships'
import { formatTime } from '../hooks/useConstructionQueue'
import type { ConstructionItem, ShipQueueItem, ResearchQueueItem } from '../hooks/usePlanet'

type Props = {
  activeBuild: ConstructionItem | null
  timeRemaining: number | null
  activeShipBuild: ShipQueueItem | null
  shipTimeRemaining: number | null
  activeResearch: ResearchQueueItem | null
  researchTimeRemaining: number | null
}

export function QueueStrip({
  activeBuild, timeRemaining,
  activeShipBuild, shipTimeRemaining,
  activeResearch, researchTimeRemaining,
}: Props) {
  const hasAnything = activeBuild || activeShipBuild || activeResearch
  if (!hasAnything) return null

  return (
    <div className="flex items-center gap-px bg-slate-950/90 border-b border-slate-800/50 px-4">
      {activeBuild && (
        <QueueSlot
          image={getBuildingConfig(activeBuild.building_id).image}
          label={`${getBuildingConfig(activeBuild.building_id).name} → Lv.${activeBuild.target_level}`}
          timeRemaining={timeRemaining}
          startedAt={activeBuild.started_at}
          completesAt={activeBuild.completes_at}
          barColor="from-indigo-500 to-violet-500"
        />
      )}
      {activeBuild && activeShipBuild && <div className="w-px h-8 bg-slate-800/50 mx-2" />}
      {activeShipBuild && (
        <QueueSlot
          image={getShipConfig(activeShipBuild.ship_type).image}
          label={`${getShipConfig(activeShipBuild.ship_type).name} ×${activeShipBuild.quantity}`}
          timeRemaining={shipTimeRemaining}
          startedAt={activeShipBuild.started_at}
          completesAt={activeShipBuild.completes_at}
          barColor="from-sky-500 to-cyan-500"
        />
      )}
      {(activeBuild || activeShipBuild) && activeResearch && <div className="w-px h-8 bg-slate-800/50 mx-2" />}
      {activeResearch && (
        <QueueSlot
          label={`${activeResearch.tech_id.replace(/_/g, ' ')} → Lv.${activeResearch.target_level}`}
          timeRemaining={researchTimeRemaining}
          startedAt={activeResearch.started_at}
          completesAt={activeResearch.completes_at}
          barColor="from-violet-500 to-purple-500"
        />
      )}
    </div>
  )
}

function QueueSlot({
  image, label, timeRemaining, startedAt, completesAt, barColor,
}: {
  image?: string; label: string
  timeRemaining: number | null; startedAt: string; completesAt: string | null
  barColor: string
}) {
  if (!completesAt) return null
  const totalMs = new Date(completesAt).getTime() - new Date(startedAt).getTime()
  const elapsedMs = totalMs - (timeRemaining ?? 0)
  const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0

  return (
    <div className="flex items-center gap-2 py-1.5 min-w-[160px] max-w-[220px]">
      {image && (
        <img src={image} alt="" className="w-6 h-6 rounded object-cover shrink-0 opacity-80" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-300 truncate">{label}</span>
          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
            {timeRemaining !== null ? formatTime(timeRemaining) : '...'}
          </span>
        </div>
        <div className="mt-1 h-[2px] bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check ResearchQueueItem type name**

```bash
grep -n "ResearchQueueItem\|research_queue\|researchQueue" src/hooks/usePlanet.ts | head -15
```

Use the correct type name — if it's called something different, update the import in `QueueStrip.tsx`.

- [ ] **Step 3: Render QueueStrip in Layout**

In `src/components/Layout.tsx`, add the import and render it between `ResourceBar` and `<div className="flex flex-1">`:

```tsx
import { QueueStrip } from './QueueStrip'

// In the JSX, after </ResourceBar>:
<QueueStrip
  activeBuild={activeBuild}
  timeRemaining={timeRemaining}
  activeShipBuild={activeShipBuild}
  shipTimeRemaining={shipTimeRemaining}
  activeResearch={activeResearch}
  researchTimeRemaining={researchTimeRemaining}
/>
```

- [ ] **Step 4: Remove ConstructionTimer from Sidebar**

In `src/components/Sidebar.tsx`:
1. Remove `import { ConstructionTimer } from './ConstructionTimer'`
2. Remove the `<ConstructionTimer ... />` JSX block
3. Remove `activeBuild`, `timeRemaining`, `activeShipBuild`, `shipTimeRemaining` from the `Props` type
4. Remove them from the function signature
5. Remove `type { ConstructionItem, ShipQueueItem }` import from `usePlanet` if no longer needed

In `src/components/Layout.tsx`, remove the 4 props from the `<Sidebar>` call:
```tsx
<Sidebar activeMissionCount={activeMissions.length} />
```

- [ ] **Step 5: Delete ConstructionTimer**

```bash
rm src/components/ConstructionTimer.tsx
```

- [ ] **Step 6: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/QueueStrip.tsx src/components/Layout.tsx src/components/Sidebar.tsx
git rm src/components/ConstructionTimer.tsx
git commit -m "feat: add persistent QueueStrip replacing sidebar ConstructionTimer"
```

---

## Task 11: Final Check + Verification

- [ ] **Step 1: Run full test suite**

```
npx vitest run
```
Expected: All tests pass

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Start dev server and verify manually**

```
npm run dev
```

Check each feature:
- [ ] Research page: research a tech, check that Solar Array output increases on Resources page
- [ ] Resources page: verify breakdown shows base, research bonus, weather, energy penalty lines correctly
- [ ] Building detail: open Solar Array — verify breakdown matches Resources page
- [ ] Fleet page: if `reinforced_hulls` or `advanced_weapons` researched, stats show strikethrough base + boosted value
- [ ] Shipyard page: same as fleet
- [ ] Galaxy map: scroll to zoom in/out, +/− buttons work, minimap click pans view
- [ ] Queue strip: visible below resource bar when building/ship/research is active, hidden when nothing active
- [ ] Weather impact: resource bar shows e.g. `🔆 Solar Flare · Energy +30% · 2h 14m`

- [ ] **Step 4: Commit any final cleanup**

```bash
git add -p
git commit -m "chore: final cleanup and verification"
```
