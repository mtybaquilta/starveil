import { describe, it, expect } from 'vitest'
import { BUILDINGS, getBuildingConfig } from '../buildings'

describe('BUILDINGS config', () => {
  it('has 9 buildings', () => {
    expect(BUILDINGS).toHaveLength(9)
  })

  it('each building has required fields', () => {
    for (const b of BUILDINGS) {
      expect(b.id).toBeTruthy()
      expect(b.name).toBeTruthy()
      expect(b.description).toBeTruthy()
      expect(b.maxLevel).toBe(20)
      expect(b.baseCost.metal).toBeGreaterThanOrEqual(0)
      expect(b.baseCost.gas).toBeGreaterThanOrEqual(0)
      expect(b.baseBuildTimeSeconds).toBeGreaterThan(0)
      expect(b.category).toMatch(/^(resource|storage|infrastructure)$/)
    }
  })

  it('headquarters has no prerequisites', () => {
    const hq = getBuildingConfig('headquarters')
    expect(hq.prerequisites).toEqual([])
  })

  it('gas_refinery requires headquarters level 2', () => {
    const gasRefinery = getBuildingConfig('gas_refinery')
    expect(gasRefinery.prerequisites).toEqual([
      { buildingId: 'headquarters', level: 2 },
    ])
  })

  it('research_lab requires headquarters level 3', () => {
    const lab = getBuildingConfig('research_lab')
    expect(lab.prerequisites).toEqual([
      { buildingId: 'headquarters', level: 3 },
    ])
  })
})
