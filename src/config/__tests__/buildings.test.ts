import { describe, it, expect } from 'vitest'
import { BUILDINGS, getBuildingConfig } from '../buildings'

describe('BUILDINGS config', () => {
  it('has 16 buildings (10 standard + 6 defense)', () => {
    expect(BUILDINGS).toHaveLength(16)
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
      expect(b.category).toMatch(/^(resource|storage|infrastructure|defense)$/)
    }
  })

  it('all buildings have unique ids', () => {
    const ids = BUILDINGS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
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

  it('contains radar_array', () => {
    expect(() => getBuildingConfig('radar_array')).not.toThrow()
  })

  it('radar_array is in infrastructure category and requires headquarters level 3', () => {
    const radar = getBuildingConfig('radar_array')
    expect(radar.category).toBe('infrastructure')
    expect(radar.prerequisites).toContainEqual({ buildingId: 'headquarters', level: 3 })
  })
})
