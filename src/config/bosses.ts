import destroyerImg from '../assets/ships/destroyer.jpg'
import cruiserImg from '../assets/ships/cruiser.jpg'
import gunshipImg from '../assets/ships/gunship.jpg'

export type BossTier = 'minor' | 'elite' | 'apex'

export type BossFleetUnit = {
  count: number
  hp: number
  attack: number
  defense: number
}

export type BossConfig = {
  id: string
  name: string
  tier: BossTier
  description: string
  fleet: Record<string, BossFleetUnit>
  loot: { metal: [number, number]; gas: [number, number] }
  recommendedFleetPower: number
  respawnHours: [number, number]
  image: string
}

export const BOSSES: BossConfig[] = [
  {
    id: 'derelict_dreadnought',
    name: 'Derelict Dreadnought',
    tier: 'minor',
    description: 'An abandoned warship drifting in contested space, its automated turrets still hungry for targets.',
    fleet: {
      heavy_turret: { count: 4, hp: 400, attack: 80, defense: 60 },
      relic_gunship: { count: 2, hp: 600, attack: 120, defense: 80 },
    },
    loot: { metal: [5000, 12000], gas: [3000, 8000] },
    recommendedFleetPower: 800,
    respawnHours: [8, 12],
    image: gunshipImg,
  },
  {
    id: 'pirate_flagship',
    name: 'Pirate Flagship',
    tier: 'elite',
    description: 'The command ship of a notorious raider clan, escorted by a seasoned strike group.',
    fleet: {
      flagship: { count: 1, hp: 4000, attack: 300, defense: 250 },
      raider_gunship: { count: 6, hp: 700, attack: 140, defense: 90 },
      interceptor: { count: 4, hp: 350, attack: 90, defense: 50 },
    },
    loot: { metal: [15000, 30000], gas: [10000, 20000] },
    recommendedFleetPower: 2500,
    respawnHours: [12, 18],
    image: cruiserImg,
  },
  {
    id: 'void_leviathan',
    name: 'Void Leviathan',
    tier: 'apex',
    description: 'A colossal living vessel from beyond charted space. Few fleets that find it return to tell the tale.',
    fleet: {
      leviathan: { count: 1, hp: 12000, attack: 600, defense: 500 },
      void_drone: { count: 10, hp: 400, attack: 100, defense: 60 },
      bile_cannon: { count: 4, hp: 900, attack: 220, defense: 140 },
    },
    loot: { metal: [40000, 80000], gas: [25000, 50000] },
    recommendedFleetPower: 6000,
    respawnHours: [18, 24],
    image: destroyerImg,
  },
]

export function getBossConfig(id: string): BossConfig {
  const cfg = BOSSES.find((b) => b.id === id)
  if (!cfg) throw new Error(`Unknown boss: ${id}`)
  return cfg
}

export const BOSS_IDS = new Set(BOSSES.map((b) => b.id))

export const TIER_WEIGHTS: Record<BossTier, number> = {
  minor: 60,
  elite: 30,
  apex: 10,
}

export type ApexEventConfig = {
  herald_window_hours: number
  active_window_hours: number
  escape_loot_multiplier: number
  killing_blow_bonus: number
}

export const APEX_EVENT_CONFIG: ApexEventConfig = {
  herald_window_hours: 2,
  active_window_hours: 24,
  escape_loot_multiplier: 0.5,
  killing_blow_bonus: 1.1,
}
