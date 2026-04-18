import headquartersImg from '../assets/buildings/headquarters.jpg'
import metalMineImg from '../assets/buildings/metal_mine.jpg'
import gasRefineryImg from '../assets/buildings/gas_refinary.jpg'
import solarArrayImg from '../assets/buildings/solar_array.jpg'
import metalStorageImg from '../assets/buildings/metal_storage.jpg'
import gasStorageImg from '../assets/buildings/gas_storage.jpg'
import weatherStationImg from '../assets/buildings/weather_station.jpg'
import researchLabImg from '../assets/buildings/research_lab.jpg'
import radarArrayImg from '../assets/buildings/radar_array.jpg'
import shipyardImg from '../assets/ships/shipyard.jpg'

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
    image: headquartersImg,
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
    image: metalMineImg,
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
    image: gasRefineryImg,
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
    image: solarArrayImg,
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
    image: metalStorageImg,
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
    image: gasStorageImg,
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
    image: weatherStationImg,
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
    image: researchLabImg,
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
    image: shipyardImg,
  },
  {
    id: 'radar_array',
    name: 'Radar Array',
    description: 'Scans the surrounding sector for anomalies and objects. Each level increases the detection range and the number of coordinates detected per scan cycle.',
    category: 'infrastructure',
    maxLevel: 20,
    baseCost: { metal: 300, gas: 200 },
    baseProductionPerHour: 0,
    baseEnergyConsumption: 18,
    baseBuildTimeSeconds: 90,
    prerequisites: [{ buildingId: 'headquarters', level: 3 }],
    image: radarArrayImg,
  },
]

const BUILDING_MAP = new Map(BUILDINGS.map((b) => [b.id, b]))

export function getBuildingConfig(buildingId: string): BuildingConfig {
  const config = BUILDING_MAP.get(buildingId)
  if (!config) throw new Error(`Unknown building: ${buildingId}`)
  return config
}
