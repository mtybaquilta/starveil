import { describe, it, expect } from 'vitest'
import { WEATHER_TYPES, getWeatherConfig, rollWeatherType } from '../weather'

describe('WEATHER_TYPES', () => {
  it('has 9 weather types', () => {
    expect(WEATHER_TYPES).toHaveLength(9)
  })

  it('calm_skies has neutral multipliers', () => {
    const calm = getWeatherConfig('calm_skies')
    expect(calm.metalMultiplier).toBe(1.0)
    expect(calm.gasMultiplier).toBe(1.0)
    expect(calm.energyMultiplier).toBe(1.0)
  })

  it('solar_storm is very_rare with punishing multipliers', () => {
    const storm = getWeatherConfig('solar_storm')
    expect(storm.rarity).toBe('very_rare')
    expect(storm.metalMultiplier).toBe(0.5)
    expect(storm.gasMultiplier).toBe(0.5)
    expect(storm.energyMultiplier).toBe(0.4)
  })
})

describe('rollWeatherType', () => {
  it('returns a valid weather type id', () => {
    const id = rollWeatherType()
    expect(() => getWeatherConfig(id)).not.toThrow()
  })

  it('respects seeded random for deterministic test', () => {
    // rollWeatherType accepts an optional random value 0–1
    // 0.0 should hit the first bucket (calm_skies, weight ~26.5%)
    const id = rollWeatherType(0.0)
    expect(id).toBe('calm_skies')
  })
})
