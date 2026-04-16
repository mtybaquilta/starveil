import type { TechBranch } from './technologies'

export type AchievementCategory = 'construction' | 'research' | 'combat' | 'exploration' | 'economy'

export type AchievementCondition =
  | { type: 'building_level'; buildingId: string; level: number }
  | { type: 'any_building_level'; level: number }
  | { type: 'all_buildings_built'; buildingIds: string[] }
  | { type: 'tech_level'; techId: string; level: number }
  | { type: 'tech_count'; count: number }
  | { type: 'tech_maxed' }
  | { type: 'tech_branch_complete'; branch: TechBranch }
  | { type: 'mission_count'; missionType: string; count: number }
  | { type: 'ship_count'; count: number }
  | { type: 'sectors_discovered'; count: number }
  | { type: 'first_action'; action: string }
  | { type: 'resource_accumulated'; resource: 'metal' | 'gas'; amount: number }
  | { type: 'building_pair_level'; buildings: { buildingId: string; level: number }[] }

export type AchievementConfig = {
  id: string
  name: string
  description: string
  category: AchievementCategory
  condition: AchievementCondition
}

export const ACHIEVEMENTS: AchievementConfig[] = [
  // --- Construction ---
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Upgrade your Headquarters to Level 2.',
    category: 'construction',
    condition: { type: 'building_level', buildingId: 'headquarters', level: 2 },
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Raise any building to Level 5.',
    category: 'construction',
    condition: { type: 'any_building_level', level: 5 },
  },
  {
    id: 'megalopolis',
    name: 'Megalopolis',
    description: 'Raise any building to Level 10.',
    category: 'construction',
    condition: { type: 'any_building_level', level: 10 },
  },
  {
    id: 'power_grid',
    name: 'Power Grid',
    description: 'Upgrade the Solar Array to Level 5.',
    category: 'construction',
    condition: { type: 'building_level', buildingId: 'solar_array', level: 5 },
  },
  {
    id: 'fortified',
    name: 'Fortified',
    description: 'Construct all six defense structures.',
    category: 'construction',
    condition: {
      type: 'all_buildings_built',
      buildingIds: ['perimeter_turret', 'ion_cannon', 'missile_battery', 'shield_generator', 'sensor_jammer', 'orbital_platform'],
    },
  },

  // --- Research ---
  {
    id: 'curious_mind',
    name: 'Curious Mind',
    description: 'Complete your first research project.',
    category: 'research',
    condition: { type: 'tech_count', count: 1 },
  },
  {
    id: 'scholar',
    name: 'Scholar',
    description: 'Research five different technologies.',
    category: 'research',
    condition: { type: 'tech_count', count: 5 },
  },
  {
    id: 'specialist',
    name: 'Specialist',
    description: 'Max out any single technology.',
    category: 'research',
    condition: { type: 'tech_maxed' },
  },
  {
    id: 'visionary',
    name: 'Visionary',
    description: 'Research every technology in one branch.',
    category: 'research',
    condition: { type: 'tech_branch_complete', branch: 'military' },
  },

  // --- Combat ---
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Win your first raid mission.',
    category: 'combat',
    condition: { type: 'mission_count', missionType: 'raid', count: 1 },
  },
  {
    id: 'fleet_commander',
    name: 'Fleet Commander',
    description: 'Amass a fleet of 50 ships.',
    category: 'combat',
    condition: { type: 'ship_count', count: 50 },
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Win ten raid missions.',
    category: 'combat',
    condition: { type: 'mission_count', missionType: 'raid', count: 10 },
  },
  {
    id: 'armada',
    name: 'Armada',
    description: 'Amass a fleet of 100 ships.',
    category: 'combat',
    condition: { type: 'ship_count', count: 100 },
  },

  // --- Exploration ---
  {
    id: 'pioneer',
    name: 'Pioneer',
    description: 'Send your first probe into the unknown.',
    category: 'exploration',
    condition: { type: 'first_action', action: 'send_probe' },
  },
  {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'Discover 10 sectors on the galaxy map.',
    category: 'exploration',
    condition: { type: 'sectors_discovered', count: 10 },
  },
  {
    id: 'galaxy_explorer',
    name: 'Galaxy Explorer',
    description: 'Discover 50 sectors on the galaxy map.',
    category: 'exploration',
    condition: { type: 'sectors_discovered', count: 50 },
  },

  // --- Economy ---
  {
    id: 'miner',
    name: 'Miner',
    description: 'Accumulate 10,000 metal.',
    category: 'economy',
    condition: { type: 'resource_accumulated', resource: 'metal', amount: 10000 },
  },
  {
    id: 'tycoon',
    name: 'Tycoon',
    description: 'Accumulate 100,000 metal.',
    category: 'economy',
    condition: { type: 'resource_accumulated', resource: 'metal', amount: 100000 },
  },
  {
    id: 'gas_baron',
    name: 'Gas Baron',
    description: 'Accumulate 100,000 gas.',
    category: 'economy',
    condition: { type: 'resource_accumulated', resource: 'gas', amount: 100000 },
  },
  {
    id: 'industrialist',
    name: 'Industrialist',
    description: 'Build both Metal Mine and Gas Refinery to Level 5.',
    category: 'economy',
    condition: {
      type: 'building_pair_level',
      buildings: [
        { buildingId: 'metal_mine', level: 5 },
        { buildingId: 'gas_refinery', level: 5 },
      ],
    },
  },
]

const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

export function getAchievementConfig(id: string): AchievementConfig | undefined {
  return ACHIEVEMENT_MAP.get(id)
}

export function getAchievementsByCategory(category: AchievementCategory): AchievementConfig[] {
  return ACHIEVEMENTS.filter((a) => a.category === category)
}
