export type TechBranch = 'military' | 'economy' | 'exploration' | 'energy'

export type TechBonus = {
  type: 'percentage' | 'unlock'
  stat: string
  valuePerLevel: number
  unlockAtLevel?: number
  description: string
}

export type TechConfig = {
  id: string
  name: string
  lore: string
  branch: TechBranch
  maxLevel: number
  baseCost: { metal: number; gas: number }
  baseTimeSeconds: number
  requiredLabLevel: number
  prerequisites: { techId: string; level: number }[]
  bonuses: TechBonus[]
}

export const TECHNOLOGIES: TechConfig[] = [
  // --- Military ---
  {
    id: 'reinforced_hulls',
    name: 'Reinforced Hulls',
    lore: 'Composite alloys forged in zero-gravity foundries, layered for maximum deflection.',
    branch: 'military',
    maxLevel: 10,
    baseCost: { metal: 400, gas: 200 },
    baseTimeSeconds: 300,
    requiredLabLevel: 1,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'ship_defense', valuePerLevel: 5, description: '+5% ship defense per level' }],
  },
  {
    id: 'advanced_weapons',
    name: 'Advanced Weapons',
    lore: 'Plasma-tipped warheads and targeting AI that predicts evasion patterns before they happen.',
    branch: 'military',
    maxLevel: 10,
    baseCost: { metal: 500, gas: 300 },
    baseTimeSeconds: 360,
    requiredLabLevel: 2,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'ship_attack', valuePerLevel: 5, description: '+5% ship attack per level' }],
  },
  {
    id: 'capital_ship_engineering',
    name: 'Capital Ship Engineering',
    lore: 'Massive hull frameworks and reactor cores that make city-sized warships a reality.',
    branch: 'military',
    maxLevel: 5,
    baseCost: { metal: 2000, gas: 1500 },
    baseTimeSeconds: 900,
    requiredLabLevel: 4,
    prerequisites: [{ techId: 'reinforced_hulls', level: 3 }],
    bonuses: [
      { type: 'unlock', stat: 'ship_cruiser',   valuePerLevel: 0, unlockAtLevel: 1, description: 'Lv.1: Unlocks Cruiser' },
      { type: 'unlock', stat: 'ship_gunship',   valuePerLevel: 0, unlockAtLevel: 3, description: 'Lv.3: Unlocks Gunship' },
      { type: 'unlock', stat: 'ship_destroyer', valuePerLevel: 0, unlockAtLevel: 5, description: 'Lv.5: Unlocks Destroyer' },
    ],
  },
  // --- Economy ---
  {
    id: 'efficient_refining',
    name: 'Efficient Refining',
    lore: 'Nano-catalytic smelters that extract every trace of usable ore from raw rock.',
    branch: 'economy',
    maxLevel: 10,
    baseCost: { metal: 300, gas: 150 },
    baseTimeSeconds: 240,
    requiredLabLevel: 1,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'metal_production', valuePerLevel: 5, description: '+5% metal production per level' }],
  },
  {
    id: 'deep_core_mining',
    name: 'Deep Core Mining',
    lore: 'Bore through planetary crust to reach mineral veins no surface operation could touch.',
    branch: 'economy',
    maxLevel: 10,
    baseCost: { metal: 500, gas: 250 },
    baseTimeSeconds: 360,
    requiredLabLevel: 3,
    prerequisites: [{ techId: 'efficient_refining', level: 3 }],
    bonuses: [{ type: 'percentage', stat: 'mining_yield', valuePerLevel: 8, description: '+8% mining mission yield per level' }],
  },
  {
    id: 'expanded_storage',
    name: 'Expanded Storage',
    lore: 'Pressurized containment vaults and anti-corrosion lining that hold far more than standard silos.',
    branch: 'economy',
    maxLevel: 10,
    baseCost: { metal: 400, gas: 200 },
    baseTimeSeconds: 300,
    requiredLabLevel: 2,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'storage_capacity', valuePerLevel: 10, description: '+10% storage capacity per level' }],
  },
  {
    id: 'rapid_extraction',
    name: 'Rapid Extraction',
    lore: 'Superheated injection rigs that flash-vaporize gas pockets for near-instant collection.',
    branch: 'economy',
    maxLevel: 10,
    baseCost: { metal: 600, gas: 400 },
    baseTimeSeconds: 420,
    requiredLabLevel: 4,
    prerequisites: [{ techId: 'deep_core_mining', level: 2 }],
    bonuses: [{ type: 'percentage', stat: 'gas_production', valuePerLevel: 5, description: '+5% gas production per level' }],
  },
  // --- Exploration ---
  {
    id: 'long_range_sensors',
    name: 'Long Range Sensors',
    lore: 'Tachyon pulse arrays that detect faint signatures across dozens of light-years.',
    branch: 'exploration',
    maxLevel: 10,
    baseCost: { metal: 350, gas: 250 },
    baseTimeSeconds: 300,
    requiredLabLevel: 1,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'radar_range', valuePerLevel: 15, description: '+15% radar range per level' }],
  },
  {
    id: 'probe_durability',
    name: 'Probe Durability',
    lore: 'Self-repairing micro-shells and radiation-hardened circuits that let probes survive hostile sectors.',
    branch: 'exploration',
    maxLevel: 5,
    baseCost: { metal: 200, gas: 100 },
    baseTimeSeconds: 180,
    requiredLabLevel: 2,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'probe_speed', valuePerLevel: 10, description: '+10% probe speed per level' }],
  },
  {
    id: 'advanced_cartography',
    name: 'Advanced Cartography',
    lore: 'Quantum-entangled mapping drones that build a living atlas of the galaxy in real time.',
    branch: 'exploration',
    maxLevel: 5,
    baseCost: { metal: 600, gas: 500 },
    baseTimeSeconds: 480,
    requiredLabLevel: 5,
    prerequisites: [{ techId: 'long_range_sensors', level: 4 }],
    bonuses: [{ type: 'percentage', stat: 'scan_detail', valuePerLevel: 20, description: '+20% scan detail per level' }],
  },
  {
    id: 'colonization_theory',
    name: 'Colonization Theory',
    lore: 'The science of seeding life on barren worlds — atmosphere processors, biodome engineering, and frontier logistics.',
    branch: 'exploration',
    maxLevel: 3,
    baseCost: { metal: 5000, gas: 4000 },
    baseTimeSeconds: 1800,
    requiredLabLevel: 6,
    prerequisites: [{ techId: 'advanced_cartography', level: 3 }],
    bonuses: [
      { type: 'unlock', stat: 'ship_colony_ship', valuePerLevel: 0, unlockAtLevel: 1, description: 'Lv.1: Unlocks Colony Ship' },
      { type: 'percentage', stat: 'colony_starting_resources', valuePerLevel: 20, description: '+20% colony starting resources per level' },
    ],
  },
  // --- Energy ---
  {
    id: 'solar_efficiency',
    name: 'Solar Efficiency',
    lore: 'Photon-trapping metamaterials that harvest energy from starlight others would waste.',
    branch: 'energy',
    maxLevel: 10,
    baseCost: { metal: 300, gas: 200 },
    baseTimeSeconds: 240,
    requiredLabLevel: 1,
    prerequisites: [],
    bonuses: [{ type: 'percentage', stat: 'energy_production', valuePerLevel: 5, description: '+5% energy production per level' }],
  },
  {
    id: 'storm_hardening',
    name: 'Storm Hardening',
    lore: 'Electromagnetic dampeners and surge buffers that keep the grid stable when the skies turn violent.',
    branch: 'energy',
    maxLevel: 5,
    baseCost: { metal: 800, gas: 600 },
    baseTimeSeconds: 600,
    requiredLabLevel: 3,
    prerequisites: [{ techId: 'solar_efficiency', level: 3 }],
    bonuses: [{ type: 'percentage', stat: 'weather_resistance', valuePerLevel: 10, description: 'Reduces negative weather penalties by 10% per level' }],
  },
  {
    id: 'fusion_theory',
    name: 'Fusion Theory',
    lore: 'Controlled plasma confinement that turns hydrogen into virtually limitless power.',
    branch: 'energy',
    maxLevel: 10,
    baseCost: { metal: 1000, gas: 800 },
    baseTimeSeconds: 720,
    requiredLabLevel: 5,
    prerequisites: [{ techId: 'solar_efficiency', level: 5 }],
    bonuses: [{ type: 'percentage', stat: 'energy_production', valuePerLevel: 8, description: '+8% energy production per level (stacks with Solar Efficiency)' }],
  },
]

const TECH_MAP = new Map(TECHNOLOGIES.map((t) => [t.id, t]))

export function getTechConfig(id: string): TechConfig {
  const config = TECH_MAP.get(id)
  if (!config) throw new Error(`Unknown technology: ${id}`)
  return config
}

export function getTechsByBranch(branch: TechBranch): TechConfig[] {
  return TECHNOLOGIES.filter((t) => t.branch === branch)
}

/** Cost to research to the given level. Same exponential pattern as buildings. */
export function researchCost(baseCost: { metal: number; gas: number }, level: number): { metal: number; gas: number } {
  return {
    metal: baseCost.metal * Math.pow(1.6, level),
    gas: baseCost.gas * Math.pow(1.6, level),
  }
}

/** Time in seconds to research to the given level. */
export function researchTimeSeconds(baseTime: number, level: number): number {
  return baseTime * Math.pow(1.5, level)
}
