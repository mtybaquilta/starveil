import { describe, it, expect } from 'vitest'
import {
  productionPerHour,
  upgradeCost,
  buildTimeSeconds,
  energyConsumption,
  storageCapacity,
} from '../formulas'

describe('productionPerHour', () => {
  it('returns 0 for level 0', () => {
    expect(productionPerHour(30, 0)).toBe(0)
  })

  it('calculates level 1 production', () => {
    // 30 * 1 * 1.1^1 = 33
    expect(productionPerHour(30, 1)).toBeCloseTo(33, 0)
  })

  it('calculates level 4 production', () => {
    // 30 * 4 * 1.1^4 = 120 * 1.4641 ≈ 175.69
    expect(productionPerHour(30, 4)).toBeCloseTo(175.69, 0)
  })
})

describe('upgradeCost', () => {
  it('calculates level 1 cost', () => {
    // 60 * 1.6^1 = 96
    expect(upgradeCost(60, 1)).toBeCloseTo(96, 0)
  })

  it('calculates level 5 cost', () => {
    // 60 * 1.6^5 = 60 * 10.48576 ≈ 629.15
    expect(upgradeCost(60, 5)).toBeCloseTo(629.15, 0)
  })
})

describe('buildTimeSeconds', () => {
  it('calculates level 1 time', () => {
    // 30 * 1.5^1 = 45
    expect(buildTimeSeconds(30, 1)).toBeCloseTo(45, 0)
  })

  it('calculates level 5 time', () => {
    // 30 * 1.5^5 = 30 * 7.59375 ≈ 227.81
    expect(buildTimeSeconds(30, 5)).toBeCloseTo(227.81, 0)
  })
})

describe('energyConsumption', () => {
  it('returns 0 for level 0', () => {
    expect(energyConsumption(10, 0)).toBe(0)
  })

  it('calculates level 1 consumption', () => {
    // 10 * 1 * 1.1^1 = 11
    expect(energyConsumption(10, 1)).toBeCloseTo(11, 0)
  })

  it('returns 0 for buildings with 0 base energy (solar array)', () => {
    expect(energyConsumption(0, 5)).toBe(0)
  })
})

describe('storageCapacity', () => {
  it('calculates level 1 capacity', () => {
    // 10000 * 1.5^1 = 15000
    expect(storageCapacity(10000, 1)).toBeCloseTo(15000, 0)
  })

  it('calculates level 5 capacity', () => {
    // 10000 * 1.5^5 = 75937.5
    expect(storageCapacity(10000, 5)).toBeCloseTo(75937.5, 0)
  })

  it('returns base capacity for level 0', () => {
    expect(storageCapacity(10000, 0)).toBe(10000)
  })
})
