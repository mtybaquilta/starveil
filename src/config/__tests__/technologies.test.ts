import { describe, it, expect } from 'vitest'
import {
  TECHNOLOGIES,
  getTechConfig,
  getTechsByBranch,
  researchCost,
  researchTimeSeconds,
} from '../technologies'

describe('TECHNOLOGIES', () => {
  it('has techs in all 4 branches', () => {
    const branches = new Set(TECHNOLOGIES.map((t) => t.branch))
    expect(branches).toEqual(new Set(['military', 'economy', 'exploration', 'energy']))
  })

  it('capital_ship_engineering is in military branch', () => {
    const tech = getTechConfig('capital_ship_engineering')
    expect(tech.branch).toBe('military')
    expect(tech.maxLevel).toBe(5)
  })
})

describe('getTechsByBranch', () => {
  it('returns only military techs', () => {
    const techs = getTechsByBranch('military')
    expect(techs.every((t) => t.branch === 'military')).toBe(true)
    expect(techs.length).toBeGreaterThan(0)
  })
})

describe('researchCost', () => {
  it('calculates level 1 cost', () => {
    const tech = getTechConfig('capital_ship_engineering')
    const cost = researchCost(tech.baseCost, 1)
    // baseCost * 1.6^level
    expect(cost.metal).toBeCloseTo(tech.baseCost.metal * 1.6, 0)
    expect(cost.gas).toBeCloseTo(tech.baseCost.gas * 1.6, 0)
  })
})

describe('researchTimeSeconds', () => {
  it('calculates level 1 time', () => {
    const tech = getTechConfig('capital_ship_engineering')
    const time = researchTimeSeconds(tech.baseTimeSeconds, 1)
    expect(time).toBeCloseTo(tech.baseTimeSeconds * 1.5, 0)
  })
})
