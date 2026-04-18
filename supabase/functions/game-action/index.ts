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
    if (action === 'rotate_weather') {
      return await handleRotateWeather(supabase, user.id, planetId, corsHeaders)
    }
    if (action === 'scrap_ship') {
      return await handleScrapShip(supabase, user.id, planetId, shipType, corsHeaders)
    }
    if (action === 'dispatch_colonize') {
      return await handleDispatchColonize(supabase, user.id, planetId, body.targetCoords, !!devMode, corsHeaders)
    }
    if (action === 'resolve_colonize') {
      return await handleResolveColonize(supabase, user.id, body.missionId, corsHeaders)
    }
    if (action === 'rename_planet') {
      return await handleRenamePlanet(supabase, user.id, planetId, body.newName, corsHeaders)
    }
    if (action === 'dispatch_transfer') {
      return await handleDispatchTransfer(supabase, user.id, planetId, body.destinationPlanetId, body.fleet, body.resources, !!devMode, corsHeaders)
    }
    if (action === 'resolve_transfer') {
      return await handleResolveTransfer(supabase, user.id, body.missionId, corsHeaders)
    }
    if (action === 'scan_coordinate') {
      return await handleScanCoordinate(supabase, user.id, planetId, body.targetCoords, corsHeaders)
    }
    if (action === 'attack_player') {
      return await handleAttackPlayer(supabase, user.id, planetId, body.targetCoords, body.fleet, !!devMode, corsHeaders)
    }
    if (action === 'resolve_attack') {
      return await handleResolveAttack(supabase, user.id, body.attackId, !!devMode, corsHeaders)
    }
    if (action === 'return_fleet') {
      return await handleReturnFleet(supabase, user.id, body.attackId, corsHeaders)
    }
    if (action === 'spawn_test_opponent') {
      return await handleSpawnTestOpponent(supabase, user.id, planetId, !!devMode, corsHeaders)
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
  radar_array:       { baseCost: { metal: 300,  gas: 200 }, baseBuildTimeSeconds: 90,  baseProductionPerHour: 0,  baseEnergyConsumption: 18, prerequisites: [{ buildingId: 'headquarters', level: 3 }] },
  // Defense structures
  perimeter_turret:  { baseCost: { metal: 150,  gas: 50  }, baseBuildTimeSeconds: 45,  baseProductionPerHour: 0,  baseEnergyConsumption: 8,  prerequisites: [{ buildingId: 'headquarters', level: 2 }] },
  ion_cannon:        { baseCost: { metal: 400,  gas: 250 }, baseBuildTimeSeconds: 120, baseProductionPerHour: 0,  baseEnergyConsumption: 25, prerequisites: [{ buildingId: 'headquarters', level: 4 }, { buildingId: 'research_lab', level: 2 }] },
  missile_battery:   { baseCost: { metal: 250,  gas: 150 }, baseBuildTimeSeconds: 90,  baseProductionPerHour: 0,  baseEnergyConsumption: 15, prerequisites: [{ buildingId: 'headquarters', level: 3 }, { buildingId: 'perimeter_turret', level: 3 }] },
  shield_generator:  { baseCost: { metal: 500,  gas: 350 }, baseBuildTimeSeconds: 150, baseProductionPerHour: 0,  baseEnergyConsumption: 30, prerequisites: [{ buildingId: 'headquarters', level: 5 }, { buildingId: 'research_lab', level: 3 }] },
  sensor_jammer:     { baseCost: { metal: 200,  gas: 200 }, baseBuildTimeSeconds: 75,  baseProductionPerHour: 0,  baseEnergyConsumption: 10, prerequisites: [{ buildingId: 'headquarters', level: 4 }] },
  orbital_platform:  { baseCost: { metal: 800,  gas: 500 }, baseBuildTimeSeconds: 200, baseProductionPerHour: 0,  baseEnergyConsumption: 40, prerequisites: [{ buildingId: 'headquarters', level: 7 }, { buildingId: 'ion_cannon', level: 5 }] },
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
  colony_ship:   { cost: { metal: 20000, gas: 15000 }, baseBuildTimeSeconds: 7200, requiredShipyardLevel: 8, requiredTech: { techId: 'colonization_theory', level: 1 } },
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
  colony_ship:   { speed: 3,  cargo: 0,     attack: 0,   defense: 50,  miningYield: 0  },
}

const DEFENSES: Record<string, {
  cost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  prerequisites: Array<
    | { kind: 'building'; buildingId: string; level: number }
    | { kind: 'defense'; defenseType: string; count: number }
  >
}> = {
  perimeter_turret: { cost: { metal: 150, gas: 50  }, baseBuildTimeSeconds: 45,  prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 2 }] },
  sensor_jammer:    { cost: { metal: 200, gas: 200 }, baseBuildTimeSeconds: 75,  prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 4 }] },
  missile_battery:  { cost: { metal: 250, gas: 150 }, baseBuildTimeSeconds: 90,  prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 3 }, { kind: 'defense', defenseType: 'perimeter_turret', count: 3 }] },
  ion_cannon:       { cost: { metal: 400, gas: 250 }, baseBuildTimeSeconds: 120, prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 4 }, { kind: 'building', buildingId: 'research_lab', level: 2 }] },
  shield_generator: { cost: { metal: 500, gas: 350 }, baseBuildTimeSeconds: 150, prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 5 }, { kind: 'building', buildingId: 'research_lab', level: 3 }] },
  orbital_platform: { cost: { metal: 800, gas: 500 }, baseBuildTimeSeconds: 200, prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 7 }, { kind: 'defense', defenseType: 'ion_cannon', count: 5 }] },
}

