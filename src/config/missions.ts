export type MissionType = 'mining' | 'scout_patrol' | 'expedition' | 'raid'

export type MissionConfig = {
  type: MissionType
  name: string
  description: string
  icon: string
  requiredShips: string[]
  minDurationSeconds: number
  discoversLocations: boolean
}

export const MISSION_CONFIGS: Record<MissionType, MissionConfig> = {
  mining: {
    type: 'mining',
    name: 'Mining Run',
    description: 'Send miners to extract resources from an asteroid field.',
    icon: '⛏️',
    requiredShips: ['transport', 'explorer'],
    minDurationSeconds: 120,
    discoversLocations: false,
  },
  scout_patrol: {
    type: 'scout_patrol',
    name: 'Scout Patrol',
    description: 'Send scouts to search for bandit camps.',
    icon: '🛸',
    requiredShips: ['scout'],
    minDurationSeconds: 60,
    discoversLocations: true,
  },
  expedition: {
    type: 'expedition',
    name: 'Expedition',
    description: 'Send explorers on a deep space expedition. May find resources, enemies, or asteroids.',
    icon: '🌌',
    requiredShips: ['explorer'],
    minDurationSeconds: 180,
    discoversLocations: true,
  },
  raid: {
    type: 'raid',
    name: 'Raid',
    description: 'Attack a known bandit camp for resources. Bring enough firepower!',
    icon: '⚔️',
    requiredShips: ['small_fighter', 'large_fighter'],
    minDurationSeconds: 90,
    discoversLocations: false,
  },
}

export function getMissionConfig(type: string): MissionConfig {
  const config = MISSION_CONFIGS[type as MissionType]
  if (!config) throw new Error(`Unknown mission type: ${type}`)
  return config
}
