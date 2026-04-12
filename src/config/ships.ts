export type ShipId =
  | 'probe'
  | 'small_fighter'
  | 'large_fighter'
  | 'cruiser'
  | 'gunship'
  | 'destroyer'
  | 'harvester'
  | 'small_cargo'
  | 'large_cargo'

export type ShipConfig = {
  id: ShipId
  name: string
  description: string
  cost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  stats: { speed: number; cargoCapacity: number; attackPower: number; defenseRating: number; miningYield: number }
  requiredShipyardLevel: number
  requiredTech?: { techId: string; level: number }
  image: string,
  icon: string
}

export const SHIPS: ShipConfig[] = [
  {
    id: 'probe',
    name: 'Probe',
    description: 'A disposable scanning drone. Sent to detected coordinates to reveal what is there. Consumed on use.',
    cost: { metal: 50, gas: 0 },
    baseBuildTimeSeconds: 20,
    stats: { speed: 15, cargoCapacity: 0, attackPower: 0, defenseRating: 1, miningYield: 0 },
    requiredShipyardLevel: 1,
    image: '/src/assets/probe.png',
    icon: '🔭',
  },
  {
    id: 'small_fighter',
    name: 'Small Fighter',
    description: 'An agile combat vessel. Fast and lethal in swarms.',
    cost: { metal: 1200, gas: 600 },
    baseBuildTimeSeconds: 360,
    stats: { speed: 14, cargoCapacity: 50, attackPower: 18, defenseRating: 10, miningYield: 0 },
    requiredShipyardLevel: 2,
    image: '/src/assets/small_fighter.png',
    icon: '⚔️',
  },
  {
    id: 'large_fighter',
    name: 'Large Fighter',
    description: 'A heavily armed warship. Slower but hits much harder.',
    cost: { metal: 3500, gas: 2000 },
    baseBuildTimeSeconds: 900,
    stats: { speed: 8, cargoCapacity: 200, attackPower: 55, defenseRating: 40, miningYield: 0 },
    requiredShipyardLevel: 4,
    image: '/src/assets/large_fighter.png',
    icon: '🛡️',
  },
  {
    id: 'cruiser',
    name: 'Cruiser',
    description: 'A mid-tier capital ship. Good balance of firepower and durability.',
    cost: { metal: 8000, gas: 5000 },
    baseBuildTimeSeconds: 1800,
    stats: { speed: 7, cargoCapacity: 400, attackPower: 80, defenseRating: 70, miningYield: 0 },
    requiredShipyardLevel: 6,
    requiredTech: { techId: 'capital_ship_engineering', level: 1 },
    image: '/src/assets/cruiser.png',
    icon: '🚀',
  },
  {
    id: 'gunship',
    name: 'Gunship',
    description: 'A heavy firepower platform. Devastating in battle but slow.',
    cost: { metal: 15000, gas: 10000 },
    baseBuildTimeSeconds: 3600,
    stats: { speed: 5, cargoCapacity: 300, attackPower: 150, defenseRating: 100, miningYield: 0 },
    requiredShipyardLevel: 8,
    requiredTech: { techId: 'capital_ship_engineering', level: 3 },
    image: '/src/assets/gunship.png',
    icon: '💥',
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    description: 'The pinnacle of military engineering. Extremely powerful and costly.',
    cost: { metal: 30000, gas: 20000 },
    baseBuildTimeSeconds: 7200,
    stats: { speed: 4, cargoCapacity: 500, attackPower: 300, defenseRating: 200, miningYield: 0 },
    requiredShipyardLevel: 10,
    requiredTech: { techId: 'capital_ship_engineering', level: 5 },
    image: '/src/assets/destroyer.png',
    icon: '☠️',
  },
  {
    id: 'harvester',
    name: 'Harvester',
    description: 'A resource extraction vessel. Mines at a location but has no cargo hold — needs Cargo ships to carry resources home.',
    cost: { metal: 2000, gas: 800 },
    baseBuildTimeSeconds: 600,
    stats: { speed: 6, cargoCapacity: 0, attackPower: 2, defenseRating: 10, miningYield: 15 },
    requiredShipyardLevel: 3,
    image: '/src/assets/harvester.png',
    icon: '⛏️',
  },
  {
    id: 'small_cargo',
    name: 'Small Cargo',
    description: 'A light transport. Cheap and essential for early game resource hauling.',
    cost: { metal: 800, gas: 400 },
    baseBuildTimeSeconds: 300,
    stats: { speed: 8, cargoCapacity: 2000, attackPower: 1, defenseRating: 8, miningYield: 0 },
    requiredShipyardLevel: 2,
    image: '/src/assets/small_cargo.png',
    icon: '📦',
  },
  {
    id: 'large_cargo',
    name: 'Large Cargo',
    description: 'A massive cargo hauler. Slow but carries enormous loads for late game operations.',
    cost: { metal: 4000, gas: 2000 },
    baseBuildTimeSeconds: 900,
    stats: { speed: 5, cargoCapacity: 10000, attackPower: 2, defenseRating: 15, miningYield: 0 },
    requiredShipyardLevel: 5,
    image: '/src/assets/large_cargo.png',
    icon: '🚢',
  },
]

const SHIP_MAP = new Map(SHIPS.map((s) => [s.id, s]))

export function getShipConfig(shipId: string): ShipConfig {
  const config = SHIP_MAP.get(shipId as ShipId)
  if (!config) throw new Error(`Unknown ship: ${shipId}`)
  return config
}
