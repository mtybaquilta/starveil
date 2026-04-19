import { describe, it, expect } from 'vitest'
import {
  applyApexDamage,
  computeApexRewards,
  type ApexState,
} from '../apexContribution'

describe('applyApexDamage', () => {
  it('decrements hp and records contribution', () => {
    const state: ApexState = { hp_remaining: 1000, hp_max: 1000, damage_contributors: {} }
    const r = applyApexDamage(state, 'p1', 300)
    expect(r.next.hp_remaining).toBe(700)
    expect(r.next.damage_contributors.p1).toBe(300)
    expect(r.killed).toBe(false)
    expect(r.killingBlow).toBe(false)
    expect(r.effectiveDamage).toBe(300)
  })

  it('caps damage at remaining hp and flags killing blow', () => {
    const state: ApexState = { hp_remaining: 200, hp_max: 1000, damage_contributors: { p1: 800 } }
    const r = applyApexDamage(state, 'p2', 500)
    expect(r.next.hp_remaining).toBe(0)
    expect(r.next.damage_contributors.p2).toBe(200)
    expect(r.effectiveDamage).toBe(200)
    expect(r.killed).toBe(true)
    expect(r.killingBlow).toBe(true)
  })

  it('accumulates damage for a repeat contributor', () => {
    const state: ApexState = { hp_remaining: 900, hp_max: 1000, damage_contributors: { p1: 100 } }
    const r = applyApexDamage(state, 'p1', 250)
    expect(r.next.damage_contributors.p1).toBe(350)
    expect(r.next.hp_remaining).toBe(650)
  })

  it('rejects zero or negative damage as no-op', () => {
    const state: ApexState = { hp_remaining: 500, hp_max: 1000, damage_contributors: {} }
    const r = applyApexDamage(state, 'p1', 0)
    expect(r.next).toEqual(state)
    expect(r.effectiveDamage).toBe(0)
    expect(r.killed).toBe(false)
  })
})

describe('computeApexRewards', () => {
  const pool = { metal: 60000, gas: 30000 }

  it('splits proportionally and applies killing-blow bonus', () => {
    const contributors = { p1: 600, p2: 400 }
    const r = computeApexRewards(contributors, pool, 'p2', 1.1)
    expect(r.p1.metal).toBe(Math.floor((600 / 1040) * 60000))
    expect(r.p2.metal).toBe(Math.floor((440 / 1040) * 60000))
    expect(r.p1.killing_blow).toBe(false)
    expect(r.p2.killing_blow).toBe(true)
  })

  it('gives single contributor full pool', () => {
    const r = computeApexRewards({ p1: 1000 }, pool, 'p1', 1.1)
    expect(r.p1.metal).toBe(60000)
    expect(r.p1.gas).toBe(30000)
    expect(r.p1.killing_blow).toBe(true)
  })

  it('applies no bonus when killer is null (escape path)', () => {
    const contributors = { p1: 500, p2: 500 }
    const escapePool = { metal: 30000, gas: 15000 }
    const r = computeApexRewards(contributors, escapePool, null, 1.1)
    expect(r.p1.metal).toBe(15000)
    expect(r.p2.metal).toBe(15000)
    expect(r.p1.killing_blow).toBe(false)
    expect(r.p2.killing_blow).toBe(false)
  })

  it('returns empty object when no contributors', () => {
    const r = computeApexRewards({}, pool, null, 1.1)
    expect(r).toEqual({})
  })
})
