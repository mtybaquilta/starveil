import { describe, it, expect } from 'vitest'
import { SHIPS, getShipConfig } from '../ships'
import { shipBuildTimeSeconds, BASE_METAL_PRODUCTION_PER_HOUR, BASE_GAS_PRODUCTION_PER_HOUR } from '../formulas'

describe('ship roster', () => {
  const expectedIds = [
    'probe', 'small_fighter', 'large_fighter', 'cruiser',
    'gunship', 'destroyer', 'harvester', 'small_cargo', 'large_cargo',
  ]

  it('has exactly 9 ships', () => {
    expect(SHIPS).toHaveLength(9)
  })

  it.each(expectedIds)('contains %s', (id) => {
    expect(() => getShipConfig(id)).not.toThrow()
  })

  it('does not contain removed ships', () => {
    expect(() => getShipConfig('scout')).toThrow()
    expect(() => getShipConfig('explorer')).toThrow()
    expect(() => getShipConfig('transport')).toThrow()
  })

  it('probe has no cargo or attack', () => {
    const probe = getShipConfig('probe')
    expect(probe.stats.cargoCapacity).toBe(0)
    expect(probe.stats.attackPower).toBe(0)
  })

  it('harvester has mining yield but no cargo', () => {
    const harvester = getShipConfig('harvester')
    expect(harvester.stats.miningYield).toBeGreaterThan(0)
    expect(harvester.stats.cargoCapacity).toBe(0)
  })

  it('large_cargo has more capacity than small_cargo', () => {
    const small = getShipConfig('small_cargo')
    const large = getShipConfig('large_cargo')
    expect(large.stats.cargoCapacity).toBeGreaterThan(small.stats.cargoCapacity)
  })
})

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
