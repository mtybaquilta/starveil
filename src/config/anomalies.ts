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
    flavor: 'A silent drifting hauler, hull rusted through. Cargo holds may still be intact.',
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
    flavor: 'An alien survey drone, long dormant. Its core may hold decipherable telemetry.',
    icon: '🛰',
    rewards: { research: [20, 60], gas: [0, 300] },
    flavorOutcomes: [
      'Engineers crack the probe\'s logs — fragments of tech data recovered.',
      'The probe hums briefly, then disgorges a shard of encoded research.',
    ],
  },
  signal_ghost: {
    id: 'signal_ghost',
    name: 'Signal Ghost',
    flavor: 'A faint echo on the long-range array. Probably nothing. Probably.',
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
    flavor: 'Sensor masking, fake distress call. Pirates are lying in wait — but the spoils are real.',
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
    flavor: 'Reality thins here. Anything could be inside. Or nothing.',
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
