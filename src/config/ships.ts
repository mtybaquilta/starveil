export type ShipId = 'probe' | 'scout' | 'explorer' | 'small_fighter' | 'large_fighter' | 'transport'

export type ShipConfig = {
  id: ShipId
  name: string
  description: string
  cost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  stats: { speed: number; cargoCapacity: number; attackPower: number; defenseRating: number; miningYield: number }
  requiredShipyardLevel: number
  icon: string
}

export const SHIPS: ShipConfig[] = [
  {
    id: 'probe',
    name: 'Probe',
    description: 'A cheap, disposable scout drone for basic reconnaissance.',
    cost: { metal: 100, gas: 0 },
    baseBuildTimeSeconds: 30,
    stats: { speed: 8, cargoCapacity: 0, attackPower: 0, defenseRating: 1, miningYield: 0 },
    requiredShipyardLevel: 1,
    icon: '🔭',
  },
  {
    id: 'scout',
    name: 'Scout',
    description: 'A fast, light reconnaissance vessel.',
    cost: { metal: 300, gas: 100 },
    baseBuildTimeSeconds: 90,
    stats: { speed: 12, cargoCapacity: 100, attackPower: 2, defenseRating: 3, miningYield: 0 },
    requiredShipyardLevel: 2,
    icon: '🛸',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'A medium-range vessel for extended deep space missions.',
    cost: { metal: 800, gas: 400 },
    baseBuildTimeSeconds: 240,
    stats: { speed: 9, cargoCapacity: 500, attackPower: 5, defenseRating: 8, miningYield: 5 },
    requiredShipyardLevel: 4,
    icon: '🌌',
  },
  {
    id: 'small_fighter',
    name: 'Small Fighter',
    description: 'An agile combat vessel. Fast and lethal in swarms.',
    cost: { metal: 1200, gas: 600 },
    baseBuildTimeSeconds: 360,
    stats: { speed: 14, cargoCapacity: 50, attackPower: 18, defenseRating: 10, miningYield: 0 },
    requiredShipyardLevel: 5,
    icon: '⚔️',
  },
  {
    id: 'large_fighter',
    name: 'Large Fighter',
    description: 'A heavily armed warship. Slower but hits much harder.',
    cost: { metal: 3500, gas: 2000 },
    baseBuildTimeSeconds: 900,
    stats: { speed: 8, cargoCapacity: 200, attackPower: 55, defenseRating: 40, miningYield: 0 },
    requiredShipyardLevel: 8,
    icon: '🛡️',
  },
  {
    id: 'transport',
    name: 'Transport',
    description: 'A massive cargo hauler. Slow but carries enormous loads.',
    cost: { metal: 2000, gas: 1000 },
    baseBuildTimeSeconds: 600,
    stats: { speed: 5, cargoCapacity: 5000, attackPower: 2, defenseRating: 15, miningYield: 10 },
    requiredShipyardLevel: 3,
    icon: '📦',
  },
]

const SHIP_MAP = new Map(SHIPS.map((s) => [s.id, s]))

export function getShipConfig(shipId: string): ShipConfig {
  const config = SHIP_MAP.get(shipId as ShipId)
  if (!config) throw new Error(`Unknown ship: ${shipId}`)
  return config
}
