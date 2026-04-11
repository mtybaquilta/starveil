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

    // Use service role key to validate the user JWT
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

    // Use admin client for all DB operations — ownership enforced via userId checks in handlers
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

    if (action === 'generate_sectors') {
      return await handleGenerateSectors(supabase, user.id, planetId, corsHeaders)
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

// --- Formula functions (mirrors src/config/formulas.ts) ---

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

// Building config (must mirror src/config/buildings.ts)
const BUILDINGS: Record<string, {
  baseCost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  baseProductionPerHour: number
  baseEnergyConsumption: number
  prerequisites: { buildingId: string; level: number }[]
}> = {
  headquarters: { baseCost: { metal: 100, gas: 50 }, baseBuildTimeSeconds: 60, baseProductionPerHour: 0, baseEnergyConsumption: 5, prerequisites: [] },
  metal_mine: { baseCost: { metal: 60, gas: 15 }, baseBuildTimeSeconds: 30, baseProductionPerHour: 30, baseEnergyConsumption: 10, prerequisites: [] },
  gas_refinery: { baseCost: { metal: 80, gas: 40 }, baseBuildTimeSeconds: 45, baseProductionPerHour: 20, baseEnergyConsumption: 12, prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
  solar_array: { baseCost: { metal: 50, gas: 25 }, baseBuildTimeSeconds: 30, baseProductionPerHour: 25, baseEnergyConsumption: 0, prerequisites: [] },
  metal_storage: { baseCost: { metal: 100, gas: 0 }, baseBuildTimeSeconds: 40, baseProductionPerHour: 0, baseEnergyConsumption: 3, prerequisites: [{ buildingId: 'metal_mine', level: 2 }] },
  gas_storage: { baseCost: { metal: 100, gas: 50 }, baseBuildTimeSeconds: 40, baseProductionPerHour: 0, baseEnergyConsumption: 3, prerequisites: [{ buildingId: 'gas_refinery', level: 2 }] },
  weather_station: { baseCost: { metal: 120, gas: 80 }, baseBuildTimeSeconds: 50, baseProductionPerHour: 0, baseEnergyConsumption: 8, prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
  research_lab: { baseCost: { metal: 200, gas: 100 }, baseBuildTimeSeconds: 90, baseProductionPerHour: 0, baseEnergyConsumption: 15, prerequisites: [{ buildingId: 'headquarters', level: 3 }] },
  shipyard: { baseCost: { metal: 400, gas: 200 }, baseBuildTimeSeconds: 120, baseProductionPerHour: 0, baseEnergyConsumption: 20, prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
}

// Ship config (must mirror src/config/ships.ts)
const SHIPS: Record<string, {
  cost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  requiredShipyardLevel: number
}> = {
  probe: { cost: { metal: 100, gas: 0 }, baseBuildTimeSeconds: 30, requiredShipyardLevel: 1 },
  scout: { cost: { metal: 300, gas: 100 }, baseBuildTimeSeconds: 90, requiredShipyardLevel: 2 },
  explorer: { cost: { metal: 800, gas: 400 }, baseBuildTimeSeconds: 240, requiredShipyardLevel: 4 },
  small_fighter: { cost: { metal: 1200, gas: 600 }, baseBuildTimeSeconds: 360, requiredShipyardLevel: 5 },
  large_fighter: { cost: { metal: 3500, gas: 2000 }, baseBuildTimeSeconds: 900, requiredShipyardLevel: 8 },
  transport: { cost: { metal: 2000, gas: 1000 }, baseBuildTimeSeconds: 600, requiredShipyardLevel: 3 },
}

const DEV_RESOURCE_FLOOR = 10000

// deno-lint-ignore no-explicit-any
async function topUpDevResources(supabase: any, planetId: string) {
  const { data: planet } = await supabase
    .from('planets')
    .select('metal_amount, gas_amount')
    .eq('id', planetId)
    .single()

  const newMetal = Math.max(planet.metal_amount, DEV_RESOURCE_FLOOR)
  const newGas = Math.max(planet.gas_amount, DEV_RESOURCE_FLOOR)

  await supabase
    .from('planets')
    .update({ metal_amount: newMetal, gas_amount: newGas })
    .eq('id', planetId)
}

// deno-lint-ignore no-explicit-any
async function recalculateResources(supabase: any, planetId: string) {
  const { data: planet } = await supabase
    .from('planets')
    .select('metal_amount, gas_amount, last_calculated_at')
    .eq('id', planetId)
    .single()

  const { data: buildings } = await supabase
    .from('planet_buildings')
    .select('building_id, level')
    .eq('planet_id', planetId)

  const { data: weather } = await supabase
    .from('planet_weather')
    .select('metal_multiplier, gas_multiplier, energy_multiplier, expires_at')
    .eq('planet_id', planetId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  const now = new Date()
  const elapsed = (now.getTime() - new Date(planet.last_calculated_at).getTime()) / (1000 * 3600)

  let totalMetalPerHour = 0
  let totalGasPerHour = 0
  let totalEnergyProduced = 0
  let totalEnergyConsumed = 0

  // deno-lint-ignore no-explicit-any
  const buildingMap = new Map(buildings.map((b: any) => [b.building_id, b.level]))

  for (const [id, level] of buildingMap) {
    const config = BUILDINGS[id as string]
    if (!config) continue
    if (id === 'metal_mine') totalMetalPerHour += productionPerHour(config.baseProductionPerHour, level as number)
    if (id === 'gas_refinery') totalGasPerHour += productionPerHour(config.baseProductionPerHour, level as number)
    if (id === 'solar_array') totalEnergyProduced += productionPerHour(config.baseProductionPerHour, level as number)
    totalEnergyConsumed += energyConsumption(config.baseEnergyConsumption, level as number)
  }

  // Base production floor — prevents getting stuck with zero resources
  totalMetalPerHour = Math.max(totalMetalPerHour, BASE_METAL_PRODUCTION)
  totalGasPerHour = Math.max(totalGasPerHour, BASE_GAS_PRODUCTION)

  const energyRatio = totalEnergyConsumed <= 0 ? 1 : Math.min(1, totalEnergyProduced / totalEnergyConsumed)

  const weatherActive = weather && (!weather.expires_at || new Date(weather.expires_at) > now)
  const metalMult = weatherActive ? Number(weather.metal_multiplier) : 1
  const gasMult = weatherActive ? Number(weather.gas_multiplier) : 1

  const newMetal = planet.metal_amount + totalMetalPerHour * energyRatio * metalMult * elapsed
  const newGas = planet.gas_amount + totalGasPerHour * energyRatio * gasMult * elapsed

  await supabase
    .from('planets')
    .update({
      metal_amount: newMetal,
      gas_amount: newGas,
      last_calculated_at: now.toISOString(),
    })
    .eq('id', planetId)

  return { metal: newMetal, gas: newGas }
}

// deno-lint-ignore no-explicit-any
async function handleStartBuild(supabase: any, userId: string, planetId: string, buildingId: string, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets')
    .select('id, player_id')
    .eq('id', planetId)
    .eq('player_id', userId)
    .single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: activeBuilds } = await supabase
    .from('construction_queue')
    .select('id')
    .eq('planet_id', planetId)

  if (activeBuilds && activeBuilds.length > 0) {
    return new Response(JSON.stringify({ error: 'Construction queue is full' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: building } = await supabase
    .from('planet_buildings')
    .select('level')
    .eq('planet_id', planetId)
    .eq('building_id', buildingId)
    .single()

  if (!building) {
    return new Response(JSON.stringify({ error: 'Building not found on planet' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const config = BUILDINGS[buildingId]
  if (!config) {
    return new Response(JSON.stringify({ error: 'Unknown building type' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const targetLevel = building.level + 1
  if (targetLevel > 20) {
    return new Response(JSON.stringify({ error: 'Building is at max level' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (config.prerequisites.length > 0) {
    const { data: allBuildings } = await supabase
      .from('planet_buildings')
      .select('building_id, level')
      .eq('planet_id', planetId)

    // deno-lint-ignore no-explicit-any
    const levelMap = new Map(allBuildings.map((b: any) => [b.building_id, b.level]))

    for (const prereq of config.prerequisites) {
      const currentLevel = levelMap.get(prereq.buildingId) ?? 0
      if (currentLevel < prereq.level) {
        return new Response(JSON.stringify({ error: `Requires ${prereq.buildingId} level ${prereq.level}` }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  if (devMode) await topUpDevResources(supabase, planetId)
  const resources = await recalculateResources(supabase, planetId)

  const metalCost = upgradeCost(config.baseCost.metal, targetLevel)
  const gasCost = upgradeCost(config.baseCost.gas, targetLevel)

  if (resources.metal < metalCost || resources.gas < gasCost) {
    return new Response(JSON.stringify({
      error: 'Insufficient resources',
      required: { metal: metalCost, gas: gasCost },
      available: resources,
    }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  await supabase
    .from('planets')
    .update({
      metal_amount: resources.metal - metalCost,
      gas_amount: resources.gas - gasCost,
    })
    .eq('id', planetId)

  const buildTime = devMode ? 10 : buildTimeSeconds(config.baseBuildTimeSeconds, targetLevel)
  const now = new Date()
  const completesAt = new Date(now.getTime() + buildTime * 1000)

  await supabase.from('construction_queue').insert({
    planet_id: planetId,
    building_id: buildingId,
    target_level: targetLevel,
    started_at: now.toISOString(),
    completes_at: completesAt.toISOString(),
  })

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'build_started',
    message: `Started upgrading ${buildingId} to level ${targetLevel}`,
    metadata: { building_id: buildingId, target_level: targetLevel },
  })

  return new Response(JSON.stringify({ success: true, completesAt: completesAt.toISOString() }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function handleCompleteBuild(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets')
    .select('id')
    .eq('id', planetId)
    .eq('player_id', userId)
    .single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()
  const { data: completedBuilds } = await supabase
    .from('construction_queue')
    .select('*')
    .eq('planet_id', planetId)
    .lte('completes_at', now.toISOString())

  if (!completedBuilds || completedBuilds.length === 0) {
    return new Response(JSON.stringify({ success: true, completed: [] }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const completed = []

  // deno-lint-ignore no-explicit-any
  for (const build of completedBuilds as any[]) {
    await supabase
      .from('planet_buildings')
      .update({ level: build.target_level, updated_at: now.toISOString() })
      .eq('planet_id', planetId)
      .eq('building_id', build.building_id)

    await supabase
      .from('construction_queue')
      .delete()
      .eq('id', build.id)

    await supabase.from('planet_events').insert({
      planet_id: planetId,
      event_type: 'build_completed',
      message: `${build.building_id} upgraded to level ${build.target_level}`,
      metadata: { building_id: build.building_id, level: build.target_level },
    })

    completed.push({ buildingId: build.building_id, level: build.target_level })
  }

  await recalculateResources(supabase, planetId)

  return new Response(JSON.stringify({ success: true, completed }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function handleStartShipBuild(supabase: any, userId: string, planetId: string, shipType: string, quantity: number, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets')
    .select('id, player_id')
    .eq('id', planetId)
    .eq('player_id', userId)
    .single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const shipConfig = SHIPS[shipType]
  if (!shipConfig) {
    return new Response(JSON.stringify({ error: 'Unknown ship type' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: activeShipBuilds } = await supabase
    .from('ship_queue')
    .select('id')
    .eq('planet_id', planetId)

  if (activeShipBuilds && activeShipBuilds.length > 0) {
    return new Response(JSON.stringify({ error: 'Ship queue is full' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: shipyardBuilding } = await supabase
    .from('planet_buildings')
    .select('level')
    .eq('planet_id', planetId)
    .eq('building_id', 'shipyard')
    .single()

  const shipyardLevel = shipyardBuilding?.level ?? 0

  if (shipyardLevel < shipConfig.requiredShipyardLevel) {
    return new Response(JSON.stringify({ error: `Requires Shipyard level ${shipConfig.requiredShipyardLevel}` }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (devMode) await topUpDevResources(supabase, planetId)
  const resources = await recalculateResources(supabase, planetId)

  const metalCost = shipConfig.cost.metal * quantity
  const gasCost = shipConfig.cost.gas * quantity

  if (resources.metal < metalCost || resources.gas < gasCost) {
    return new Response(JSON.stringify({
      error: 'Insufficient resources',
      required: { metal: metalCost, gas: gasCost },
      available: resources,
    }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  await supabase
    .from('planets')
    .update({
      metal_amount: resources.metal - metalCost,
      gas_amount: resources.gas - gasCost,
    })
    .eq('id', planetId)

  const buildTime = devMode ? 10 : shipBuildTimeSeconds(shipConfig.baseBuildTimeSeconds, shipyardLevel) * quantity
  const now = new Date()
  const completesAt = new Date(now.getTime() + buildTime * 1000)

  await supabase.from('ship_queue').insert({
    planet_id: planetId,
    ship_type: shipType,
    quantity,
    started_at: now.toISOString(),
    completes_at: completesAt.toISOString(),
  })

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'ship_build_started',
    message: `Started building ${quantity} ${shipType}`,
    metadata: { ship_type: shipType, quantity },
  })

  return new Response(JSON.stringify({ success: true, completesAt: completesAt.toISOString() }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function handleCompleteShipBuild(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets')
    .select('id')
    .eq('id', planetId)
    .eq('player_id', userId)
    .single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()
  const { data: completedBuilds } = await supabase
    .from('ship_queue')
    .select('*')
    .eq('planet_id', planetId)
    .lte('completes_at', now.toISOString())

  if (!completedBuilds || completedBuilds.length === 0) {
    return new Response(JSON.stringify({ success: true, completed: [] }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const completed = []

  // deno-lint-ignore no-explicit-any
  for (const build of completedBuilds as any[]) {
    const { data: existing } = await supabase
      .from('planet_ships')
      .select('count')
      .eq('planet_id', planetId)
      .eq('ship_type', build.ship_type)
      .single()

    const currentCount = existing?.count ?? 0

    await supabase
      .from('planet_ships')
      .upsert({
        planet_id: planetId,
        ship_type: build.ship_type,
        count: currentCount + build.quantity,
        updated_at: now.toISOString(),
      }, { onConflict: 'planet_id,ship_type' })

    await supabase
      .from('ship_queue')
      .delete()
      .eq('id', build.id)

    await supabase.from('planet_events').insert({
      planet_id: planetId,
      event_type: 'ship_build_completed',
      message: `${build.quantity} ${build.ship_type} completed`,
      metadata: { ship_type: build.ship_type, quantity: build.quantity },
    })

    completed.push({ shipType: build.ship_type, quantity: build.quantity })
  }

  return new Response(JSON.stringify({ success: true, completed }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// ==================== MISSION SYSTEM ====================

const SECTOR_NAMES_PREFIX = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Theta', 'Kappa', 'Sigma', 'Omega']
const SECTOR_NAMES_SUFFIX = ['Drift', 'Reach', 'Expanse', 'Void', 'Belt', 'Cluster', 'Field', 'Nebula', 'Ridge', 'Shoal']
const SECTOR_TYPES = ['asteroid_field', 'nebula', 'debris_field']

const MISSION_CONFIGS: Record<string, {
  requiredShips: string[]; minDurationSeconds: number; discoversLocations: boolean
}> = {
  mining: { requiredShips: ['transport', 'explorer'], minDurationSeconds: 120, discoversLocations: false },
  scout_patrol: { requiredShips: ['scout'], minDurationSeconds: 60, discoversLocations: true },
  expedition: { requiredShips: ['explorer'], minDurationSeconds: 180, discoversLocations: true },
  raid: { requiredShips: ['small_fighter', 'large_fighter'], minDurationSeconds: 90, discoversLocations: false },
}

const SHIP_STATS: Record<string, { speed: number; cargo: number; attack: number; defense: number; miningYield: number }> = {
  probe:          { speed: 8,  cargo: 0,    attack: 0,  defense: 1,  miningYield: 0 },
  scout:          { speed: 12, cargo: 100,  attack: 2,  defense: 3,  miningYield: 0 },
  explorer:       { speed: 9,  cargo: 500,  attack: 5,  defense: 8,  miningYield: 5 },
  small_fighter:  { speed: 14, cargo: 50,   attack: 18, defense: 10, miningYield: 0 },
  large_fighter:  { speed: 8,  cargo: 200,  attack: 55, defense: 40, miningYield: 0 },
  transport:      { speed: 5,  cargo: 5000, attack: 2,  defense: 15, miningYield: 10 },
}

const BANDIT_FLEETS_MISSION: Record<string, { name: string; ships: Record<string, { count: number; hp: number; attack: number; defense: number }> }> = {
  small: { name: 'Small Bandit Patrol', ships: { raider: { count: 3, hp: 20, attack: 8, defense: 4 } } },
  medium: { name: 'Bandit Squadron', ships: { raider: { count: 5, hp: 20, attack: 8, defense: 4 }, gunship: { count: 2, hp: 50, attack: 20, defense: 12 } } },
  large: { name: 'Bandit Armada', ships: { raider: { count: 8, hp: 20, attack: 8, defense: 4 }, gunship: { count: 4, hp: 50, attack: 20, defense: 12 }, destroyer: { count: 1, hp: 120, attack: 45, defense: 30 } } },
}

const EXPEDITION_WEIGHTS: Record<string, number> = { mining_site: 30, bandits: 25, asteroid: 20, nothing: 25 }

function randomSectorName(): string {
  const p = SECTOR_NAMES_PREFIX[Math.floor(Math.random() * SECTOR_NAMES_PREFIX.length)]
  const s = SECTOR_NAMES_SUFFIX[Math.floor(Math.random() * SECTOR_NAMES_SUFFIX.length)]
  return `${p} ${s}`
}

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

function weightedRandom(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (const [key, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) return key
  }
  return Object.keys(weights)[0]
}

// --- Combat Resolver ---

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
    const aliveAttackers = attackers.filter(u => u.hp > 0)
    const aliveDefenders = defenders.filter(u => u.hp > 0)
    if (aliveAttackers.length === 0 || aliveDefenders.length === 0) break

    // deno-lint-ignore no-explicit-any
    const attackerFire: any[] = []
    // deno-lint-ignore no-explicit-any
    const defenderFire: any[] = []

    for (const a of aliveAttackers) {
      const t = aliveDefenders.filter(d => d.hp > 0)
      if (t.length === 0) break
      const target = t[Math.floor(Math.random() * t.length)]
      const damage = Math.max(1, a.attack - Math.floor(target.defense * 0.3))
      target.hp -= damage
      const destroyed = target.hp <= 0
      attackerFire.push({ shipType: a.type, target: target.type, damage, destroyed })
      if (destroyed) defenderLosses[target.type] = (defenderLosses[target.type] ?? 0) + 1
    }

    const stillAlive = attackers.filter(u => u.hp > 0)
    for (const d of aliveDefenders.filter(d => d.hp > 0)) {
      if (stillAlive.filter(u => u.hp > 0).length === 0) break
      const targets = stillAlive.filter(u => u.hp > 0)
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

// --- Mission Handlers ---

// deno-lint-ignore no-explicit-any
async function handleGenerateSectors(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets')
    .select('id, player_id, coordinates')
    .eq('id', planetId)
    .eq('player_id', userId)
    .single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  await supabase.from('nearby_sectors').delete().eq('planet_id', planetId).lte('expires_at', new Date().toISOString())

  const { data: existing } = await supabase
    .from('nearby_sectors').select('id').eq('planet_id', planetId).gte('expires_at', new Date().toISOString())

  if (existing && existing.length >= 5) {
    return new Response(JSON.stringify({ success: true, message: 'Sectors already fresh' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const homeCoord = parseCoord(planet.coordinates)
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
  const sectors = []
  for (let i = 0; i < 5; i++) {
    const dist = Math.floor(Math.random() * 46) + 5
    const dir = Math.random() > 0.5 ? 1 : -1
    const coords = `${homeCoord.galaxy}:${Math.max(1, homeCoord.system + dist * dir)}:${Math.floor(Math.random() * 15) + 1}`
    sectors.push({
      planet_id: planetId, coordinates: coords, name: randomSectorName(),
      sector_type: SECTOR_TYPES[Math.floor(Math.random() * SECTOR_TYPES.length)],
      distance: dist, richness: Math.floor(Math.random() * 5) + 1,
      danger_level: Math.floor(Math.random() * 6), expires_at: expiresAt,
    })
  }

  await supabase.from('nearby_sectors').upsert(sectors, { onConflict: 'planet_id,coordinates' })

  return new Response(JSON.stringify({ success: true, generated: sectors.length }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function handleDispatchMission(supabase: any, userId: string, planetId: string, missionType: string, fleet: Record<string, number>, targetCoords: string, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets').select('id, player_id, coordinates').eq('id', planetId).eq('player_id', userId).single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const mc = MISSION_CONFIGS[missionType]
  if (!mc) {
    return new Response(JSON.stringify({ error: 'Unknown mission type' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const hasRequired = mc.requiredShips.some((t: string) => (fleet[t] ?? 0) > 0)
  if (!hasRequired) {
    return new Response(JSON.stringify({ error: `Requires at least one: ${mc.requiredShips.join(', ')}` }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: shipRows } = await supabase.from('planet_ships').select('ship_type, count').eq('planet_id', planetId)
  // deno-lint-ignore no-explicit-any
  const shipCounts = new Map((shipRows ?? []).map((r: any) => [r.ship_type, r.count]))

  for (const [type, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const avail = shipCounts.get(type) ?? 0
    if (avail < count) {
      return new Response(JSON.stringify({ error: `Not enough ${type} (have ${avail}, need ${count})` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  }

  const distance = coordDistance(planet.coordinates, targetCoords)
  const speed = fleetSlowestSpeed(fleet)
  const travelSec = Math.ceil((distance / speed) * 60)
  const totalSec = devMode ? 10 : (travelSec + mc.minDurationSeconds + travelSec)

  const now = new Date()
  const arrivesAt = new Date(now.getTime() + (devMode ? 3000 : travelSec * 1000))
  const returnsAt = new Date(now.getTime() + totalSec * 1000)

  let targetName = targetCoords
  const { data: sector } = await supabase.from('nearby_sectors').select('name').eq('planet_id', planetId).eq('coordinates', targetCoords).single()
  if (sector) targetName = sector.name
  const { data: loc } = await supabase.from('known_locations').select('name').eq('planet_id', planetId).eq('coordinates', targetCoords).single()
  if (loc) targetName = loc.name

  for (const [type, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const cur = shipCounts.get(type) ?? 0
    await supabase.from('planet_ships').update({ count: cur - count, updated_at: now.toISOString() }).eq('planet_id', planetId).eq('ship_type', type)
  }

  await supabase.from('missions').insert({
    planet_id: planetId, mission_type: missionType, status: 'traveling',
    target_coords: targetCoords, target_name: targetName, fleet,
    dispatched_at: now.toISOString(), arrives_at: arrivesAt.toISOString(), returns_at: returnsAt.toISOString(),
  })

  await supabase.from('planet_events').insert({
    planet_id: planetId, event_type: 'mission_dispatched',
    message: `Fleet dispatched on ${missionType} to ${targetName}`,
    metadata: { mission_type: missionType, fleet, target: targetCoords },
  })

  return new Response(JSON.stringify({ success: true, returnsAt: returnsAt.toISOString() }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function handleResolveMission(supabase: any, userId: string, planetId: string, missionId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase
    .from('planets').select('id, player_id, coordinates, metal_amount, gas_amount').eq('id', planetId).eq('player_id', userId).single()

  if (!planet) {
    return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { data: mission } = await supabase.from('missions').select('*').eq('id', missionId).eq('planet_id', planetId).single()

  if (!mission || mission.status === 'completed') {
    return new Response(JSON.stringify({ error: 'Mission not found or already completed' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (new Date(mission.returns_at) > new Date()) {
    return new Response(JSON.stringify({ error: 'Mission not yet returned' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const fleet: Record<string, number> = mission.fleet
  // deno-lint-ignore no-explicit-any
  let result: any = {}
  let survivingFleet: Record<string, number> = { ...fleet }
  const now = new Date()

  if (mission.mission_type === 'mining') {
    const totalYield = fleetTotalStat(fleet, 'miningYield')
    const totalCargo = fleetTotalStat(fleet, 'cargo')

    const { data: sector } = await supabase.from('nearby_sectors').select('danger_level, richness').eq('planet_id', planetId).eq('coordinates', mission.target_coords).single()
    const dangerLevel = sector?.danger_level ?? 0
    const richness = sector?.richness ?? 1

    if (Math.random() < dangerLevel * 0.1) {
      const enemySize = dangerLevel <= 2 ? 'small' : dangerLevel <= 4 ? 'medium' : 'large'
      const combat = resolveCombat(fleet, BANDIT_FLEETS_MISSION[enemySize].ships)
      result.combat_log = combat.rounds
      result.ships_lost = combat.attackerLosses
      result.encounter_type = 'ambush'
      survivingFleet = { ...fleet }
      for (const [t, l] of Object.entries(combat.attackerLosses)) survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)
      const base = totalYield * richness * 2
      const mult = combat.victory ? 1.0 : 0.3
      result.rewards = { metal: Math.min(Math.floor(base * mult), totalCargo), gas: Math.floor(base * 0.4 * mult) }
    } else {
      const base = totalYield * richness * 2
      result.rewards = { metal: Math.min(Math.floor(base), totalCargo), gas: Math.floor(base * 0.4) }
    }

  } else if (mission.mission_type === 'scout_patrol') {
    result = { encounter_type: 'patrol', rewards: { metal: Math.floor(Math.random() * 50 + 10), gas: Math.floor(Math.random() * 20 + 5) } }

    if (Math.random() < 0.5) {
      const hc = parseCoord(planet.coordinates)
      const off = Math.floor(Math.random() * 30) + 10
      const d = Math.random() > 0.5 ? 1 : -1
      const nc = `${hc.galaxy}:${Math.max(1, hc.system + off * d)}:${Math.floor(Math.random() * 15) + 1}`
      const ln = `Bandit Camp ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 99) + 1}`
      const sz = Math.random() < 0.4 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large'
      await supabase.from('known_locations').upsert({ planet_id: planetId, coordinates: nc, name: ln, location_type: 'bandit_camp', metadata: { size: sz, discovered_by: 'scout_patrol' } }, { onConflict: 'planet_id,coordinates' })
      result.discovered = { coordinates: nc, name: ln, type: 'bandit_camp' }
    }

    if (Math.random() < 0.2) {
      const combat = resolveCombat(fleet, BANDIT_FLEETS_MISSION.small.ships)
      result.combat_log = combat.rounds
      result.ships_lost = combat.attackerLosses
      result.encounter_type = 'skirmish'
      survivingFleet = { ...fleet }
      for (const [t, l] of Object.entries(combat.attackerLosses)) survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)
    }

  } else if (mission.mission_type === 'expedition') {
    const encounter = weightedRandom(EXPEDITION_WEIGHTS)
    result.encounter_type = encounter
    const hc = parseCoord(planet.coordinates)

    if (encounter === 'mining_site') {
      const cargo = fleetTotalStat(fleet, 'cargo')
      result.rewards = { metal: Math.floor(cargo * 0.6), gas: Math.floor(cargo * 0.3) }
      const off = Math.floor(Math.random() * 40) + 15
      const d = Math.random() > 0.5 ? 1 : -1
      const nc = `${hc.galaxy}:${Math.max(1, hc.system + off * d)}:${Math.floor(Math.random() * 15) + 1}`
      const ln = `Rich ${['Asteroid', 'Mineral', 'Crystal'][Math.floor(Math.random() * 3)]} Field`
      await supabase.from('known_locations').upsert({ planet_id: planetId, coordinates: nc, name: ln, location_type: 'asteroid_field', metadata: { richness: Math.floor(Math.random() * 3) + 3, discovered_by: 'expedition' } }, { onConflict: 'planet_id,coordinates' })
      result.discovered = { coordinates: nc, name: ln, type: 'asteroid_field' }

    } else if (encounter === 'bandits') {
      const sz = Math.random() < 0.5 ? 'small' : 'medium'
      const combat = resolveCombat(fleet, BANDIT_FLEETS_MISSION[sz].ships)
      result.combat_log = combat.rounds; result.ships_lost = combat.attackerLosses
      survivingFleet = { ...fleet }
      for (const [t, l] of Object.entries(combat.attackerLosses)) survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)
      result.rewards = combat.victory ? { metal: Math.floor(Math.random() * 500 + 200), gas: Math.floor(Math.random() * 300 + 100) } : { metal: 0, gas: 0 }
      if (combat.victory) {
        const off = Math.floor(Math.random() * 30) + 10
        const d = Math.random() > 0.5 ? 1 : -1
        const nc = `${hc.galaxy}:${Math.max(1, hc.system + off * d)}:${Math.floor(Math.random() * 15) + 1}`
        const ln = `Bandit Outpost ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 99) + 1}`
        await supabase.from('known_locations').upsert({ planet_id: planetId, coordinates: nc, name: ln, location_type: 'bandit_camp', metadata: { size: sz, discovered_by: 'expedition' } }, { onConflict: 'planet_id,coordinates' })
        result.discovered = { coordinates: nc, name: ln, type: 'bandit_camp' }
      }

    } else if (encounter === 'asteroid') {
      const combat = resolveCombat(fleet, { asteroid: { count: 1, hp: 80, attack: 0, defense: 15 } })
      result.combat_log = combat.rounds; result.ships_lost = combat.attackerLosses
      survivingFleet = { ...fleet }
      for (const [t, l] of Object.entries(combat.attackerLosses)) survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)
      result.rewards = combat.victory ? { metal: Math.floor(Math.random() * 800 + 400), gas: Math.floor(Math.random() * 400 + 200) } : { metal: 0, gas: 0 }

    } else {
      result.rewards = { metal: Math.floor(Math.random() * 80 + 20), gas: Math.floor(Math.random() * 30 + 10) }
    }

  } else if (mission.mission_type === 'raid') {
    const { data: location } = await supabase.from('known_locations').select('*').eq('planet_id', planetId).eq('coordinates', mission.target_coords).single()
    const size = (location?.metadata as Record<string, unknown>)?.size as string ?? 'small'
    const combat = resolveCombat(fleet, (BANDIT_FLEETS_MISSION[size] ?? BANDIT_FLEETS_MISSION.small).ships)
    result.combat_log = combat.rounds; result.ships_lost = combat.attackerLosses; result.encounter_type = 'raid'
    survivingFleet = { ...fleet }
    for (const [t, l] of Object.entries(combat.attackerLosses)) survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)

    if (combat.victory) {
      const mult = size === 'large' ? 5 : size === 'medium' ? 3 : 1
      result.rewards = { metal: Math.floor((Math.random() * 500 + 300) * mult), gas: Math.floor((Math.random() * 300 + 150) * mult) }
      if (location) await supabase.from('known_locations').delete().eq('id', location.id)
    } else {
      survivingFleet = Object.fromEntries(Object.keys(fleet).map(k => [k, 0]))
      result.rewards = { metal: 0, gas: 0 }
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
    await supabase.from('planets').update({
      metal_amount: planet.metal_amount + (rewards.metal ?? 0),
      gas_amount: planet.gas_amount + (rewards.gas ?? 0),
    }).eq('id', planetId)
  }

  await supabase.from('missions').update({ status: 'completed', result }).eq('id', missionId)

  const shipsLost = result.ships_lost ? Object.values(result.ships_lost as Record<string, number>).reduce((a: number, b: number) => a + b, 0) : 0
  await supabase.from('planet_events').insert({
    planet_id: planetId, event_type: 'mission_completed',
    message: `${mission.mission_type} returned. +${rewards.metal ?? 0} metal, +${rewards.gas ?? 0} gas${shipsLost > 0 ? `. ${shipsLost} ships lost.` : ''}`,
    metadata: { mission_type: mission.mission_type, result },
  })

  return new Response(JSON.stringify({ success: true, result }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
