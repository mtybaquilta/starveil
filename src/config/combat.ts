export type CombatShot = {
  shipType: string
  target: string
  damage: number
  destroyed: boolean
}

export type CombatRound = {
  round: number
  attackerFire: CombatShot[]
  defenderFire: CombatShot[]
}

export type CombatResult = {
  victory: boolean
  rounds: CombatRound[]
  attackerLosses: Record<string, number>
  defenderLosses: Record<string, number>
}

export type EnemyFleet = {
  name: string
  ships: Record<string, { count: number; hp: number; attack: number; defense: number }>
}

export const BANDIT_FLEETS: Record<string, EnemyFleet> = {
  small: {
    name: 'Small Bandit Patrol',
    ships: {
      raider: { count: 3, hp: 20, attack: 8, defense: 4 },
    },
  },
  medium: {
    name: 'Bandit Squadron',
    ships: {
      raider: { count: 5, hp: 20, attack: 8, defense: 4 },
      gunship: { count: 2, hp: 50, attack: 20, defense: 12 },
    },
  },
  large: {
    name: 'Bandit Armada',
    ships: {
      raider: { count: 8, hp: 20, attack: 8, defense: 4 },
      gunship: { count: 4, hp: 50, attack: 20, defense: 12 },
      destroyer: { count: 1, hp: 120, attack: 45, defense: 30 },
    },
  },
}

export type ExpeditionEncounter = 'mining_site' | 'bandits' | 'asteroid' | 'nothing'

export const EXPEDITION_WEIGHTS: Record<ExpeditionEncounter, number> = {
  mining_site: 30,
  bandits: 25,
  asteroid: 20,
  nothing: 25,
}
