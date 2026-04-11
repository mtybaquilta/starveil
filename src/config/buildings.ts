export type BuildingCategory = 'resource' | 'storage' | 'infrastructure'

export type BuildingConfig = {
  id: string
  name: string
  description: string
  category: BuildingCategory
  maxLevel: number
  baseCost: { metal: number; gas: number }
  baseProductionPerHour: number
  baseEnergyConsumption: number
  baseBuildTimeSeconds: number
  prerequisites: { buildingId: string; level: number }[]
  image: string
}

export const BUILDINGS: BuildingConfig[] = [
  {
    id: 'headquarters',
    name: 'Headquarters',
    description: "The command center of your colony. Higher levels unlock new buildings and increase available build slots.",
    category: 'infrastructure',
    maxLevel: 20,
    baseCost: { metal: 100, gas: 50 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 5,
    baseBuildTimeSeconds: 60,
    prerequisites: [],
    image: '/images/buildings/headquarters.png',
  },
  {
    id: 'metal_mine',
    name: 'Metal Mine',
    description: "Extracts raw metal ore from the planet's crust. Higher levels dig deeper and employ more efficient extraction methods.",
    category: 'resource',
    maxLevel: 20,
    baseCost: { metal: 60, gas: 15 },
    baseProductionPerHour: 30,
    baseEnergyConsumption: 10,
    baseBuildTimeSeconds: 30,
    prerequisites: [],
    image: '/images/buildings/metal_mine.png',
  },
  {
    id: 'gas_refinery',
    name: 'Gas Refinery',
    description: 'Processes atmospheric gases into usable fuel and raw materials. Essential for advanced construction.',
    category: 'resource',
    maxLevel: 20,
    baseCost: { metal: 80, gas: 40 },
    baseProductionPerHour: 20,
    baseEnergyConsumption: 12,
    baseBuildTimeSeconds: 45,
    prerequisites: [{ buildingId: 'headquarters', level: 2 }],
    image: '/images/buildings/gas_refinery.png',
  },
  {
    id: 'solar_array',
    name: 'Solar Array',
    description: "Harnesses stellar radiation to power your colony's infrastructure. Without sufficient energy, production grinds to a halt.",
    category: 'resource',
    maxLevel: 20,
    baseCost: { metal: 50, gas: 25 },
    baseProductionPerHour: 25,
    baseEnergyConsumption: 0,
    baseBuildTimeSeconds: 30,
    prerequisites: [],
    image: '/images/buildings/solar_array.png',
  },
  {
    id: 'metal_storage',
    name: 'Metal Storage',
    description: 'Reinforced warehouses for stockpiling metal ore. Increases the maximum metal your colony can hold.',
    category: 'storage',
    maxLevel: 20,
    baseCost: { metal: 100, gas: 0 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 3,
    baseBuildTimeSeconds: 40,
    prerequisites: [{ buildingId: 'metal_mine', level: 2 }],
    image: '/images/buildings/metal_storage.png',
  },
  {
    id: 'gas_storage',
    name: 'Gas Storage',
    description: 'Pressurized containment vessels for gas reserves. Increases the maximum gas your colony can hold.',
    category: 'storage',
    maxLevel: 20,
    baseCost: { metal: 100, gas: 50 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 3,
    baseBuildTimeSeconds: 40,
    prerequisites: [{ buildingId: 'gas_refinery', level: 2 }],
    image: '/images/buildings/gas_storage.png',
  },
  {
    id: 'weather_station',
    name: 'Weather Station',
    description: 'Monitors planetary atmospheric conditions. Higher levels provide more accurate and longer-range weather forecasts.',
    category: 'infrastructure',
    maxLevel: 20,
    baseCost: { metal: 120, gas: 80 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 8,
    baseBuildTimeSeconds: 50,
    prerequisites: [{ buildingId: 'headquarters', level: 2 }],
    image: '/images/buildings/weather_station.png',
  },
  {
    id: 'research_lab',
    name: 'Research Lab',
    description: 'A facility dedicated to unlocking new technologies. Future upgrades will open the tech tree.',
    category: 'infrastructure',
    maxLevel: 20,
    baseCost: { metal: 200, gas: 100 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 15,
    baseBuildTimeSeconds: 90,
    prerequisites: [{ buildingId: 'headquarters', level: 3 }],
    image: '/images/buildings/research_lab.png',
  },
  {
    id: 'shipyard',
    name: 'Shipyard',
    description: 'Constructs your fleet. Higher levels unlock more ship types and reduce build times by 10% per level.',
    category: 'infrastructure',
    maxLevel: 20,
    baseCost: { metal: 400, gas: 200 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 20,
    baseBuildTimeSeconds: 120,
    prerequisites: [{ buildingId: 'headquarters', level: 2 }],
    image: '/images/buildings/shipyard.png',
  },
]

const BUILDING_MAP = new Map(BUILDINGS.map((b) => [b.id, b]))

export function getBuildingConfig(buildingId: string): BuildingConfig {
  const config = BUILDING_MAP.get(buildingId)
  if (!config) throw new Error(`Unknown building: ${buildingId}`)
  return config
}
