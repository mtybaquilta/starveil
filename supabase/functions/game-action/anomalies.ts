// Mirror of src/config/anomalies.ts — Deno can't import from src/

export type AnomalyType =
  | 'resource_cache'
  | 'derelict_probe'
  | 'signal_ghost'
  | 'ambush'
  | 'void_echo'

export type AnomalyConfig = {
  id: AnomalyType
  name: string
  flavor: string
  icon: string
  minFleetPower?: number
  rewards: {
    metal?: [number, number]
    gas?: [number, number]
    research?: [number, number]
    shipLossPct?: [number, number]
  }
  flavorOutcomes: string[]
}

export const ANOMALIES: Record<AnomalyType, AnomalyConfig> = {
  resource_cache: {
    id: 'resource_cache',
    name: 'Resource Cache',
    flavor: 'A silent drifting hauler, hull rusted through.',
    icon: '📦',
    rewards: { metal: [1500, 4000], gas: [500, 1500] },
    flavorOutcomes: [
      'The cargo bay yields pallets of refined metal and sealed gas canisters.',
      'Salvage teams pry open frozen holds — a clean haul.',
    ],
  },
  derelict_probe: {
    id: 'derelict_probe',
    name: 'Derelict Probe',
    flavor: 'An alien survey drone, long dormant.',
    icon: '🛰',
    rewards: { research: [20, 60], gas: [0, 300] },
    flavorOutcomes: [
      "Engineers crack the probe's logs — fragments of tech data recovered.",
      'The probe hums briefly, then disgorges a shard of encoded research.',
    ],
  },
  signal_ghost: {
    id: 'signal_ghost',
    name: 'Signal Ghost',
    flavor: 'A faint echo on the long-range array.',
    icon: '📡',
    rewards: { metal: [200, 600] },
    flavorOutcomes: [
      'The echo resolves into a tumbling scrap field — minor salvage recovered.',
      'False contact. A few drifting containers offer a consolation prize.',
    ],
  },
  ambush: {
    id: 'ambush',
    name: 'Pirate Ambush',
    flavor: 'Sensor masking, fake distress call. Pirates lie in wait.',
    icon: '☠',
    minFleetPower: 200,
    rewards: { metal: [2000, 5000], gas: [1000, 3000], shipLossPct: [0.05, 0.15] },
    flavorOutcomes: [
      'Pirate screens collapse under your volley. Spoils recovered; some ships lost.',
      'Fierce exchange — your fleet emerges bloodied but victorious.',
    ],
  },
  void_echo: {
    id: 'void_echo',
    name: 'Void Echo',
    flavor: 'Reality thins here. Anything could be inside.',
    icon: '🌀',
    rewards: { metal: [0, 8000], gas: [0, 8000], shipLossPct: [0, 0.2] },
    flavorOutcomes: [
      'The void yields unimaginable bounty.',
      'Space folds, spits your fleet back out. Empty-handed, shaken.',
      'A fair trade — losses for gains.',
    ],
  },
}

export const ANOMALY_TYPES: AnomalyType[] = Object.keys(ANOMALIES) as AnomalyType[]

function randInt(lo: number, hi: number): number {
  return Math.floor(lo + Math.random() * (hi - lo + 1))
}

function randFloat(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

export type AnomalyRollResult = {
  metal: number
  gas: number
  research: number
  shipsLost: Record<string, number>
  flavor: string
}

export function rollAnomalyReward(
  type: AnomalyType,
  fleet: Record<string, number>,
): AnomalyRollResult {
  const cfg = ANOMALIES[type]
  const r = cfg.rewards
  const metal = r.metal ? randInt(r.metal[0], r.metal[1]) : 0
  const gas = r.gas ? randInt(r.gas[0], r.gas[1]) : 0
  const research = r.research ? randInt(r.research[0], r.research[1]) : 0

  const shipsLost: Record<string, number> = {}
  if (r.shipLossPct) {
    const pct = randFloat(r.shipLossPct[0], r.shipLossPct[1])
    for (const [ship, count] of Object.entries(fleet)) {
      const lost = Math.floor(count * pct)
      if (lost > 0) shipsLost[ship] = lost
    }
  }

  const flavor = cfg.flavorOutcomes[Math.floor(Math.random() * cfg.flavorOutcomes.length)]
  return { metal, gas, research, shipsLost, flavor }
}