const DEFENSE_STATS: Record<string, { attack: number; defense: number }> = {
  perimeter_turret: { attack: 20,  defense: 15  },
  sensor_jammer:    { attack: 15,  defense: 25  },
  missile_battery:  { attack: 55,  defense: 35  },
  ion_cannon:       { attack: 90,  defense: 50  },
  shield_generator: { attack: 0,   defense: 120 },
  orbital_platform: { attack: 180, defense: 100 },
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
  colonization_theory:     { baseCost: { metal: 5000, gas: 4000 }, baseTimeSeconds: 1800, maxLevel: 3, requiredLabLevel: 6, prerequisites: [{ techId: 'advanced_cartography', level: 3 }] },
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

function calcTechBonuses(technologies: { tech_id: string; level: number }[]): {
  metal_production: number; gas_production: number; energy_production: number
  ship_attack: number; ship_defense: number
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

// deno-lint-ignore no-explicit-any
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
// Achievement helpers
// ============================================================

const TECH_BRANCHES: Record<string, string[]> = {
  military:    ['reinforced_hulls', 'advanced_weapons', 'capital_ship_engineering'],
  economy:     ['efficient_refining', 'deep_core_mining', 'expanded_storage', 'rapid_extraction'],
  exploration: ['long_range_sensors', 'probe_durability', 'advanced_cartography', 'colonization_theory'],
  energy:      ['solar_efficiency', 'storm_hardening', 'fusion_theory'],
}

// deno-lint-ignore no-explicit-any
async function checkBuildAchievements(supabase: any, userId: string, planetId: string) {
  const { data: buildings } = await supabase.from('planet_buildings').select('building_id, level').eq('planet_id', planetId)
  if (!buildings) return []
  // deno-lint-ignore no-explicit-any
  const bMap = new Map(buildings.map((b: any) => [b.building_id, b.level]))
  const unlocked: string[] = []

  // first_steps: HQ Lv.2
  if ((bMap.get('headquarters') ?? 0) >= 2) unlocked.push('first_steps')
  // architect: any building Lv.5
  // deno-lint-ignore no-explicit-any
  if (buildings.some((b: any) => b.level >= 5)) unlocked.push('architect')
  // megalopolis: any building Lv.10
  // deno-lint-ignore no-explicit-any
  if (buildings.some((b: any) => b.level >= 10)) unlocked.push('megalopolis')
  // power_grid: solar_array Lv.5
  if ((bMap.get('solar_array') ?? 0) >= 5) unlocked.push('power_grid')
  // fortified: all defense types with count >= 1
  const { data: defenses } = await supabase.from('planet_defenses').select('defense_type, count').eq('planet_id', planetId)
  // deno-lint-ignore no-explicit-any
  const dMap = new Map((defenses ?? []).map((d: any) => [d.defense_type, d.count]))
  if (Object.keys(DEFENSES).every(id => (dMap.get(id) ?? 0) >= 1)) unlocked.push('fortified')
  // industrialist: metal_mine + gas_refinery both Lv.5+
  if ((bMap.get('metal_mine') ?? 0) >= 5 && (bMap.get('gas_refinery') ?? 0) >= 5) unlocked.push('industrialist')

  return await insertAchievements(supabase, userId, unlocked)
}

// deno-lint-ignore no-explicit-any
async function checkResearchAchievements(supabase: any, userId: string) {
  const { data: techs } = await supabase.from('player_technologies').select('tech_id, level').eq('player_id', userId)
  if (!techs) return []
  const unlocked: string[] = []
  // deno-lint-ignore no-explicit-any
  const researched = techs.filter((t: any) => t.level > 0)

  // curious_mind: 1+ tech
  if (researched.length >= 1) unlocked.push('curious_mind')
  // scholar: 5+ techs
  if (researched.length >= 5) unlocked.push('scholar')
  // specialist: any tech maxed
  // deno-lint-ignore no-explicit-any
  if (researched.some((t: any) => {
    const config = TECH_CONFIGS[t.tech_id]
    return config && t.level >= config.maxLevel
  })) unlocked.push('specialist')
  // visionary: all techs in any branch researched (level >= 1)
  // deno-lint-ignore no-explicit-any
  const techMap = new Map(techs.map((t: any) => [t.tech_id, t.level]))
  for (const branchTechs of Object.values(TECH_BRANCHES)) {
    if (branchTechs.every(id => (techMap.get(id) ?? 0) >= 1)) {
      unlocked.push('visionary')
      break
    }
  }

  return await insertAchievements(supabase, userId, unlocked)
}

// deno-lint-ignore no-explicit-any
async function checkMissionAchievements(supabase: any, userId: string, planetId: string) {
  const unlocked: string[] = []

  // Count completed raid missions with victory
  const { count: raidWins } = await supabase.from('planet_events')
    .select('id', { count: 'exact', head: true })
    .eq('planet_id', planetId)
    .eq('event_type', 'mission_completed')
    .like('message', 'raid returned%')
    .not('message', 'like', '%+0 metal, +0 gas%')

  if (raidWins >= 1) unlocked.push('first_blood')
  if (raidWins >= 10) unlocked.push('unstoppable')

  return await insertAchievements(supabase, userId, unlocked)
}

// deno-lint-ignore no-explicit-any
async function checkShipAchievements(supabase: any, userId: string, planetId: string) {
  const { data: ships } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId)
  if (!ships) return []
  // deno-lint-ignore no-explicit-any
  const totalShips = ships.reduce((sum: number, s: any) => sum + (s.count ?? 0), 0)
  const unlocked: string[] = []

  if (totalShips >= 50) unlocked.push('fleet_commander')
  if (totalShips >= 100) unlocked.push('armada')

  return await insertAchievements(supabase, userId, unlocked)
}

// deno-lint-ignore no-explicit-any
async function checkExplorationAchievements(supabase: any, userId: string, planetId: string) {
  const { count: revealed } = await supabase.from('galaxy_map')
    .select('id', { count: 'exact', head: true })
    .eq('planet_id', planetId)
    .not('location_type', 'is', null)

  const unlocked: string[] = []
  unlocked.push('pioneer') // if send_probe was called, they've sent a probe
  if (revealed >= 10) unlocked.push('cartographer')
  if (revealed >= 50) unlocked.push('galaxy_explorer')

  return await insertAchievements(supabase, userId, unlocked)
}

// deno-lint-ignore no-explicit-any
async function checkResourceAchievements(supabase: any, userId: string, planetId: string) {
  const { data: planet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', planetId).single()
  if (!planet) return []
  const unlocked: string[] = []

  if (planet.metal_amount >= 10000) unlocked.push('miner')
  if (planet.metal_amount >= 100000) unlocked.push('tycoon')
  if (planet.gas_amount >= 100000) unlocked.push('gas_baron')

  return await insertAchievements(supabase, userId, unlocked)
}

// deno-lint-ignore no-explicit-any
async function insertAchievements(supabase: any, userId: string, achievementIds: string[]): Promise<string[]> {
  if (achievementIds.length === 0) return []

  // Check which are already unlocked
  const { data: existing } = await supabase.from('player_achievements')
    .select('achievement_id')
    .eq('player_id', userId)
    .in('achievement_id', achievementIds)

  // deno-lint-ignore no-explicit-any
  const alreadyUnlocked = new Set((existing ?? []).map((a: any) => a.achievement_id))
  const newAchievements = achievementIds.filter(id => !alreadyUnlocked.has(id))

  if (newAchievements.length === 0) return []

  await supabase.from('player_achievements').insert(
    newAchievements.map(id => ({ player_id: userId, achievement_id: id }))
  )

  return newAchievements
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
  const newAchievements = await checkBuildAchievements(supabase, userId, planetId)
  await checkResourceAchievements(supabase, userId, planetId)
  return new Response(JSON.stringify({ success: true, completed, newAchievements }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Ship build handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleStartShipBuild(supabase: any, userId: string, planetId: string, shipType: string, quantity: number, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const isDefense = shipType in DEFENSES
  const shipConfig = isDefense ? null : SHIPS[shipType]
  const defenseConfig = isDefense ? DEFENSES[shipType] : null

  if (!shipConfig && !defenseConfig) {
    return new Response(JSON.stringify({ error: 'Unknown ship or defense type' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Check queue cap (max 5 items)
  const { data: allQueueItems } = await supabase.from('ship_queue').select('id, completes_at').eq('planet_id', planetId)
  if (allQueueItems && allQueueItems.length >= 5) return new Response(JSON.stringify({ error: 'Ship queue is full (max 5)' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  const isBuilding = allQueueItems?.some((item: any) => item.completes_at !== null) ?? false

  const { data: shipyardBuilding } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', 'shipyard').single()
  const shipyardLevel = shipyardBuilding?.level ?? 0

  if (shipConfig) {
    if (shipyardLevel < shipConfig.requiredShipyardLevel) {
      return new Response(JSON.stringify({ error: `Requires Shipyard level ${shipConfig.requiredShipyardLevel}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (shipConfig.requiredTech) {
      const { data: techRow } = await supabase.from('player_technologies').select('level').eq('player_id', userId).eq('tech_id', shipConfig.requiredTech.techId).single()
      const techLevel = techRow?.level ?? 0
      if (techLevel < shipConfig.requiredTech.level) {
        return new Response(JSON.stringify({ error: `Requires ${shipConfig.requiredTech.techId} level ${shipConfig.requiredTech.level}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }
  }

  if (defenseConfig) {
    for (const prereq of defenseConfig.prerequisites) {
      if (prereq.kind === 'building') {
        const { data: bldg } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', prereq.buildingId).single()
        if ((bldg?.level ?? 0) < prereq.level) {
          return new Response(JSON.stringify({ error: `Requires ${prereq.buildingId} level ${prereq.level}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
        }
      } else {
        const { data: def } = await supabase.from('planet_defenses').select('count').eq('planet_id', planetId).eq('defense_type', prereq.defenseType).single()
        if ((def?.count ?? 0) < prereq.count) {
          return new Response(JSON.stringify({ error: `Requires ${prereq.count} ${prereq.defenseType}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
        }
      }
    }
  }

  const config = shipConfig ?? defenseConfig!
  if (devMode) await topUpDevResources(supabase, planetId)
  const resources = await recalculateResources(supabase, planetId)
  const metalCost = config.cost.metal * quantity
  const gasCost = config.cost.gas * quantity
  if (resources.metal < metalCost || resources.gas < gasCost) {
    return new Response(JSON.stringify({ error: 'Insufficient resources', required: { metal: metalCost, gas: gasCost }, available: resources }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('planets').update({ metal_amount: resources.metal - metalCost, gas_amount: resources.gas - gasCost }).eq('id', planetId)

  const now = new Date()

  if (isBuilding) {
    await supabase.from('ship_queue').insert({ planet_id: planetId, ship_type: shipType, quantity, started_at: now.toISOString(), completes_at: null })
    await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'ship_build_started', message: `Queued ${quantity} ${shipType}`, metadata: { ship_type: shipType, quantity } })
    return new Response(JSON.stringify({ success: true, queued: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const buildTime = devMode ? 10 : shipBuildTimeSeconds(config.baseBuildTimeSeconds, shipyardLevel) * quantity
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
    const isDefense = build.ship_type in DEFENSES
    if (isDefense) {
      const { data: existing } = await supabase.from('planet_defenses').select('count').eq('planet_id', planetId).eq('defense_type', build.ship_type).single()
      const currentCount = existing?.count ?? 0
      await supabase.from('planet_defenses').upsert({ planet_id: planetId, defense_type: build.ship_type, count: currentCount + build.quantity, updated_at: now.toISOString() }, { onConflict: 'planet_id,defense_type' })
    } else {
      const { data: existing } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', build.ship_type).single()
      const currentCount = existing?.count ?? 0
      await supabase.from('planet_ships').upsert({ planet_id: planetId, ship_type: build.ship_type, count: currentCount + build.quantity, updated_at: now.toISOString() }, { onConflict: 'planet_id,ship_type' })
    }
    await supabase.from('ship_queue').delete().eq('id', build.id)
    await supabase.from('planet_events').insert({ planet_id: planetId, event_type: 'ship_build_completed', message: `${build.quantity} ${build.ship_type} completed`, metadata: { ship_type: build.ship_type, quantity: build.quantity } })
    completed.push({ shipType: build.ship_type, quantity: build.quantity })
  }

  // Start the next queued item if any
  const { data: nextQueued } = await supabase.from('ship_queue').select('*').eq('planet_id', planetId).is('completes_at', null).order('started_at', { ascending: true }).limit(1)
  if (nextQueued && nextQueued.length > 0) {
    const next = nextQueued[0]
    const { data: shipyardBuilding } = await supabase.from('planet_buildings').select('level').eq('planet_id', planetId).eq('building_id', 'shipyard').single()
    const shipyardLevel = shipyardBuilding?.level ?? 0
    const nextConfig = SHIPS[next.ship_type] ?? DEFENSES[next.ship_type]
    const buildTime = nextConfig ? shipBuildTimeSeconds(nextConfig.baseBuildTimeSeconds, shipyardLevel) * next.quantity : 60
    // Use the previous item's completion time as the start, not wall-clock now.
    // This lets elapsed items cascade to completion on the next client poll.
    const prevCompletedAt = completedBuilds[completedBuilds.length - 1].completes_at
    const startedAt = new Date(prevCompletedAt)
    const completesAt = new Date(startedAt.getTime() + buildTime * 1000)
    await supabase.from('ship_queue').update({ started_at: startedAt.toISOString(), completes_at: completesAt.toISOString() }).eq('id', next.id)
  }

  const newAchievements = await checkShipAchievements(supabase, userId, planetId)
  return new Response(JSON.stringify({ success: true, completed, newAchievements }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Scrap Ship handler
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleScrapShip(supabase: any, userId: string, planetId: string, shipType: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const shipConfig = SHIPS[shipType]
  if (!shipConfig) return new Response(JSON.stringify({ error: 'Unknown ship type' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: shipRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', shipType).single()
  const totalCount = shipRow?.count ?? 0
  if (totalCount < 1) return new Response(JSON.stringify({ error: 'No ships of this type' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Count deployed ships of this type across active missions
  const { data: activeMissions } = await supabase.from('missions').select('fleet').eq('planet_id', planetId).neq('status', 'completed')
  let deployed = 0
  if (activeMissions) {
    for (const m of activeMissions) {
      deployed += (m.fleet?.[shipType] ?? 0)
    }
  }
  const available = totalCount - deployed
  if (available < 1) return new Response(JSON.stringify({ error: 'All ships of this type are deployed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Compute refund (50% of build cost, floored)
  const metalRefund = Math.floor(shipConfig.cost.metal * 0.5)
  const gasRefund = Math.floor(shipConfig.cost.gas * 0.5)

  // Recalculate resources and add refund
  const resources = await recalculateResources(supabase, planetId)
  await supabase.from('planets').update({
    metal_amount: resources.metal + metalRefund,
    gas_amount: resources.gas + gasRefund,
  }).eq('id', planetId)

  // Decrement ship count
  await supabase.from('planet_ships').update({ count: totalCount - 1 }).eq('planet_id', planetId).eq('ship_type', shipType)

  // Log event
  const shipName = shipType.replace(/_/g, ' ')
  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'ship_scrapped',
    message: `Scrapped 1 ${shipName} — recovered ${metalRefund} metal, ${gasRefund} gas`,
    metadata: { ship_type: shipType, metal_refund: metalRefund, gas_refund: gasRefund },
  })

  return new Response(JSON.stringify({ success: true, metalRefund, gasRefund }), { headers: { ...cors, 'Content-Type': 'application/json' } })
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

  const now = new Date()
  // deno-lint-ignore no-explicit-any
  let locationType: string, name: string, metadata: Record<string, any> = {}

  // Priority 1: Check for another player's planet at this coordinate
  const { data: otherPlanet } = await supabase.from('planets')
    .select('id, player_id, name, coordinates')
    .eq('coordinates', targetCoords)
    .neq('player_id', userId)
    .limit(1)
    .single()

  if (otherPlanet) {
    const { data: owner } = await supabase.from('players').select('username').eq('id', otherPlanet.player_id).single()
    locationType = 'player_colony'
    name = otherPlanet.name
    metadata = { owner_id: otherPlanet.player_id, owner_username: owner?.username ?? 'Unknown', planet_id: otherPlanet.id }
  } else {
    // Priority 2: Check for habitable planet
    const { data: habitablePlanet } = await supabase.from('galaxy_planets')
      .select('id, name, diameter, max_building_slots, claimed_by')
      .eq('coordinates', targetCoords)
      .single()

    if (habitablePlanet && !habitablePlanet.claimed_by) {
      locationType = 'habitable_planet'
      name = habitablePlanet.name
      metadata = { galaxy_planet_id: habitablePlanet.id, diameter: habitablePlanet.diameter, max_building_slots: habitablePlanet.max_building_slots }
    } else {
      // Priority 3: Roll random location type
      locationType = rollLocationType()
      name = randomLocationName(locationType)
      if (locationType === 'asteroid_field') metadata.richness = Math.floor(Math.random() * 5) + 1
      if (locationType === 'bandit_camp') metadata.size = Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large'
      if (locationType === 'debris_field') metadata.salvage_metal = Math.floor(Math.random() * 800 + 200)
    }
  }

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

  const newAchievements = await checkExplorationAchievements(supabase, userId, planetId)
  return new Response(JSON.stringify({ success: true, location_type: locationType, name, newAchievements }), { headers: { ...cors, 'Content-Type': 'application/json' } })
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

  const newAchievements = await checkResearchAchievements(supabase, userId)
  return new Response(JSON.stringify({ success: true, completed, newAchievements }), { headers: { ...cors, 'Content-Type': 'application/json' } })
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

  const newAchievements = await checkMissionAchievements(supabase, userId, planetId)
  await checkResourceAchievements(supabase, userId, planetId)
  return new Response(JSON.stringify({ success: true, result, newAchievements }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Colonization handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleDispatchColonize(supabase: any, userId: string, planetId: string, targetCoords: string, devMode: boolean, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id, coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check the target is a revealed habitable_planet on galaxy map
  const { data: mapEntry } = await supabase.from('galaxy_map').select('*').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (!mapEntry || mapEntry.location_type !== 'habitable_planet') {
    return new Response(JSON.stringify({ error: 'Target is not a habitable planet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Check galaxy_planets is still unclaimed
  const galaxyPlanetId = mapEntry.metadata?.galaxy_planet_id
  if (!galaxyPlanetId) return new Response(JSON.stringify({ error: 'Invalid habitable planet data' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: galaxyPlanet } = await supabase.from('galaxy_planets').select('*').eq('id', galaxyPlanetId).single()
  if (!galaxyPlanet) return new Response(JSON.stringify({ error: 'Habitable planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (galaxyPlanet.claimed_by) return new Response(JSON.stringify({ error: 'Planet already claimed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check colony ship availability
  const { data: colonyShipRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', 'colony_ship').single()
  const colonyShipCount = colonyShipRow?.count ?? 0
  if (colonyShipCount < 1) return new Response(JSON.stringify({ error: 'No Colony Ship available' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Consume colony ship
  await supabase.from('planet_ships').update({ count: colonyShipCount - 1 }).eq('planet_id', planetId).eq('ship_type', 'colony_ship')

  // Calculate travel time
  const distance = coordDistance(planet.coordinates, targetCoords)
  const travelSeconds = devMode ? 10 : Math.max(60, Math.floor((distance / 3) * 60))
  const now = new Date()
  const arrivesAt = new Date(now.getTime() + travelSeconds * 1000)

  // Create colonize mission
  const { data: mission } = await supabase.from('missions').insert({
    planet_id: planetId,
    mission_type: 'colonize',
    status: 'in_transit',
    target_coords: targetCoords,
    target_name: galaxyPlanet.name,
    fleet: { colony_ship: 1 },
    dispatched_at: now.toISOString(),
    arrives_at: arrivesAt.toISOString(),
    returns_at: arrivesAt.toISOString(), // no return — consumed
  }).select('id').single()

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'colonize_dispatched',
    message: `Colony Ship dispatched to ${galaxyPlanet.name} at ${targetCoords}`,
    metadata: { target_coords: targetCoords, target_name: galaxyPlanet.name, mission_id: mission?.id },
  })

  return new Response(JSON.stringify({ success: true, missionId: mission?.id, arrivesAt: arrivesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleResolveColonize(supabase: any, userId: string, missionId: string, cors: Record<string, string>) {
  const { data: mission } = await supabase.from('missions').select('*').eq('id', missionId).single()
  if (!mission || mission.mission_type !== 'colonize') return new Response(JSON.stringify({ error: 'Mission not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Verify ownership via planet
  const { data: sourcePlanet } = await supabase.from('planets').select('id, player_id').eq('id', mission.planet_id).single()
  if (!sourcePlanet || sourcePlanet.player_id !== userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()
  if (new Date(mission.arrives_at) > now) return new Response(JSON.stringify({ error: 'Mission not yet arrived' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Get galaxy_planet and try to claim it (race condition guard)
  const { data: galaxyPlanet } = await supabase.from('galaxy_planets')
    .select('*')
    .eq('coordinates', mission.target_coords)
    .is('claimed_by', null)
    .single()

  if (!galaxyPlanet) {
    // Planet was claimed by another player during transit
    await supabase.from('missions').update({ status: 'completed', result: { success: false, reason: 'Planet already claimed by another player' } }).eq('id', missionId)
    await supabase.from('planet_events').insert({
      planet_id: mission.planet_id,
      event_type: 'colonize_failed',
      message: `Colonization of ${mission.target_name} failed — planet already claimed. Colony Ship lost.`,
      metadata: { target_coords: mission.target_coords },
    })
    return new Response(JSON.stringify({ success: false, reason: 'Planet already claimed' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Claim the planet
  await supabase.from('galaxy_planets').update({ claimed_by: userId, claimed_at: now.toISOString() }).eq('id', galaxyPlanet.id)

  // Check colonization_theory level for bonuses
  const { data: colTech } = await supabase.from('player_technologies').select('level').eq('player_id', userId).eq('tech_id', 'colonization_theory').single()
  const colLevel = colTech?.level ?? 1
  const resourceBonus = 1 + (colLevel >= 2 ? 0.2 * (colLevel - 1) : 0)
  const startingMetal = Math.floor(500 * resourceBonus)
  const startingGas = Math.floor(200 * resourceBonus)
  const hqLevel = colLevel >= 3 ? 2 : 1

  // Create the new planet
  const { data: newPlanet } = await supabase.from('planets').insert({
    player_id: userId,
    name: galaxyPlanet.name,
    coordinates: galaxyPlanet.coordinates,
    diameter: galaxyPlanet.diameter,
    max_building_slots: galaxyPlanet.max_building_slots,
    metal_amount: startingMetal,
    gas_amount: startingGas,
  }).select('id').single()

  if (!newPlanet) {
    return new Response(JSON.stringify({ error: 'Failed to create planet' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Initialize buildings
  const buildingInserts = [
    { planet_id: newPlanet.id, building_id: 'headquarters', level: hqLevel },
    { planet_id: newPlanet.id, building_id: 'metal_mine', level: 0 },
    { planet_id: newPlanet.id, building_id: 'gas_refinery', level: 0 },
    { planet_id: newPlanet.id, building_id: 'solar_array', level: 1 },
    { planet_id: newPlanet.id, building_id: 'metal_storage', level: 0 },
    { planet_id: newPlanet.id, building_id: 'gas_storage', level: 0 },
    { planet_id: newPlanet.id, building_id: 'weather_station', level: 0 },
    { planet_id: newPlanet.id, building_id: 'research_lab', level: 0 },
  ]
  await supabase.from('planet_buildings').insert(buildingInserts)

  // Initialize weather
  await supabase.from('planet_weather').insert({ planet_id: newPlanet.id, weather_type: 'calm_skies', expires_at: null })

  // Welcome event on the new planet
  await supabase.from('planet_events').insert({
    planet_id: newPlanet.id,
    event_type: 'system',
    message: 'Colony established! Your settlers begin building.',
  })

  // Mark mission as completed
  await supabase.from('missions').update({
    status: 'completed',
    result: { success: true, new_planet_id: newPlanet.id, planet_name: galaxyPlanet.name },
  }).eq('id', missionId)

  // Event on source planet
  await supabase.from('planet_events').insert({
    planet_id: mission.planet_id,
    event_type: 'colonize_completed',
    message: `Colony established on ${galaxyPlanet.name}! Switch planets to manage your new colony.`,
    metadata: { new_planet_id: newPlanet.id, planet_name: galaxyPlanet.name },
  })

  return new Response(JSON.stringify({ success: true, newPlanetId: newPlanet.id, planetName: galaxyPlanet.name }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleRenamePlanet(supabase: any, userId: string, planetId: string, newName: string, cors: Record<string, string>) {
  if (!newName || newName.length < 2 || newName.length > 24) {
    return new Response(JSON.stringify({ error: 'Name must be 2-24 characters' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  if (!/^[a-zA-Z0-9 \-]+$/.test(newName)) {
    return new Response(JSON.stringify({ error: 'Name can only contain letters, numbers, spaces, and hyphens' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { data: planet } = await supabase.from('planets').select('id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check uniqueness among player's planets
  const { data: existing } = await supabase.from('planets').select('id').eq('player_id', userId).eq('name', newName).neq('id', planetId).single()
  if (existing) return new Response(JSON.stringify({ error: 'You already have a planet with that name' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  await supabase.from('planets').update({ name: newName }).eq('id', planetId)

  return new Response(JSON.stringify({ success: true, name: newName }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Resource Transfer handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleDispatchTransfer(
  supabase: any, userId: string, sourcePlanetId: string,
  destinationPlanetId: string, fleet: Record<string, number>,
  resources: { metal: number; gas: number },
  devMode: boolean, cors: Record<string, string>
) {
  if (!destinationPlanetId || !fleet || !resources) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate both planets belong to the same player
  const { data: source } = await supabase.from('planets').select('id, coordinates, metal_amount, gas_amount').eq('id', sourcePlanetId).eq('player_id', userId).single()
  if (!source) return new Response(JSON.stringify({ error: 'Source planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: dest } = await supabase.from('planets').select('id, coordinates, name').eq('id', destinationPlanetId).eq('player_id', userId).single()
  if (!dest) return new Response(JSON.stringify({ error: 'Destination planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (sourcePlanetId === destinationPlanetId) {
    return new Response(JSON.stringify({ error: 'Cannot transfer to the same planet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate resources
  const metalToSend = Math.max(0, Math.floor(resources.metal ?? 0))
  const gasToSend = Math.max(0, Math.floor(resources.gas ?? 0))
  if (metalToSend + gasToSend === 0) {
    return new Response(JSON.stringify({ error: 'Must send at least some resources' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  if (metalToSend > source.metal_amount || gasToSend > source.gas_amount) {
    return new Response(JSON.stringify({ error: 'Not enough resources' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Calculate total cargo capacity
  let totalCapacity = 0
  for (const [shipType, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const shipStats = SHIP_STATS[shipType]
    if (!shipStats) return new Response(JSON.stringify({ error: `Unknown ship: ${shipType}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    totalCapacity += shipStats.cargo * count
  }
  if (totalCapacity < metalToSend + gasToSend) {
    return new Response(JSON.stringify({ error: 'Not enough cargo capacity' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate and deduct ships
  for (const [shipType, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const { data: shipRow } = await supabase.from('planet_ships').select('count').eq('planet_id', sourcePlanetId).eq('ship_type', shipType).single()
    const available = shipRow?.count ?? 0
    if (available < count) {
      return new Response(JSON.stringify({ error: `Not enough ${shipType} (have ${available}, need ${count})` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    await supabase.from('planet_ships').update({ count: available - (count as number) }).eq('planet_id', sourcePlanetId).eq('ship_type', shipType)
  }

  // Deduct resources
  await supabase.from('planets').update({
    metal_amount: source.metal_amount - metalToSend,
    gas_amount: source.gas_amount - gasToSend,
  }).eq('id', sourcePlanetId)

  // Calculate travel time
  const distance = coordDistance(source.coordinates, dest.coordinates)
  const travelSeconds = devMode ? 10 : Math.max(60, Math.floor((distance / 8) * 60))
  const now = new Date()
  const arrivesAt = new Date(now.getTime() + travelSeconds * 1000)

  const { data: mission } = await supabase.from('missions').insert({
    planet_id: sourcePlanetId,
    mission_type: 'transfer',
    status: 'in_transit',
    target_coords: dest.coordinates,
    target_name: dest.name,
    fleet,
    dispatched_at: now.toISOString(),
    arrives_at: arrivesAt.toISOString(),
    returns_at: arrivesAt.toISOString(), // no return — ships stay at destination
    result: { resources: { metal: metalToSend, gas: gasToSend }, destination_planet_id: destinationPlanetId },
  }).select('id').single()

  await supabase.from('planet_events').insert({
    planet_id: sourcePlanetId,
    event_type: 'transfer_dispatched',
    message: `Transport fleet sent to ${dest.name} with ${metalToSend.toLocaleString()} metal, ${gasToSend.toLocaleString()} gas`,
    metadata: { mission_id: mission?.id, destination: dest.name },
  })

  return new Response(JSON.stringify({ success: true, missionId: mission?.id, arrivesAt: arrivesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleResolveTransfer(supabase: any, userId: string, missionId: string, cors: Record<string, string>) {
  const { data: mission } = await supabase.from('missions').select('*').eq('id', missionId).single()
  if (!mission || mission.mission_type !== 'transfer') return new Response(JSON.stringify({ error: 'Mission not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Verify ownership
  const { data: sourcePlanet } = await supabase.from('planets').select('id, player_id').eq('id', mission.planet_id).single()
  if (!sourcePlanet || sourcePlanet.player_id !== userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()
  if (new Date(mission.arrives_at) > now) return new Response(JSON.stringify({ error: 'Mission not yet arrived' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const transferData = mission.result as { resources: { metal: number; gas: number }; destination_planet_id: string }
  const destPlanetId = transferData.destination_planet_id

  // Verify destination still belongs to player
  const { data: destPlanet } = await supabase.from('planets').select('id, metal_amount, gas_amount, name').eq('id', destPlanetId).eq('player_id', userId).single()
  if (!destPlanet) return new Response(JSON.stringify({ error: 'Destination planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Add resources to destination
  await supabase.from('planets').update({
    metal_amount: destPlanet.metal_amount + transferData.resources.metal,
    gas_amount: destPlanet.gas_amount + transferData.resources.gas,
  }).eq('id', destPlanetId)

  // Move ships to destination planet
  for (const [shipType, count] of Object.entries(mission.fleet as Record<string, number>)) {
    if (count <= 0) continue
    const { data: existing } = await supabase.from('planet_ships').select('count').eq('planet_id', destPlanetId).eq('ship_type', shipType).single()
    if (existing) {
      await supabase.from('planet_ships').update({ count: existing.count + count }).eq('planet_id', destPlanetId).eq('ship_type', shipType)
    } else {
      await supabase.from('planet_ships').insert({ planet_id: destPlanetId, ship_type: shipType, count })
    }
  }

  // Mark mission completed
  await supabase.from('missions').update({
    status: 'completed',
    result: { ...transferData, success: true },
  }).eq('id', missionId)

  // Events on both planets
  await supabase.from('planet_events').insert({
    planet_id: destPlanetId,
    event_type: 'transfer_received',
    message: `Transport arrived with ${transferData.resources.metal.toLocaleString()} metal, ${transferData.resources.gas.toLocaleString()} gas`,
  })
  await supabase.from('planet_events').insert({
    planet_id: mission.planet_id,
    event_type: 'transfer_completed',
    message: `Transport to ${destPlanet.name} completed successfully`,
  })

  return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// Weather rotation handler
// ============================================================

const WEATHER_TYPES = [
  { id: 'calm_skies',      metalMultiplier: 1.0,  gasMultiplier: 1.0,  energyMultiplier: 1.0,  durationMinHours: 4, durationMaxHours: 6, weight: 26.5 },
  { id: 'solar_flare',     metalMultiplier: 1.0,  gasMultiplier: 1.0,  energyMultiplier: 1.3,  durationMinHours: 2, durationMaxHours: 3, weight: 26.5 },
  { id: 'metal_vein',      metalMultiplier: 1.25, gasMultiplier: 1.0,  energyMultiplier: 1.0,  durationMinHours: 3, durationMaxHours: 4, weight: 10   },
  { id: 'gas_pocket',      metalMultiplier: 1.0,  gasMultiplier: 1.25, energyMultiplier: 1.0,  durationMinHours: 3, durationMaxHours: 4, weight: 10   },
  { id: 'ion_storm',       metalMultiplier: 1.0,  gasMultiplier: 0.8,  energyMultiplier: 0.6,  durationMinHours: 2, durationMaxHours: 3, weight: 10   },
  { id: 'dust_storm',      metalMultiplier: 0.7,  gasMultiplier: 1.0,  energyMultiplier: 0.85, durationMinHours: 2, durationMaxHours: 4, weight: 4    },
  { id: 'solar_storm',     metalMultiplier: 0.5,  gasMultiplier: 0.5,  energyMultiplier: 0.4,  durationMinHours: 1, durationMaxHours: 2, weight: 5    },
  { id: 'asteroid_shower', metalMultiplier: 1.8,  gasMultiplier: 0.6,  energyMultiplier: 0.9,  durationMinHours: 1, durationMaxHours: 1, weight: 4    },
  { id: 'nebula_drift',    metalMultiplier: 0.9,  gasMultiplier: 1.8,  energyMultiplier: 1.1,  durationMinHours: 1, durationMaxHours: 1, weight: 4    },
]

const TOTAL_WEATHER_WEIGHT = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0)

// deno-lint-ignore no-explicit-any
async function handleRotateWeather(supabase: any, userId: string, planetId: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()

  // Check if current weather has expired
  const { data: current } = await supabase
    .from('planet_weather')
    .select('id, expires_at')
    .eq('planet_id', planetId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (current && current.expires_at && new Date(current.expires_at) > now) {
    return new Response(JSON.stringify({ success: true, rotated: false }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Roll new weather
  let roll = Math.random() * TOTAL_WEATHER_WEIGHT
  let weather = WEATHER_TYPES[0]
  for (const w of WEATHER_TYPES) {
    roll -= w.weight
    if (roll <= 0) { weather = w; break }
  }

  const durationHours = weather.durationMinHours + Math.random() * (weather.durationMaxHours - weather.durationMinHours)
  const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000)

  await supabase.from('planet_weather').insert({
    planet_id: planetId,
    weather_type: weather.id,
    metal_multiplier: weather.metalMultiplier,
    gas_multiplier: weather.gasMultiplier,
    energy_multiplier: weather.energyMultiplier,
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  })

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'weather_changed',
    message: `Weather changed to ${weather.id.replace(/_/g, ' ')} — lasts ${Math.round(durationHours * 10) / 10}h`,
    metadata: { weather_type: weather.id, expires_at: expiresAt.toISOString() },
  })

  return new Response(JSON.stringify({ success: true, rotated: true, weather: weather.id, expiresAt: expiresAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ============================================================
// PvP handlers
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleScanCoordinate(supabase: any, userId: string, planetId: string, targetCoords: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (!targetCoords || !/^\d+:\d+:\d+$/.test(targetCoords)) {
    return new Response(JSON.stringify({ error: 'Invalid coordinate format (use galaxy:system:position)' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { data: probeRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', 'probe').single()
  const probeCount = probeRow?.count ?? 0
  if (probeCount < 1) return new Response(JSON.stringify({ error: 'No probes available' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { data: existing } = await supabase.from('galaxy_map').select('id, visibility').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (existing?.visibility === 'revealed') {
    return new Response(JSON.stringify({ error: 'Coordinate already revealed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('planet_ships').update({ count: probeCount - 1 }).eq('planet_id', planetId).eq('ship_type', 'probe')

  const now = new Date()
  // deno-lint-ignore no-explicit-any
  let locationType: string, name: string, metadata: Record<string, any> = {}

  // Priority 1: Check for another player's planet
  const { data: otherPlanet } = await supabase.from('planets')
    .select('id, player_id, name, coordinates')
    .eq('coordinates', targetCoords)
    .neq('player_id', userId)
    .limit(1)
    .single()

  if (otherPlanet) {
    const { data: owner } = await supabase.from('players').select('username').eq('id', otherPlanet.player_id).single()
    locationType = 'player_colony'
    name = otherPlanet.name
    metadata = { owner_id: otherPlanet.player_id, owner_username: owner?.username ?? 'Unknown', planet_id: otherPlanet.id }
  } else {
    // Priority 2: Check for habitable planet
    const { data: habitablePlanet } = await supabase.from('galaxy_planets')
      .select('id, name, diameter, max_building_slots, claimed_by')
      .eq('coordinates', targetCoords)
      .single()

    if (habitablePlanet && !habitablePlanet.claimed_by) {
      locationType = 'habitable_planet'
      name = habitablePlanet.name
      metadata = { galaxy_planet_id: habitablePlanet.id, diameter: habitablePlanet.diameter, max_building_slots: habitablePlanet.max_building_slots }
    } else {
      // Priority 3: Check for own planet
      const { data: ownPlanet } = await supabase.from('planets')
        .select('id')
        .eq('coordinates', targetCoords)
        .eq('player_id', userId)
        .single()

      if (ownPlanet) {
        return new Response(JSON.stringify({ error: 'That is your own planet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Priority 4: Roll random location
      locationType = rollLocationType()
      name = randomLocationName(locationType)
      if (locationType === 'asteroid_field') metadata.richness = Math.floor(Math.random() * 5) + 1
      if (locationType === 'bandit_camp') metadata.size = Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large'
      if (locationType === 'debris_field') metadata.salvage_metal = Math.floor(Math.random() * 800 + 200)
    }
  }

  // Upsert into galaxy_map
  if (existing) {
    await supabase.from('galaxy_map').update({
      visibility: 'revealed',
      location_type: locationType,
      name,
      metadata,
      revealed_at: now.toISOString(),
      cleared_at: null,
      respawns_at: null,
    }).eq('id', existing.id)
  } else {
    await supabase.from('galaxy_map').insert({
      player_id: userId,
      coordinates: targetCoords,
      visibility: 'revealed',
      location_type: locationType,
      name,
      metadata,
      detected_at: now.toISOString(),
      revealed_at: now.toISOString(),
    })
  }

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'scan_result',
    message: `Scan of ${targetCoords} revealed: ${name}`,
    metadata: { coordinates: targetCoords, location_type: locationType, name },
  })

  return new Response(JSON.stringify({ success: true, location_type: locationType, name }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleAttackPlayer(
  supabase: any, userId: string, planetId: string,
  targetCoords: string, fleet: Record<string, number>,
  devMode: boolean, cors: Record<string, string>
) {
  const { data: planet } = await supabase.from('planets').select('id, player_id, coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Verify target is a discovered player_colony
  const { data: mapEntry } = await supabase.from('galaxy_map').select('*').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (!mapEntry || mapEntry.location_type !== 'player_colony') {
    return new Response(JSON.stringify({ error: 'Target is not a discovered player colony' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const meta = mapEntry.metadata as { owner_id: string; planet_id: string; owner_username: string }
  if (meta.owner_id === userId) {
    return new Response(JSON.stringify({ error: 'Cannot attack your own planet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Verify defender planet still exists
  const { data: defenderPlanet } = await supabase.from('planets')
    .select('id, player_id')
    .eq('id', meta.planet_id)
    .single()
  if (!defenderPlanet) {
    return new Response(JSON.stringify({ error: 'Target planet no longer exists' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate fleet
  if (!fleet || Object.values(fleet).every((c) => c <= 0)) {
    return new Response(JSON.stringify({ error: 'Must send at least one ship' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate and deduct ships
  let slowest = 999
  for (const [shipType, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const stats = SHIP_STATS[shipType]
    if (!stats) return new Response(JSON.stringify({ error: `Unknown ship: ${shipType}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    slowest = Math.min(slowest, stats.speed)

    const { data: shipRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', shipType).single()
    const available = shipRow?.count ?? 0
    if (available < count) {
      return new Response(JSON.stringify({ error: `Not enough ${shipType} (have ${available}, need ${count})` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    await supabase.from('planet_ships').update({ count: available - count }).eq('planet_id', planetId).eq('ship_type', shipType)
  }

  // Calculate travel time
  const distance = coordDistance(planet.coordinates, targetCoords)
  const travelSeconds = devMode ? 10 : Math.max(60, Math.floor((distance / slowest) * 60))
  const now = new Date()
  const arrivesAt = new Date(now.getTime() + travelSeconds * 1000)

  const { data: attack } = await supabase.from('player_attacks').insert({
    attacker_id: userId,
    attacker_planet_id: planetId,
    defender_id: defenderPlanet.player_id,
    defender_planet_id: defenderPlanet.id,
    fleet,
    status: 'in_transit',
    dispatched_at: now.toISOString(),
    arrives_at: arrivesAt.toISOString(),
    target_coordinates: targetCoords,
  }).select('id').single()

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'attack_dispatched',
    message: `Attack fleet dispatched to ${meta.owner_username}'s colony at ${targetCoords}`,
    metadata: { attack_id: attack?.id, target_coords: targetCoords, target_owner: meta.owner_username },
  })

  await supabase.from('planet_events').insert({
    planet_id: defenderPlanet.id,
    event_type: 'incoming_attack',
    message: `Warning: Incoming attack fleet detected! ETA: ${Math.ceil(travelSeconds / 60)} minutes`,
    metadata: { attack_id: attack?.id, attacker_id: userId },
  })

  return new Response(JSON.stringify({ success: true, attackId: attack?.id, arrivesAt: arrivesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleResolveAttack(supabase: any, userId: string, attackId: string, devMode: boolean, cors: Record<string, string>) {
  const { data: attack } = await supabase.from('player_attacks').select('*').eq('id', attackId).single()
  if (!attack) return new Response(JSON.stringify({ error: 'Attack not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (attack.status !== 'in_transit') return new Response(JSON.stringify({ error: 'Attack already resolved' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (attack.attacker_id !== userId && attack.defender_id !== userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const now = new Date()
  if (new Date(attack.arrives_at) > now) {
    return new Response(JSON.stringify({ error: 'Attack has not arrived yet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Get defender's stationed fleet and defenses
  const { data: defenderShips } = await supabase.from('planet_ships').select('ship_type, count').eq('planet_id', attack.defender_planet_id)
  const { data: defenderDefenses } = await supabase.from('planet_defenses').select('defense_type, count').eq('planet_id', attack.defender_planet_id)
  const defenderFleet: Record<string, { count: number; hp: number; attack: number; defense: number }> = {}
  for (const row of (defenderShips ?? [])) {
    if (row.count <= 0) continue
    const stats = SHIP_STATS[row.ship_type]
    if (!stats) continue
    defenderFleet[row.ship_type] = { count: row.count, hp: stats.defense * 3, attack: stats.attack, defense: stats.defense }
  }
  for (const row of (defenderDefenses ?? [])) {
    if (row.count <= 0) continue
    const stats = DEFENSE_STATS[row.defense_type]
    if (!stats) continue
    defenderFleet[row.defense_type] = { count: row.count, hp: stats.defense * 3, attack: stats.attack, defense: stats.defense }
  }

  // Run combat
  const hasDefenders = Object.values(defenderFleet).some((d) => d.count > 0)
  const attackerFleet = attack.fleet as Record<string, number>
  let combat
  if (hasDefenders) {
    combat = resolveCombat(attackerFleet, defenderFleet)
  } else {
    combat = { victory: true, rounds: [], attackerLosses: {}, defenderLosses: {} }
  }

  // Calculate surviving attacker fleet
  const survivingAttackerFleet: Record<string, number> = { ...attackerFleet }
  for (const [t, l] of Object.entries(combat.attackerLosses)) {
    survivingAttackerFleet[t] = Math.max(0, (survivingAttackerFleet[t] ?? 0) - l)
  }

  // Update defender's fleet and defenses (subtract losses)
  for (const [t, l] of Object.entries(combat.defenderLosses)) {
    if (l <= 0) continue
    if (t in DEFENSES) {
      const { data: row } = await supabase.from('planet_defenses').select('count').eq('planet_id', attack.defender_planet_id).eq('defense_type', t).single()
      const newCount = Math.max(0, (row?.count ?? 0) - l)
      await supabase.from('planet_defenses').update({ count: newCount }).eq('planet_id', attack.defender_planet_id).eq('defense_type', t)
    } else {
      const { data: row } = await supabase.from('planet_ships').select('count').eq('planet_id', attack.defender_planet_id).eq('ship_type', t).single()
      const newCount = Math.max(0, (row?.count ?? 0) - l)
      await supabase.from('planet_ships').update({ count: newCount }).eq('planet_id', attack.defender_planet_id).eq('ship_type', t)
    }
  }

  // Calculate salvage from destroyed defender ships (25% of build cost)
  let salvageMetal = 0, salvageGas = 0
  for (const [type, count] of Object.entries(combat.defenderLosses)) {
    if (count <= 0) continue
    const cost = SHIPS[type]?.cost
    if (!cost) continue
    salvageMetal += Math.floor(count * cost.metal * 0.25)
    salvageGas += Math.floor(count * cost.gas * 0.25)
  }

  // Calculate stolen resources and apply cargo cap to pooled rewards
  let stolenMetal = 0, stolenGas = 0
  if (combat.victory) {
    let totalCargo = 0
    for (const [type, count] of Object.entries(survivingAttackerFleet)) {
      if (count <= 0) continue
      totalCargo += (SHIP_STATS[type]?.cargo ?? 0) * count
    }

    const metalCap = Math.floor(totalCargo * 0.6)
    const gasCap = Math.floor(totalCargo * 0.4)

    const { data: defPlanet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', attack.defender_planet_id).single()
    if (defPlanet) {
      const maxStealMetal = Math.floor(defPlanet.metal_amount * 0.5)
      const maxStealGas = Math.floor(defPlanet.gas_amount * 0.5)

      // Pool salvage + stockpile, cap by cargo
      const totalMetal = Math.min(salvageMetal + maxStealMetal, metalCap)
      const totalGas = Math.min(salvageGas + maxStealGas, gasCap)

      // Salvage fills cargo first; remainder comes from stockpile
      const actualSalvageMetal = Math.min(salvageMetal, totalMetal)
      const actualSalvageGas = Math.min(salvageGas, totalGas)
      stolenMetal = totalMetal - actualSalvageMetal
      stolenGas = totalGas - actualSalvageGas
      salvageMetal = actualSalvageMetal
      salvageGas = actualSalvageGas

      if (stolenMetal > 0 || stolenGas > 0) {
        await supabase.from('planets').update({
          metal_amount: defPlanet.metal_amount - stolenMetal,
          gas_amount: defPlanet.gas_amount - stolenGas,
        }).eq('id', attack.defender_planet_id)
      }
    } else {
      // No defender planet data — salvage still capped by cargo
      salvageMetal = Math.min(salvageMetal, metalCap)
      salvageGas = Math.min(salvageGas, gasCap)
    }
  } else {
    // Attacker lost — no salvage (all ships destroyed, no survivors to carry wreckage)
    salvageMetal = 0
    salvageGas = 0
  }

  // If attacker has survivors, create return trip
  const totalSurvivors = Object.values(survivingAttackerFleet).reduce((s, c) => s + c, 0)
  let returnArrivesAt: string | null = null
  if (combat.victory && totalSurvivors > 0) {
    const { data: attackerPlanet } = await supabase.from('planets').select('coordinates').eq('id', attack.attacker_planet_id).single()
    const distance = coordDistance(attack.target_coordinates, attackerPlanet?.coordinates ?? '1:1:1')
    let slowest = 999
    for (const [type, count] of Object.entries(survivingAttackerFleet)) {
      if (count > 0 && SHIP_STATS[type]) slowest = Math.min(slowest, SHIP_STATS[type].speed)
    }
    const returnSeconds = devMode ? 10 : Math.max(60, Math.floor((distance / slowest) * 60))
    returnArrivesAt = new Date(now.getTime() + returnSeconds * 1000).toISOString()
  }

  // Fetch usernames so battle reports can show opponent names
  const { data: attackerPlayer } = await supabase.from('players').select('username').eq('id', attack.attacker_id).single()
  const { data: defenderPlayer } = await supabase.from('players').select('username').eq('id', attack.defender_id).single()

  const result = {
    victory: combat.victory,
    rounds: combat.rounds,
    attacker_losses: combat.attackerLosses,
    defender_losses: combat.defenderLosses,
    stolen: { metal: stolenMetal, gas: stolenGas },
    salvage: { metal: salvageMetal, gas: salvageGas },
    surviving_fleet: survivingAttackerFleet,
    attacker_username: attackerPlayer?.username ?? 'Unknown',
    defender_username: defenderPlayer?.username ?? 'Unknown',
  }

  await supabase.from('player_attacks').update({
    status: combat.victory && totalSurvivors > 0 ? 'returning' : 'resolved',
    resolved_at: now.toISOString(),
    return_arrives_at: returnArrivesAt,
    result,
  }).eq('id', attackId)

  const attackerMsg = combat.victory
    ? `Attack on ${attack.target_coordinates} succeeded! Looted ${stolenMetal} metal, ${stolenGas} gas. Salvaged ${salvageMetal} metal, ${salvageGas} gas from destroyed ships. Fleet returning.`
    : `Attack on ${attack.target_coordinates} failed. All ships lost.`
  await supabase.from('planet_events').insert({
    planet_id: attack.attacker_planet_id,
    event_type: 'attack_result',
    message: attackerMsg,
    metadata: { attack_id: attackId, result },
  })

  const defenderMsg = combat.victory
    ? `Your colony was raided! Lost ${stolenMetal} metal, ${stolenGas} gas. Enemy salvaged ships from the battle.`
    : `Incoming attack repelled! Enemy fleet destroyed.`
  await supabase.from('planet_events').insert({
    planet_id: attack.defender_planet_id,
    event_type: 'attack_result',
    message: defenderMsg,
    metadata: { attack_id: attackId, result },
  })

  return new Response(JSON.stringify({ success: true, result }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleReturnFleet(supabase: any, userId: string, attackId: string, cors: Record<string, string>) {
  const { data: attack } = await supabase.from('player_attacks').select('*').eq('id', attackId).eq('attacker_id', userId).single()
  if (!attack) return new Response(JSON.stringify({ error: 'Attack not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (attack.status !== 'returning') return new Response(JSON.stringify({ error: 'Fleet not returning' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()
  if (new Date(attack.return_arrives_at) > now) {
    return new Response(JSON.stringify({ error: 'Fleet has not arrived yet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const result = attack.result as { surviving_fleet: Record<string, number>; stolen: { metal: number; gas: number }; salvage: { metal: number; gas: number } }

  // Return ships to planet
  for (const [type, count] of Object.entries(result.surviving_fleet)) {
    if (count <= 0) continue
    const { data: row } = await supabase.from('planet_ships').select('count').eq('planet_id', attack.attacker_planet_id).eq('ship_type', type).single()
    await supabase.from('planet_ships').update({ count: (row?.count ?? 0) + count }).eq('planet_id', attack.attacker_planet_id).eq('ship_type', type)
  }

  // Add stolen resources
  const { data: attackerPlanet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', attack.attacker_planet_id).single()
  if (attackerPlanet) {
    const totalMetal = result.stolen.metal + (result.salvage?.metal ?? 0)
    const totalGas = result.stolen.gas + (result.salvage?.gas ?? 0)
    await supabase.from('planets').update({
      metal_amount: attackerPlanet.metal_amount + totalMetal,
      gas_amount: attackerPlanet.gas_amount + totalGas,
    }).eq('id', attack.attacker_planet_id)
  }

  await supabase.from('player_attacks').update({ status: 'resolved' }).eq('id', attackId)

  const returnMetal = result.stolen.metal + (result.salvage?.metal ?? 0)
  const returnGas = result.stolen.gas + (result.salvage?.gas ?? 0)
  await supabase.from('planet_events').insert({
    planet_id: attack.attacker_planet_id,
    event_type: 'fleet_returned',
    message: `Raiding fleet returned with ${returnMetal} metal, ${returnGas} gas (${result.stolen.metal} looted, ${result.salvage?.metal ?? 0} salvaged)`,
    metadata: { attack_id: attackId },
  })

  return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function handleSpawnTestOpponent(supabase: any, userId: string, planetId: string, devMode: boolean, cors: Record<string, string>) {
  if (!devMode) {
    return new Response(JSON.stringify({ error: 'Dev mode only' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { data: planet } = await supabase.from('planets').select('coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const homeCoord = parseCoord(planet.coordinates)

  const testEmail = `test@starveil.local`
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: '12345',
    email_confirm: false,
  })
  if (authErr || !authUser?.user) {
    return new Response(JSON.stringify({ error: 'Failed to create test user: ' + (authErr?.message ?? 'unknown') }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const opponentId = authUser.user.id
  const opponentName = `TestOpponent_${Math.floor(Math.random() * 9999)}`

  await supabase.from('players').insert({ id: opponentId, username: opponentName })

  // Place opponent 2-5 systems away
  const offset = Math.floor(Math.random() * 4) + 2
  const dir = Math.random() > 0.5 ? 1 : -1
  const opponentCoords = `${homeCoord.galaxy}:${Math.max(1, homeCoord.system + offset * dir)}:${Math.floor(Math.random() * 15) + 1}`

  const { data: opponentPlanet } = await supabase.from('planets').insert({
    player_id: opponentId,
    name: `${opponentName}'s Colony`,
    coordinates: opponentCoords,
    diameter: 12400,
    max_building_slots: 12,
    metal_amount: 50000,
    gas_amount: 30000,
  }).select('id').single()

  if (!opponentPlanet) {
    return new Response(JSON.stringify({ error: 'Failed to create opponent planet' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('planet_buildings').insert([
    { planet_id: opponentPlanet.id, building_id: 'headquarters', level: 3 },
    { planet_id: opponentPlanet.id, building_id: 'metal_mine', level: 5 },
    { planet_id: opponentPlanet.id, building_id: 'gas_refinery', level: 4 },
    { planet_id: opponentPlanet.id, building_id: 'solar_array', level: 5 },
    { planet_id: opponentPlanet.id, building_id: 'shipyard', level: 4 },
  ])

  await supabase.from('planet_ships').insert([
    { planet_id: opponentPlanet.id, ship_type: 'small_fighter', count: 10 },
    { planet_id: opponentPlanet.id, ship_type: 'large_fighter', count: 3 },
    { planet_id: opponentPlanet.id, ship_type: 'small_cargo', count: 5 },
  ])

  await supabase.from('planet_weather').insert({ planet_id: opponentPlanet.id, weather_type: 'calm_skies', expires_at: null })

  // Auto-discover opponent on player's galaxy map
  await supabase.from('galaxy_map').upsert({
    player_id: userId,
    coordinates: opponentCoords,
    visibility: 'revealed',
    location_type: 'player_colony',
    name: `${opponentName}'s Colony`,
    metadata: { owner_id: opponentId, owner_username: opponentName, planet_id: opponentPlanet.id },
    detected_at: new Date().toISOString(),
    revealed_at: new Date().toISOString(),
  }, { onConflict: 'player_id,coordinates' })

  return new Response(JSON.stringify({
    success: true,
    opponent: {
      id: opponentId,
      username: opponentName,
      coordinates: opponentCoords,
      planetId: opponentPlanet.id,
      email: testEmail,
      password: 'test-opponent-password-12345',
    },
  }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
