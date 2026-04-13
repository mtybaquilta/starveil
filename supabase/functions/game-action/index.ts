import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = adminClient
    const body = await req.json()
    const { action, planetId, buildingId, shipType, quantity, devMode } = body

    if (action === 'start_build') {
      return await handleStartBuild(supabase, user.id, planetId, buildingId, !!devMode, corsHeaders)
    }
    if (action === 'complete_build') {
      return await handleCompleteBuild(supabase, user.id, planetId, corsHeaders)
    }
    if (action === 'start_ship_build') {
      return await handleStartShipBuild(supabase, user.id, planetId, shipType, quantity ?? 1, !!devMode, corsHeaders)
    }
    if (action === 'complete_ship_build') {
      return await handleCompleteShipBuild(supabase, user.id, planetId, corsHeaders)
    }
    if (action === 'run_radar') {
      return await handleRunRadar(supabase, user.id, planetId, corsHeaders)
    }
    if (action === 'send_probe') {
      return await handleSendProbe(supabase, user.id, planetId, body.targetCoords, corsHeaders)
    }
    if (action === 'start_research') {
      return await handleStartResearch(supabase, user.id, planetId, body.techId, !!devMode, corsHeaders)
    }
    if (action === 'complete_research') {
      return await handleCompleteResearch(supabase, user.id, corsHeaders)
    }
    if (action === 'dispatch_mission') {
      return await handleDispatchMission(supabase, user.id, planetId, body.missionType, body.fleet, body.targetCoords, !!devMode, corsHeaders)
    }
    if (action === 'resolve_mission') {
      return await handleResolveMission(supabase, user.id, planetId, body.missionId, corsHeaders)
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ============================================================
// Formula helpers (mirror src/config/formulas.ts)
// ============================================================

const BASE_METAL_PRODUCTION = 10
const BASE_GAS_PRODUCTION = 5

function upgradeCost(baseCost: number, level: number): number {
  return baseCost * Math.pow(1.6, level)
}

function buildTimeSeconds(baseTime: number, level: number): number {
  return baseTime * Math.pow(1.5, level)
}

function productionPerHour(baseRate: number, level: number): number {
  if (level <= 0) return 0
  return baseRate * level * Math.pow(1.1, level)
}

function energyConsumption(baseEnergy: number, level: number): number {
  if (level <= 0 || baseEnergy === 0) return 0
  return baseEnergy * level * Math.pow(1.1, level)
}

function shipBuildTimeSeconds(baseBuildTimeSeconds: number, shipyardLevel: number): number {
  const factor = Math.pow(0.9, shipyardLevel)
  return baseBuildTimeSeconds * Math.max(factor, 0.05)
}

function researchCost(baseMetal: number, baseGas: number, level: number): { metal: number; gas: number } {
  return { metal: baseMetal * Math.pow(1.6, level), gas: baseGas * Math.pow(1.6, level) }
}

function researchTimeSeconds(baseTime: number, level: number): number {
  return baseTime * Math.pow(1.5, level)
}

// ============================================================
// Static configs (mirror src/config/*.ts)
// ============================================================

const BUILDINGS: Record<string, {
  baseCost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  baseProductionPerHour: number
  baseEnergyConsumption: number
  prerequisites: { buildingId: string; level: number }[]
}> = {
  headquarters:    { baseCost: { metal: 100,  gas: 50  }, baseBuildTimeSeconds: 60,  baseProductionPerHour: 0,  baseEnergyConsumption: 5,  prerequisites: [] },
  metal_mine:      { baseCost: { metal: 60,   gas: 15  }, baseBuildTimeSeconds: 30,  baseProductionPerHour: 30, baseEnergyConsumption: 10, prerequisites: [] },
  gas_refinery:    { baseCost: { metal: 80,   gas: 40  }, baseBuildTimeSeconds: 45,  baseProductionPerHour: 20, baseEnergyConsumption: 12, prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
  solar_array:     { baseCost: { metal: 50,   gas: 25  }, baseBuildTimeSeconds: 30,  baseProductionPerHour: 25, baseEnergyConsumption: 0,  prerequisites: [] },
  metal_storage:   { baseCost: { metal: 100,  gas: 0   }, baseBuildTimeSeconds: 40,  baseProductionPerHour: 0,  baseEnergyConsumption: 3,  prerequisites: [{ buildingId: 'metal_mine', level: 2 }] },
  gas_storage:     { baseCost: { metal: 100,  gas: 50  }, baseBuildTimeSeconds: 40,  baseProductionPerHour: 0,  baseEnergyConsumption: 3,  prerequisites: [{ buildingId: 'gas_refinery', level: 2 }] },
  weather_station: { baseCost: { metal: 120,  gas: 80  }, baseBuildTimeSeconds: 50,  baseProductionPerHour: 0,  baseEnergyConsumption: 8,  prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
  research_lab:    { baseCost: { metal: 200,  gas: 100 }, baseBuildTimeSeconds: 90,  baseProductionPerHour: 0,  baseEnergyConsumption: 15, prerequisites: [{ buildingId: 'headquarters', level: 3 }] },
  shipyard:        { baseCost: { metal: 400,  gas: 200 }, baseBuildTimeSeconds: 120, baseProductionPerHour: 0,  baseEnergyConsumption: 20, prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
  radar_array:     { baseCost: { metal: 300,  gas: 200 }, baseBuildTimeSeconds: 90,  baseProductionPerHour: 0,  baseEnergyConsumption: 18, prerequisites: [{ buildingId: 'headquarters', level: 3 }] },
}

const SHIPS: Record<string, {
  cost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  requiredShipyardLevel: number
  requiredTech?: { techId: string; level: number }
}> = {
  probe:         { cost: { metal: 50,    gas: 0     }, baseBuildTimeSeconds: 20,   requiredShipyardLevel: 1  },
  small_fighter: { cost: { metal: 1200,  gas: 600   }, baseBuildTimeSeconds: 360,  requiredShipyardLevel: 2  },
  large_fighter: { cost: { metal: 3500,  gas: 2000  }, baseBuildTimeSeconds: 900,  requiredShipyardLevel: 4  },
  cruiser:       { cost: { metal: 8000,  gas: 5000  }, baseBuildTimeSeconds: 1800, requiredShipyardLevel: 6,  requiredTech: { techId: 'capital_ship_engineering', level: 1 } },
  gunship:       { cost: { metal: 15000, gas: 10000 }, baseBuildTimeSeconds: 3600, requiredShipyardLevel: 8,  requiredTech: { techId: 'capital_ship_engineering', level: 3 } },
  destroyer:     { cost: { metal: 30000, gas: 20000 }, baseBuildTimeSeconds: 7200, requiredShipyardLevel: 10, requiredTech: { techId: 'capital_ship_engineering', level: 5 } },
  harvester:     { cost: { metal: 2000,  gas: 800   }, baseBuildTimeSeconds: 600,  requiredShipyardLevel: 3  },
  small_cargo:   { cost: { metal: 800,   gas: 400   }, baseBuildTimeSeconds: 300,  requiredShipyardLevel: 2  },
  large_cargo:   { cost: { metal: 4000,  gas: 2000  }, baseBuildTimeSeconds: 900,  requiredShipyardLevel: 5  },
}

const SHIP_STATS: Record<string, { speed: number; cargo: number; attack: number; defense: number; miningYield: number }> = {
  probe:         { speed: 15, cargo: 0,     attack: 0,   defense: 1,   miningYield: 0  },
  small_fighter: { speed: 14, cargo: 50,    attack: 18,  defense: 10,  miningYield: 0  },
  large_fighter: { speed: 8,  cargo: 200,   attack: 55,  defense: 40,  miningYield: 0  },
  cruiser:       { speed: 7,  cargo: 400,   attack: 80,  defense: 70,  miningYield: 0  },
  gunship:       { speed: 5,  cargo: 300,   attack: 150, defense: 100, miningYield: 0  },
  destroyer:     { speed: 4,  cargo: 500,   attack: 300, defense: 200, miningYield: 0  },
  harvester:     { speed: 6,  cargo: 0,     attack: 2,   defense: 10,  miningYield: 15 },
  small_cargo:   { speed: 8,  cargo: 2000,  attack: 1,   defense: 8,   miningYield: 0  },
  large_cargo:   { speed: 5,  cargo: 10000, attack: 2,   defense: 15,  miningYield: 0  },
}

const MISSION_CONFIGS: Record<string, { requiredShips: string[]; minDurationSeconds: number }> = {
  mining:  { requiredShips: ['harvester'],     minDurationSeconds: 120 },
  raid:    { requiredShips: ['small_fighter'], minDurationSeconds: 90  },
  salvage: { requiredShips: ['small_cargo'],   minDurationSeconds: 60  },
}

const TECH_CONFIGS: Record<string, {
  baseCost: { metal: number; gas: number }
  baseTimeSeconds: number
  maxLevel: number
  requiredLabLevel: number
  prerequisites: { techId: string; level: number }[]
}> = {
  reinforced_hulls:         { baseCost: { metal: 400,  gas: 200  }, baseTimeSeconds: 300, maxLevel: 10, requiredLabLevel: 1, prerequisites: [] },
  advanced_weapons:         { baseCost: { metal: 500,  gas: 300  }, baseTimeSeconds: 360, maxLevel: 10, requiredLabLevel: 2, prerequisites: [] },
  capital_ship_engineering: { baseCost: { metal: 2000, gas: 1500 }, baseTimeSeconds: 900, maxLevel: 5,  requiredLabLevel: 4, prerequisites: [{ techId: 'reinforced_hulls', level: 3 }] },
  efficient_refining:       { baseCost: { metal: 300,  gas: 150  }, baseTimeSeconds: 240, maxLevel: 10, requiredLabLevel: 1, prerequisites: [] },
  deep_core_mining:         { baseCost: { metal: 500,  gas: 250  }, baseTimeSeconds: 360, maxLevel: 10, requiredLabLevel: 3, prerequisites: [{ techId: 'efficient_refining', level: 3 }] },
  expanded_storage:         { baseCost: { metal: 400,  gas: 200  }, baseTimeSeconds: 300, maxLevel: 10, requiredLabLevel: 2, prerequisites: [] },
  rapid_extraction:         { baseCost: { metal: 600,  gas: 400  }, baseTimeSeconds: 420, maxLevel: 10, requiredLabLevel: 4, prerequisites: [{ techId: 'deep_core_mining', level: 2 }] },
  long_range_sensors:       { baseCost: { metal: 350,  gas: 250  }, baseTimeSeconds: 300, maxLevel: 10, requiredLabLevel: 1, prerequisites: [] },
  probe_durability:         { baseCost: { metal: 200,  gas: 100  }, baseTimeSeconds: 180, maxLevel: 5,  requiredLabLevel: 2, prerequisites: [] },
  advanced_cartography:     { baseCost: { metal: 600,  gas: 500  }, baseTimeSeconds: 480, maxLevel: 5,  requiredLabLevel: 5, prerequisites: [{ techId: 'long_range_sensors', level: 4 }] },
  solar_efficiency:         { baseCost: { metal: 300,  gas: 200  }, baseTimeSeconds: 240, maxLevel: 10, requiredLabLevel: 1, prerequisites: [] },
  storm_hardening:          { baseCost: { metal: 800,  gas: 600  }, baseTimeSeconds: 600, maxLevel: 5,  requiredLabLevel: 3, prerequisites: [{ techId: 'solar_efficiency', level: 3 }] },
  fusion_theory:            { baseCost: { metal: 1000, gas: 800  }, baseTimeSeconds: 720, maxLevel: 10, requiredLabLevel: 5, prerequisites: [{ techId: 'solar_efficiency', level: 5 }] },
}

// Galaxy map location types and their spawn weights
const LOCATION_TYPES = [
  { type: 'asteroid_field', weight: 40, richness: () => Math.floor(Math.random() * 5) + 1 },
  { type: 'bandit_camp',    weight: 30, size: () => Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large' },
  { type: 'debris_field',   weight: 20, metal: () => Math.floor(Math.random() * 500 + 100) },
  { type: 'empty',          weight: 10 },
]
const TOTAL_LOCATION_WEIGHT = LOCATION_TYPES.reduce((s, t) => s + t.weight, 0)

const LOCATION_NAMES: Record<string, string[]> = {
  asteroid_field: ['Alpha Belt', 'Beta Cluster', 'Gamma Ridge', 'Delta Shoal', 'Epsilon Field', 'Zeta Expanse'],
  bandit_camp:    ['Bandit Outpost', 'Raider Base', 'Pirate Stronghold', 'Marauder Den', 'Outlaw Station'],
  debris_field:   ['Wreckage Field', 'Battle Debris', 'Scattered Ruins', 'Lost Fleet', 'Derelict Zone'],
  empty:          ['Empty Sector', 'Void Passage', 'Silent Drift', 'Dark Expanse'],
}

const BANDIT_FLEETS: Record<string, { name: string; ships: Record<string, { count: number; hp: number; attack: number; defense: number }> }> = {
  small:  { name: 'Small Bandit Patrol',  ships: { raider: { count: 3, hp: 20, attack: 8,  defense: 4  } } },
  medium: { name: 'Bandit Squadron',      ships: { raider: { count: 5, hp: 20, attack: 8,  defense: 4  }, gunship: { count: 2, hp: 50, attack: 20, defense: 12 } } },
  large:  { name: 'Bandit Armada',        ships: { raider: { count: 8, hp: 20, attack: 8,  defense: 4  }, gunship: { count: 4, hp: 50, attack: 20, defense: 12 }, destroyer: { count: 1, hp: 120, attack: 45, defense: 30 } } },
}

const DEV_RESOURCE_FLOOR = 10000

// ============================================================
// Utility helpers
// ============================================================

function parseCoord(coord: string): { galaxy: number; system: number; position: number } {
  const [g, s, p] = coord.split(':').map(Number)
  return { galaxy: g, system: s, position: p }
}

function coordDistance(a: string, b: string): number {
  const ca = parseCoord(a)
  const cb = parseCoord(b)
  return Math.abs(ca.system - cb.system) + Math.abs(ca.position - cb.position)
}

function fleetSlowestSpeed(fleet: Record<string, number>): number {
  let slowest = Infinity
  for (const [type, count] of Object.entries(fleet)) {
    if (count > 0 && SHIP_STATS[type]) slowest = Math.min(slowest, SHIP_STATS[type].speed)
  }
  return slowest === Infinity ? 1 : slowest
}

function fleetTotalStat(fleet: Record<string, number>, stat: 'attack' | 'defense' | 'cargo' | 'miningYield'): number {
  let total = 0
  for (const [type, count] of Object.entries(fleet)) {
    if (count > 0 && SHIP_STATS[type]) total += SHIP_STATS[type][stat] * count
  }
  return total
}

function rollLocationType(): string {
  let roll = Math.random() * TOTAL_LOCATION_WEIGHT
  for (const t of LOCATION_TYPES) {
    roll -= t.weight
    if (roll <= 0) return t.type
  }
  return 'empty'
}

function randomLocationName(locationType: string): string {
  const names = LOCATION_NAMES[locationType] ?? LOCATION_NAMES.empty
  const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  const num = Math.floor(Math.random() * 99) + 1
  return `${names[Math.floor(Math.random() * names.length)]} ${suffix}-${num}`
}

// deno-lint-ignore no-explicit-any
async function topUpDevResources(supabase: any, planetId: string) {
  const { data: planet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', planetId).single()
  await supabase.from('planets').update({
    metal_amount: Math.max(planet.metal_amount, DEV_RESOURCE_FLOOR),
    gas_amount: Math.max(planet.gas_amount, DEV_RESOURCE_FLOOR),
  }).eq('id', planetId)
}

// deno-lint-ignore no-explicit-any
async function recalculateResources(supabase: any, planetId: string): Promise<{ metal: number; gas: number }> {
  const { data: planet } = await supabase.from('planets').select('metal_amount, gas_amount, last_calculated_at').eq('id', planetId).single()
  const { data: buildings } = await supabase.from('planet_buildings').select('building_id, level').eq('planet_id', planetId)
  const { data: weather } = await supabase.from('planet_weather').select('metal_multiplier, gas_multiplier, energy_multiplier, expires_at').eq('planet_id', planetId).order('started_at', { ascending: false }).limit(1).single()

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
  const energyRatio = totalEnergyConsumed <= 0 ? 1 : Math.min(1, totalEnergyProduced / totalEnergyConsumed)

  const weatherActive = weather && (!weather.expires_at || new Date(weather.expires_at) > now)
  const metalMult = weatherActive ? Number(weather.metal_multiplier) : 1
  const gasMult = weatherActive ? Number(weather.gas_multiplier) : 1

  const newMetal = planet.metal_amount + totalMetalPerHour * energyRatio * metalMult * elapsed
  const newGas = planet.gas_amount + totalGasPerHour * energyRatio * gasMult * elapsed

  await supabase.from('planets').update({ metal_amount: newMetal, gas_amount: newGas, last_calculated_at: now.toISOString() }).eq('id', planetId)
  return { metal: newMetal, gas: newGas }
}

// ============================================================
// Combat resolver
// ============================================================

type CombatUnit = { type: string; hp: number; attack: number; defense: number }

function resolveCombat(
  attackerFleet: Record<string, number>,
  defenderShips: Record<string, { count: number; hp: number; attack: number; defense: number }>
) {
  const attackers: CombatUnit[] = []
  for (const [type, count] of Object.entries(attackerFleet)) {
    const stats = SHIP_STATS[type]
    if (!stats || count <= 0) continue
    for (let i = 0; i < count; i++) {
      attackers.push({ type, hp: stats.defense * 3, attack: stats.attack, defense: stats.defense })
    }
  }

  const defenders: CombatUnit[] = []
  for (const [type, info] of Object.entries(defenderShips)) {
    for (let i = 0; i < info.count; i++) {
      defenders.push({ type, hp: info.hp, attack: info.attack, defense: info.defense })
    }
  }

  // deno-lint-ignore no-explicit-any
  const rounds: any[] = []
  const attackerLosses: Record<string, number> = {}
  const defenderLosses: Record<string, number> = {}

  for (let round = 1; round <= 10; round++) {
    const aliveA = attackers.filter(u => u.hp > 0)
    const aliveD = defenders.filter(u => u.hp > 0)
    if (aliveA.length === 0 || aliveD.length === 0) break

    // deno-lint-ignore no-explicit-any
    const attackerFire: any[] = []
    // deno-lint-ignore no-explicit-any
    const defenderFire: any[] = []

    for (const a of aliveA) {
      const targets = defenders.filter(d => d.hp > 0)
      if (targets.length === 0) break
      const target = targets[Math.floor(Math.random() * targets.length)]
      const damage = Math.max(1, a.attack - Math.floor(target.defense * 0.3))
      target.hp -= damage
      const destroyed = target.hp <= 0
      attackerFire.push({ shipType: a.type, target: target.type, damage, destroyed })
      if (destroyed) defenderLosses[target.type] = (defenderLosses[target.type] ?? 0) + 1
    }

    for (const d of aliveD.filter(d => d.hp > 0)) {
      const targets = attackers.filter(u => u.hp > 0)
      if (targets.length === 0) break
      const target = targets[Math.floor(Math.random() * targets.length)]
      const damage = Math.max(1, d.attack - Math.floor(target.defense * 0.3))
      target.hp -= damage
      const destroyed = target.hp <= 0
      defenderFire.push({ shipType: d.type, target: target.type, damage, destroyed })
      if (destroyed) attackerLosses[target.type] = (attackerLosses[target.type] ?? 0) + 1
    }

    rounds.push({ round, attackerFire, defenderFire })
    if (defenders.filter(u => u.hp > 0).length === 0) break
    if (attackers.filter(u => u.hp > 0).length === 0) break
  }

  const victory = defenders.filter(u => u.hp > 0).length === 0
  return { victory, rounds, attackerLosses, defenderLosses }
}

// ============================================================
// Building handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleStartBuild(supabase: any, userId: string, planetId: string, buildingId: string, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: activeBuilds } = await supabase.from('construction_queue').select('id').eq('planet_id', planetId)
  if (activeBuilds && activeBuilds.length > 0) return new Response(JSON.stringify({ error: 'Construction queue is full' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: building } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', buildingId).single()
  if (!building) return new Response(JSON.stringify({ error: 'Building not found on planet' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const config = BUILDINGS[buildingId]
  if (!config) return new Response(JSON.stringify({ error: 'Unknown building type' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const targetLevel = building.level + 1
  if (targetLevel > 20) return new Response(JSON.stringify({ error: 'Building is at max level' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (config.prerequisites.length > 0) {
    const { data: allBuildings } = await supabase.from('planet_buildings').select('building_id, level').eq('planet_id', planetId)
    // deno-lint-ignore no-explicit-any
    const levelMap = new Map(allBuildings.map((b: any) => [b.building_id, b.level]))
    for (const prereq of config.prerequisites) {
      if ((levelMap.get(prereq.buildingId) ?? 0) < prereq.level) {
        return new Response(JSON.stringify({ error: `Requires ${prereq.buildingId} level ${prereq.level}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }
  }

  if (devMode) await topUpDevResources(supabase, planetId)
  const resources = await recalculateResources(supabase, planetId)
  const metalCost = upgradeCost(config.baseCost.metal, targetLevel)
  const gasCost = upgradeCost(config.baseCost.gas, targetLevel)
  if (resources.metal < metalCost || resources.gas < gasCost) {
    return new Response(JSON.stringify({ error: 'Insufficient resources', required: { metal: metalCost, gas: gasCost }, available: resources }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('planets').update({ metal_amount: resources.metal - metalCost, gas_amount: resources.gas - gasCost }).eq('id', planetId)

  const buildTime = devMode ? 10 : buildTimeSeconds(config.baseBuildTimeSeconds, targetLevel)
  const now = new Date()
  const completesAt = new Date(now.getTime() + buildTime * 1000)

  await supabase.from('construction_queue').insert({ planet_id: planetId, building_id: buildingId, target_level: targetLevel, started_at: now.toISOString(), completes_at: completesAt.toISOString() })
  await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'build_started', message: `Started upgrading ${buildingId} to level ${targetLevel}`, metadata: { building_id: buildingId, target_level: targetLevel } })

  return new Response(JSON.stringify({ success: true, completesAt: completesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleCompleteBuild(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()
  const { data: completedBuilds } = await supabase.from('construction_queue').select('*').eq('planet_id', planetId).lte('completes_at', now.toISOString())
  if (!completedBuilds || completedBuilds.length === 0) return new Response(JSON.stringify({ success: true, completed: [] }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  const completed = []
  // deno-lint-ignore no-explicit-any
  for (const build of completedBuilds as any[]) {
    await supabase.from('planet_buildings').update({ level: build.target_level, updated_at: now.toISOString() }).eq('planet_id', planetId).eq('building_id', build.building_id)
    await supabase.from('construction_queue').delete().eq('id', build.id)
    await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'build_completed', message: `${build.building_id} upgraded to level ${build.target_level}`, metadata: { building_id: build.building_id, level: build.target_level } })
    completed.push({ buildingId: build.building_id, level: build.target_level })
  }

  await recalculateResources(supabase, planetId)
  return new Response(JSON.stringify({ success: true, completed }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Ship build handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleStartShipBuild(supabase: any, userId: string, planetId: string, shipType: string, quantity: number, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const shipConfig = SHIPS[shipType]
  if (!shipConfig) return new Response(JSON.stringify({ error: 'Unknown ship type' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: activeShipBuilds } = await supabase.from('ship_queue').select('id').eq('planet_id', planetId)
  if (activeShipBuilds && activeShipBuilds.length > 0) return new Response(JSON.stringify({ error: 'Ship queue is full' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: shipyardBuilding } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', 'shipyard').single()
  const shipyardLevel = shipyardBuilding?.level ?? 0
  if (shipyardLevel < shipConfig.requiredShipyardLevel) {
    return new Response(JSON.stringify({ error: `Requires Shipyard level ${shipConfig.requiredShipyardLevel}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Check tech requirements for capital ships
  if (shipConfig.requiredTech) {
    const { data: techRow } = await supabase.from('player_technologies').select('level').eq('player_id', userId).eq('tech_id', shipConfig.requiredTech.techId).single()
    const techLevel = techRow?.level ?? 0
    if (techLevel < shipConfig.requiredTech.level) {
      return new Response(JSON.stringify({ error: `Requires ${shipConfig.requiredTech.techId} level ${shipConfig.requiredTech.level}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }

  if (devMode) await topUpDevResources(supabase, planetId)
  const resources = await recalculateResources(supabase, planetId)
  const metalCost = shipConfig.cost.metal * quantity
  const gasCost = shipConfig.cost.gas * quantity
  if (resources.metal < metalCost || resources.gas < gasCost) {
    return new Response(JSON.stringify({ error: 'Insufficient resources', required: { metal: metalCost, gas: gasCost }, available: resources }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('planets').update({ metal_amount: resources.metal - metalCost, gas_amount: resources.gas - gasCost }).eq('id', planetId)

  const buildTime = devMode ? 10 : shipBuildTimeSeconds(shipConfig.baseBuildTimeSeconds, shipyardLevel) * quantity
  const now = new Date()
  const completesAt = new Date(now.getTime() + buildTime * 1000)

  await supabase.from('ship_queue').insert({ planet_id: planetId, ship_type: shipType, quantity, started_at: now.toISOString(), completes_at: completesAt.toISOString() })
  await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'ship_build_started', message: `Started building ${quantity} ${shipType}`, metadata: { ship_type: shipType, quantity } })

  return new Response(JSON.stringify({ success: true, completesAt: completesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleCompleteShipBuild(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()
  const { data: completedBuilds } = await supabase.from('ship_queue').select('*').eq('planet_id', planetId).lte('completes_at', now.toISOString())
  if (!completedBuilds || completedBuilds.length === 0) return new Response(JSON.stringify({ success: true, completed: [] }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  const completed = []
  // deno-lint-ignore no-explicit-any
  for (const build of completedBuilds as any[]) {
    const { data: existing } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', build.ship_type).single()
    const currentCount = existing?.count ?? 0
    await supabase.from('planet_ships').upsert({ planet_id: planetId, ship_type: build.ship_type, count: currentCount + build.quantity, updated_at: now.toISOString() }, { onConflict: 'planet_id,ship_type' })
    await supabase.from('ship_queue').delete().eq('id', build.id)
    await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'ship_build_completed', message: `${build.quantity} ${build.ship_type} completed`, metadata: { ship_type: build.ship_type, quantity: build.quantity } })
    completed.push({ shipType: build.ship_type, quantity: build.quantity })
  }

  return new Response(JSON.stringify({ success: true, completed }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Galaxy Map handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleRunRadar(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id, coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: radarBuilding } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', 'radar_array').single()
  const radarLevel = radarBuilding?.level ?? 0
  if (radarLevel < 1) return new Response(JSON.stringify({ error: 'Radar Array not built' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const homeCoord = parseCoord(planet.coordinates)
  const detectCount = radarLevel * 3  // 3 detections per radar level per scan
  const now = new Date()
  const detected = []

  for (let i = 0; i < detectCount; i++) {
    const maxRange = radarLevel * 10
    const dir = Math.random() > 0.5 ? 1 : -1
    const sysOff = (Math.floor(Math.random() * maxRange) + 1) * dir
    const coords = `${homeCoord.galaxy}:${Math.max(1, homeCoord.system + sysOff)}:${Math.floor(Math.random() * 15) + 1}`

    await supabase.from('galaxy_map').upsert({
      player_id: userId,
      coordinates: coords,
      visibility: 'detected',
      detected_at: now.toISOString(),
    }, { onConflict: 'player_id,coordinates', ignoreDuplicates: true })  // don't overwrite revealed entries

    detected.push(coords)
  }

  await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'radar_scan', message: `Radar Array detected ${detected.length} coordinates`, metadata: { coordinates: detected } })

  return new Response(JSON.stringify({ success: true, detected: detected.length }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleSendProbe(supabase: any, userId: string, planetId: string, targetCoords: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check probe availability
  const { data: probeRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', 'probe').single()
  const probeCount = probeRow?.count ?? 0
  if (probeCount < 1) return new Response(JSON.stringify({ error: 'No probes available' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check galaxy_map entry exists
  const { data: mapEntry } = await supabase.from('galaxy_map').select('id, visibility').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (!mapEntry) return new Response(JSON.stringify({ error: 'Coordinate not detected — run Radar Array first' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (mapEntry.visibility === 'revealed') return new Response(JSON.stringify({ error: 'Already revealed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Consume probe (probes are not returned — consumed on use)
  await supabase.from('planet_ships').update({ count: probeCount - 1 }).eq('planet_id', planetId).eq('ship_type', 'probe')

  // Roll location type and reveal
  const locationType = rollLocationType()
  const name = randomLocationName(locationType)
  const now = new Date()

  // deno-lint-ignore no-explicit-any
  const metadata: Record<string, any> = {}
  if (locationType === 'asteroid_field') metadata.richness = Math.floor(Math.random() * 5) + 1
  if (locationType === 'bandit_camp') metadata.size = Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large'
  if (locationType === 'debris_field') metadata.salvage_metal = Math.floor(Math.random() * 800 + 200)

  await supabase.from('galaxy_map').update({
    visibility: 'revealed',
    location_type: locationType,
    name,
    metadata,
    revealed_at: now.toISOString(),
    cleared_at: null,
    respawns_at: null,
  }).eq('id', mapEntry.id)

  await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'probe_returned', message: `Probe revealed: ${name} at ${targetCoords}`, metadata: { coordinates: targetCoords, location_type: locationType, name } })

  return new Response(JSON.stringify({ success: true, location_type: locationType, name }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Research handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleStartResearch(supabase: any, userId: string, planetId: string, techId: string, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const tech = TECH_CONFIGS[techId]
  if (!tech) return new Response(JSON.stringify({ error: 'Unknown technology' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check: no active research
  const { data: activeResearch } = await supabase.from('research_queue').select('id').eq('player_id', userId)
  if (activeResearch && activeResearch.length > 0) return new Response(JSON.stringify({ error: 'Research already in progress' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check: research lab level
  const { data: labBuilding } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', 'research_lab').single()
  const labLevel = labBuilding?.level ?? 0
  if (labLevel < tech.requiredLabLevel) return new Response(JSON.stringify({ error: `Requires Research Lab level ${tech.requiredLabLevel}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check: current level and max
  const { data: techRow } = await supabase.from('player_technologies').select('level').eq('player_id', userId).eq('tech_id', techId).single()
  const currentLevel = techRow?.level ?? 0
  if (currentLevel >= tech.maxLevel) return new Response(JSON.stringify({ error: 'Technology is at max level' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check: prerequisites
  for (const prereq of tech.prerequisites) {
    const { data: prereqRow } = await supabase.from('player_technologies').select('level').eq('player_id', userId).eq('tech_id', prereq.techId).single()
    if ((prereqRow?.level ?? 0) < prereq.level) {
      return new Response(JSON.stringify({ error: `Requires ${prereq.techId} level ${prereq.level}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }

  if (devMode) await topUpDevResources(supabase, planetId)
  const resources = await recalculateResources(supabase, planetId)
  const targetLevel = currentLevel + 1
  const cost = researchCost(tech.baseCost.metal, tech.baseCost.gas, targetLevel)

  if (resources.metal < cost.metal || resources.gas < cost.gas) {
    return new Response(JSON.stringify({ error: 'Insufficient resources', required: cost, available: resources }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('planets').update({ metal_amount: resources.metal - cost.metal, gas_amount: resources.gas - cost.gas }).eq('id', planetId)

  const researchTime = devMode ? 10 : researchTimeSeconds(tech.baseTimeSeconds, targetLevel)
  const now = new Date()
  const completesAt = new Date(now.getTime() + researchTime * 1000)

  await supabase.from('research_queue').insert({ player_id: userId, tech_id: techId, target_level: targetLevel, started_at: now.toISOString(), completes_at: completesAt.toISOString() })
  await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'research_started', message: `Researching ${techId} to level ${targetLevel}`, metadata: { tech_id: techId, target_level: targetLevel } })

  return new Response(JSON.stringify({ success: true, completesAt: completesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleCompleteResearch(supabase: any, userId: string, cors: Record<string, string>) {
  const now = new Date()
  const { data: completedResearch } = await supabase.from('research_queue').select('*').eq('player_id', userId).lte('completes_at', now.toISOString())
  if (!completedResearch || completedResearch.length === 0) return new Response(JSON.stringify({ success: true, completed: [] }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  const completed = []
  // deno-lint-ignore no-explicit-any
  for (const r of completedResearch as any[]) {
    await supabase.from('player_technologies').upsert({ player_id: userId, tech_id: r.tech_id, level: r.target_level, updated_at: now.toISOString() }, { onConflict: 'player_id,tech_id' })
    await supabase.from('research_queue').delete().eq('id', r.id)
    completed.push({ techId: r.tech_id, level: r.target_level })
  }

  return new Response(JSON.stringify({ success: true, completed }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Mission handlers (v2)
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleDispatchMission(supabase: any, userId: string, planetId: string, missionType: string, fleet: Record<string, number>, targetCoords: string, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id, coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const mc = MISSION_CONFIGS[missionType]
  if (!mc) return new Response(JSON.stringify({ error: 'Unknown mission type' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Target must be a revealed galaxy_map entry
  const { data: mapEntry } = await supabase.from('galaxy_map').select('*').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (!mapEntry) return new Response(JSON.stringify({ error: 'Target not in galaxy map — send a probe first' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (mapEntry.visibility !== 'revealed') return new Response(JSON.stringify({ error: 'Target not yet revealed — send a probe first' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const hasRequired = mc.requiredShips.some((t: string) => (fleet[t] ?? 0) > 0)
  if (!hasRequired) return new Response(JSON.stringify({ error: `Requires at least one: ${mc.requiredShips.join(', ')}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: shipRows } = await supabase.from('planet_ships').select('ship_type, count').eq('planet_id', planetId)
  // deno-lint-ignore no-explicit-any
  const shipCounts = new Map((shipRows ?? []).map((r: any) => [r.ship_type, r.count]))

  for (const [type, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const avail = shipCounts.get(type) ?? 0
    if (avail < count) return new Response(JSON.stringify({ error: `Not enough ${type} (have ${avail}, need ${count})` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const distance = coordDistance(planet.coordinates, targetCoords)
  const speed = fleetSlowestSpeed(fleet)
  const travelSec = Math.ceil((distance / speed) * 60)
  const totalSec = devMode ? 10 : (travelSec + mc.minDurationSeconds + travelSec)

  const now = new Date()
  const arrivesAt = new Date(now.getTime() + (devMode ? 3000 : travelSec * 1000))
  const returnsAt = new Date(now.getTime() + totalSec * 1000)

  const targetName = mapEntry.name ?? targetCoords

  for (const [type, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const cur = shipCounts.get(type) ?? 0
    await supabase.from('planet_ships').update({ count: cur - count, updated_at: now.toISOString() }).eq('planet_id', planetId).eq('ship_type', type)
  }

  await supabase.from('missions').insert({ planet_id: planetId, mission_type: missionType, status: 'traveling', target_coords: targetCoords, target_name: targetName, fleet, dispatched_at: now.toISOString(), arrives_at: arrivesAt.toISOString(), returns_at: returnsAt.toISOString() })
  await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'mission_dispatched', message: `Fleet dispatched on ${missionType} to ${targetName}`, metadata: { mission_type: missionType, fleet, target: targetCoords } })

  return new Response(JSON.stringify({ success: true, returnsAt: returnsAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleResolveMission(supabase: any, userId: string, planetId: string, missionId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id, metal_amount, gas_amount').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: mission } = await supabase.from('missions').select('*').eq('id', missionId).eq('planet_id', planetId).single()
  if (!mission || mission.status === 'completed') return new Response(JSON.stringify({ error: 'Mission not found or already completed' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (new Date(mission.returns_at) > new Date()) return new Response(JSON.stringify({ error: 'Mission not yet returned' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const fleet: Record<string, number> = mission.fleet
  // deno-lint-ignore no-explicit-any
  let result: any = {}
  let survivingFleet: Record<string, number> = { ...fleet }
  const now = new Date()

  // Get galaxy_map entry for target
  const { data: mapEntry } = await supabase.from('galaxy_map').select('*').eq('player_id', userId).eq('coordinates', mission.target_coords).single()
  // deno-lint-ignore no-explicit-any
  const metadata: Record<string, any> = mapEntry?.metadata ?? {}

  if (mission.mission_type === 'mining') {
    const totalYield = fleetTotalStat(fleet, 'miningYield')
    const totalCargo = fleetTotalStat(fleet, 'cargo')
    const richness = metadata.richness ?? 1
    const base = totalYield * richness * 2
    result.rewards = {
      metal: Math.min(Math.floor(base), totalCargo),
      gas: Math.floor(base * 0.4),
    }
    result.encounter_type = 'mining'

  } else if (mission.mission_type === 'raid') {
    const size = (metadata.size as string) ?? 'small'
    const combat = resolveCombat(fleet, (BANDIT_FLEETS[size] ?? BANDIT_FLEETS.small).ships)
    result.combat_log = combat.rounds
    result.ships_lost = combat.attackerLosses
    result.encounter_type = 'raid'
    survivingFleet = { ...fleet }
    for (const [t, l] of Object.entries(combat.attackerLosses)) {
      survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)
    }

    if (combat.victory) {
      const mult = size === 'large' ? 5 : size === 'medium' ? 3 : 1
      result.rewards = {
        metal: Math.floor((Math.random() * 500 + 300) * mult),
        gas: Math.floor((Math.random() * 300 + 150) * mult),
      }
      // Mark location cleared, schedule respawn in 2–6 hours
      const respawnHours = 2 + Math.random() * 4
      if (mapEntry) {
        await supabase.from('galaxy_map').update({
          cleared_at: now.toISOString(),
          respawns_at: new Date(now.getTime() + respawnHours * 3600 * 1000).toISOString(),
          metadata: { ...metadata, size, respawn_size: size },
        }).eq('id', mapEntry.id)
      }
    } else {
      survivingFleet = Object.fromEntries(Object.keys(fleet).map(k => [k, 0]))
      result.rewards = { metal: 0, gas: 0 }
    }

  } else if (mission.mission_type === 'salvage') {
    const totalCargo = fleetTotalStat(fleet, 'cargo')
    const salvageMetal = metadata.salvage_metal ?? Math.floor(Math.random() * 400 + 100)
    result.rewards = {
      metal: Math.min(salvageMetal, totalCargo),
      gas: Math.floor(salvageMetal * 0.2),
    }
    result.encounter_type = 'salvage'
    // After salvage, mark as cleared
    if (mapEntry) {
      await supabase.from('galaxy_map').update({ cleared_at: now.toISOString(), respawns_at: null }).eq('id', mapEntry.id)
    }
  }

  // Return surviving ships
  const { data: curShips } = await supabase.from('planet_ships').select('ship_type, count').eq('planet_id', planetId)
  // deno-lint-ignore no-explicit-any
  const curCounts = new Map((curShips ?? []).map((r: any) => [r.ship_type, r.count]))
  for (const [type, count] of Object.entries(survivingFleet)) {
    if (count <= 0) continue
    const cur = curCounts.get(type) ?? 0
    await supabase.from('planet_ships').update({ count: cur + count, updated_at: now.toISOString() }).eq('planet_id', planetId).eq('ship_type', type)
  }

  // Add resources
  const rewards = result.rewards ?? { metal: 0, gas: 0 }
  if ((rewards.metal ?? 0) > 0 || (rewards.gas ?? 0) > 0) {
    await supabase.from('planets').update({ metal_amount: planet.metal_amount + (rewards.metal ?? 0), gas_amount: planet.gas_amount + (rewards.gas ?? 0) }).eq('id', planetId)
  }

  await supabase.from('missions').update({ status: 'completed', result }).eq('id', missionId)

  const shipsLost = result.ships_lost ? Object.values(result.ships_lost as Record<string, number>).reduce((a: number, b: number) => a + b, 0) : 0
  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'mission_completed',
    message: `${mission.mission_type} returned. +${rewards.metal ?? 0} metal, +${rewards.gas ?? 0} gas${shipsLost > 0 ? `. ${shipsLost} ships lost.` : ''}`,
    metadata: { mission_type: mission.mission_type, result, mission_id: missionId },
  })

  return new Response(JSON.stringify({ success: true, result }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
