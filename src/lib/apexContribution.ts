export type ApexState = {
  hp_remaining: number
  hp_max: number
  damage_contributors: Record<string, number>
}

export type ApplyDamageResult = {
  next: ApexState
  effectiveDamage: number
  killed: boolean
  killingBlow: boolean
}

export function applyApexDamage(
  state: ApexState,
  playerId: string,
  rawDamage: number,
): ApplyDamageResult {
  if (rawDamage <= 0 || state.hp_remaining <= 0) {
    return { next: state, effectiveDamage: 0, killed: state.hp_remaining <= 0, killingBlow: false }
  }
  const effective = Math.min(rawDamage, state.hp_remaining)
  const nextHp = state.hp_remaining - effective
  const prior = state.damage_contributors[playerId] ?? 0
  const next: ApexState = {
    hp_max: state.hp_max,
    hp_remaining: nextHp,
    damage_contributors: { ...state.damage_contributors, [playerId]: prior + effective },
  }
  return {
    next,
    effectiveDamage: effective,
    killed: nextHp <= 0,
    killingBlow: nextHp <= 0,
  }
}

export type RewardPool = { metal: number; gas: number }
export type RewardRow = { metal: number; gas: number; killing_blow: boolean }

export function computeApexRewards(
  contributors: Record<string, number>,
  pool: RewardPool,
  killerId: string | null,
  killingBlowBonus: number,
): Record<string, RewardRow> {
  const entries = Object.entries(contributors).filter(([, d]) => d > 0)
  if (entries.length === 0) return {}
  const weights: Record<string, number> = {}
  let total = 0
  for (const [pid, dmg] of entries) {
    const w = pid === killerId ? dmg * killingBlowBonus : dmg
    weights[pid] = w
    total += w
  }
  const out: Record<string, RewardRow> = {}
  for (const [pid] of entries) {
    const share = weights[pid] / total
    out[pid] = {
      metal: Math.floor(share * pool.metal),
      gas: Math.floor(share * pool.gas),
      killing_blow: pid === killerId,
    }
  }
  return out
}
