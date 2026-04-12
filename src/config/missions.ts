export type MissionType = 'mining' | 'raid' | 'salvage'

export type MissionConfig = {
  type: MissionType
  name: string
  description: string
  icon: string
  /** Ship types that must be present in the fleet for this mission. */
  requiredShips: string[]
  minDurationSeconds: number
}

export const MISSION_TYPES: MissionConfig[] = [
  {
    type: 'mining',
    name: 'Mining Run',
    description: 'Deploy harvesters to a known asteroid field or resource site. Cargo ships carry the yield home — without them, harvesters extract but cannot return resources.',
    icon: '⛏️',
    requiredShips: ['harvester'],
    minDurationSeconds: 120,
  },
  {
    type: 'raid',
    name: 'Raid',
    description: 'Attack a revealed enemy location. Bring enough firepower to destroy the defenders and loot their resources.',
    icon: '⚔️',
    requiredShips: ['small_fighter'],
    minDurationSeconds: 90,
  },
  {
    type: 'salvage',
    name: 'Salvage',
    description: 'Send cargo ships to an abandoned or cleared location to recover drifting resources and wreckage.',
    icon: '🛸',
    requiredShips: ['small_cargo'],
    minDurationSeconds: 60,
  },
]

const MISSION_MAP = new Map(MISSION_TYPES.map((m) => [m.type, m]))

export function getMissionConfig(type: string): MissionConfig {
  const config = MISSION_MAP.get(type as MissionType)
  if (!config) throw new Error(`Unknown mission type: ${type}`)
  return config
}
