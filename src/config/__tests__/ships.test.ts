import { describe, it, expect } from 'vitest'
import { shipBuildTimeSeconds, BASE_METAL_PRODUCTION_PER_HOUR, BASE_GAS_PRODUCTION_PER_HOUR } from '../formulas'

describe('shipBuildTimeSeconds', () => {
  it('returns base time at shipyard level 0', () => {
    expect(shipBuildTimeSeconds(100, 0)).toBe(100)
  })

  it('reduces by 10% per level', () => {
    expect(shipBuildTimeSeconds(100, 1)).toBeCloseTo(90, 1)
    expect(shipBuildTimeSeconds(100, 2)).toBeCloseTo(81, 1)
  })

  it('floors at 5% of base time', () => {
    expect(shipBuildTimeSeconds(100, 100)).toBeCloseTo(5, 0)
  })
})

describe('base production constants', () => {
  it('exports correct metal base', () => {
    expect(BASE_METAL_PRODUCTION_PER_HOUR).toBe(10)
  })

  it('exports correct gas base', () => {
    expect(BASE_GAS_PRODUCTION_PER_HOUR).toBe(5)
  })
})
