export type WeatherRarity = 'common' | 'uncommon' | 'rare' | 'very_rare'

export type WeatherTypeConfig = {
  id: string
  name: string
  metalMultiplier: number
  gasMultiplier: number
  energyMultiplier: number
  durationMinHours: number
  durationMaxHours: number
  rarity: WeatherRarity
  weight: number
}

export const WEATHER_TYPES: WeatherTypeConfig[] = [
  { id: 'calm_skies',      name: 'Calm Skies',             metalMultiplier: 1.0,  gasMultiplier: 1.0,  energyMultiplier: 1.0,  durationMinHours: 4, durationMaxHours: 6, rarity: 'common',    weight: 26.5 },
  { id: 'solar_flare',     name: 'Solar Flare',            metalMultiplier: 1.0,  gasMultiplier: 1.0,  energyMultiplier: 1.3,  durationMinHours: 2, durationMaxHours: 3, rarity: 'common',    weight: 26.5 },
  { id: 'metal_vein',      name: 'Metal Vein Discovered',  metalMultiplier: 1.25, gasMultiplier: 1.0,  energyMultiplier: 1.0,  durationMinHours: 3, durationMaxHours: 4, rarity: 'uncommon',  weight: 10   },
  { id: 'gas_pocket',      name: 'Gas Pocket',             metalMultiplier: 1.0,  gasMultiplier: 1.25, energyMultiplier: 1.0,  durationMinHours: 3, durationMaxHours: 4, rarity: 'uncommon',  weight: 10   },
  { id: 'ion_storm',       name: 'Ion Storm',              metalMultiplier: 1.0,  gasMultiplier: 0.8,  energyMultiplier: 0.6,  durationMinHours: 2, durationMaxHours: 3, rarity: 'uncommon',  weight: 10   },
  { id: 'dust_storm',      name: 'Dust Storm',             metalMultiplier: 0.7,  gasMultiplier: 1.0,  energyMultiplier: 0.85, durationMinHours: 2, durationMaxHours: 4, rarity: 'rare',      weight: 4    },
  { id: 'solar_storm',     name: 'Solar Storm',            metalMultiplier: 0.5,  gasMultiplier: 0.5,  energyMultiplier: 0.4,  durationMinHours: 1, durationMaxHours: 2, rarity: 'very_rare', weight: 5    },
  { id: 'asteroid_shower', name: 'Asteroid Shower',        metalMultiplier: 1.8,  gasMultiplier: 0.6,  energyMultiplier: 0.9,  durationMinHours: 1, durationMaxHours: 1, rarity: 'rare',      weight: 4    },
  { id: 'nebula_drift',    name: 'Nebula Drift',           metalMultiplier: 0.9,  gasMultiplier: 1.8,  energyMultiplier: 1.1,  durationMinHours: 1, durationMaxHours: 1, rarity: 'rare',      weight: 4    },
]

const WEATHER_MAP = new Map(WEATHER_TYPES.map((w) => [w.id, w]))

export function getWeatherConfig(id: string): WeatherTypeConfig {
  const config = WEATHER_MAP.get(id)
  if (!config) throw new Error(`Unknown weather type: ${id}`)
  return config
}

/** Roll a random weather type based on rarity weights. Pass a value 0–1 for deterministic testing. */
export function rollWeatherType(randomValue?: number): string {
  const totalWeight = WEATHER_TYPES.reduce((sum, w) => sum + w.weight, 0)
  let roll = (randomValue ?? Math.random()) * totalWeight
  for (const w of WEATHER_TYPES) {
    roll -= w.weight
    if (roll <= 0) return w.id
  }
  return WEATHER_TYPES[0].id
}

/** Roll a random duration in hours within the weather type's range. */
export function rollWeatherDurationHours(id: string): number {
  const config = getWeatherConfig(id)
  if (config.durationMinHours === 0 && config.durationMaxHours === 0) return 0
  return config.durationMinHours + Math.random() * (config.durationMaxHours - config.durationMinHours)
}
