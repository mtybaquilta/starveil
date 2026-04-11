import { describe, it, expect } from 'vitest'
import { calculateResources, calculateEnergyRatio } from '../resources'

describe('calculateEnergyRatio', () => {
  it('returns 1 when production exceeds consumption', () => {
    expect(calculateEnergyRatio(100, 50)).toBe(1)
  })

  it('returns ratio when consumption exceeds production', () => {
    expect(calculateEnergyRatio(50, 100)).toBe(0.5)
  })

  it('returns 1 when consumption is 0', () => {
    expect(calculateEnergyRatio(50, 0)).toBe(1)
  })

  it('returns 0 when production is 0 and consumption is positive', () => {
    expect(calculateEnergyRatio(0, 50)).toBe(0)
  })
})

describe('calculateResources', () => {
  it('accumulates resources over elapsed time', () => {
    const result = calculateResources({
      metalAmount: 1000,
      gasAmount: 500,
      lastCalculatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-01-01T01:00:00Z'), // 1 hour later
      metalPerHour: 100,
      gasPerHour: 50,
      energyRatio: 1,
      metalStorageCap: 100000,
      gasStorageCap: 100000,
      weatherMetalMultiplier: 1,
      weatherGasMultiplier: 1,
    })
    expect(result.metal).toBeCloseTo(1100, 0)
    expect(result.gas).toBeCloseTo(550, 0)
  })

  it('applies energy ratio penalty', () => {
    const result = calculateResources({
      metalAmount: 1000,
      gasAmount: 500,
      lastCalculatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-01-01T01:00:00Z'),
      metalPerHour: 100,
      gasPerHour: 50,
      energyRatio: 0.5,
      metalStorageCap: 100000,
      gasStorageCap: 100000,
      weatherMetalMultiplier: 1,
      weatherGasMultiplier: 1,
    })
    // 100 * 0.5 = 50 effective metal/hr
    expect(result.metal).toBeCloseTo(1050, 0)
    expect(result.gas).toBeCloseTo(525, 0)
  })

  it('caps resources at storage limit', () => {
    const result = calculateResources({
      metalAmount: 900,
      gasAmount: 500,
      lastCalculatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-01-01T01:00:00Z'),
      metalPerHour: 200,
      gasPerHour: 50,
      energyRatio: 1,
      metalStorageCap: 1000,
      gasStorageCap: 100000,
      weatherMetalMultiplier: 1,
      weatherGasMultiplier: 1,
    })
    expect(result.metal).toBe(1000) // capped
    expect(result.gas).toBeCloseTo(550, 0)
  })

  it('applies weather multipliers', () => {
    const result = calculateResources({
      metalAmount: 1000,
      gasAmount: 500,
      lastCalculatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-01-01T01:00:00Z'),
      metalPerHour: 100,
      gasPerHour: 50,
      energyRatio: 1,
      metalStorageCap: 100000,
      gasStorageCap: 100000,
      weatherMetalMultiplier: 1.5,
      weatherGasMultiplier: 0.8,
    })
    // metal: 1000 + 100 * 1.5 = 1150
    // gas: 500 + 50 * 0.8 = 540
    expect(result.metal).toBeCloseTo(1150, 0)
    expect(result.gas).toBeCloseTo(540, 0)
  })
})
