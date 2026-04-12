import { describe, it, expect } from 'vitest'
import { MISSION_TYPES, getMissionConfig } from '../missions'

describe('MISSION_TYPES', () => {
  it('has exactly 3 mission types', () => {
    expect(MISSION_TYPES).toHaveLength(3)
  })

  it('contains mining, raid, and salvage', () => {
    const ids = MISSION_TYPES.map((m) => m.type)
    expect(ids).toContain('mining')
    expect(ids).toContain('raid')
    expect(ids).toContain('salvage')
  })

  it('does not contain scout_patrol or expedition', () => {
    expect(() => getMissionConfig('scout_patrol')).toThrow()
    expect(() => getMissionConfig('expedition')).toThrow()
  })

  it('mining requires at least one harvester', () => {
    const mining = getMissionConfig('mining')
    expect(mining.requiredShips).toContain('harvester')
  })

  it('raid requires at least one combat ship', () => {
    const raid = getMissionConfig('raid')
    const combatShips = ['small_fighter', 'large_fighter', 'cruiser', 'gunship', 'destroyer']
    expect(raid.requiredShips.some((s) => combatShips.includes(s))).toBe(true)
  })

  it('each mission has an icon and description', () => {
    for (const m of MISSION_TYPES) {
      expect(m.icon).toBeTruthy()
      expect(m.description).toBeTruthy()
    }
  })
})
