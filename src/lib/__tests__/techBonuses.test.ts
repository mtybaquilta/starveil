import { describe, it, expect } from 'vitest'
import { getTechBonuses } from '../techBonuses'

describe('getTechBonuses', () => {
  it('returns all zeros for empty technologies', () => {
    const bonuses = getTechBonuses([])
    expect(bonuses.metal_production).toBe(0)
    expect(bonuses.gas_production).toBe(0)
    expect(bonuses.energy_production).toBe(0)
    expect(bonuses.ship_attack).toBe(0)
    expect(bonuses.ship_defense).toBe(0)
  })

  it('returns 0.10 metal bonus for efficient_refining level 2', () => {
    const bonuses = getTechBonuses([{ tech_id: 'efficient_refining', level: 2 }])
    // 5% per level × 2 levels = 10% = 0.10
    expect(bonuses.metal_production).toBeCloseTo(0.10)
    expect(bonuses.gas_production).toBe(0)
  })

  it('stacks bonuses from multiple techs for energy', () => {
    // solar_efficiency: +5%/level at level 3 = 15%
    // fusion_theory: +8%/level at level 2 = 16%
    // total: 31% = 0.31
    const bonuses = getTechBonuses([
      { tech_id: 'solar_efficiency', level: 3 },
      { tech_id: 'fusion_theory', level: 2 },
    ])
    expect(bonuses.energy_production).toBeCloseTo(0.31)
  })

  it('ignores unlock-type bonuses', () => {
    const bonuses = getTechBonuses([{ tech_id: 'capital_ship_engineering', level: 3 }])
    expect(bonuses.ship_attack).toBe(0)
    expect(bonuses.ship_defense).toBe(0)
  })

  it('returns 0.05 ship_defense for reinforced_hulls level 1', () => {
    const bonuses = getTechBonuses([{ tech_id: 'reinforced_hulls', level: 1 }])
    expect(bonuses.ship_defense).toBeCloseTo(0.05)
  })
})
