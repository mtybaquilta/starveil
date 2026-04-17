# PvP Attack Rewards — Design Spec

**Date:** 2026-04-17

## Overview

Rework the PvP attack reward system so attackers earn from two distinct sources: looting the defender's resource stockpile, and salvaging wreckage from destroyed ships. Both are gated by cargo capacity, rewarding players who invest in both combat power and logistics.

## Reward Sources

### 1. Resource Stealing (existing, unchanged logic)

- Maximum stealable: 50% of defender's current metal and gas
- Split: 60% of cargo capacity allocated to metal, 40% to gas
- Deducted from defender's planet immediately on `resolve_attack`

### 2. Ship Salvage (new)

- For each defender ship destroyed in combat, the attacker earns 25% of that ship's build cost (metal and gas)
- Salvage is calculated from `combat.defenderLosses` and the ship cost table
- Salvage is **not** deducted from the defender (it comes from wreckage, not their stockpile)

### Combined Cargo Cap

Both rewards are pooled and capped together by the surviving attacker fleet's total cargo capacity. The 60/40 metal/gas split applies to the combined pool.

This means: a larger fleet with more cargo ships earns more from both sources — more risk, more reward.

## Data Model Changes

The `result` object stored on `player_attacks` gains a `salvage` field alongside `stolen`:

```ts
result: {
  victory: boolean
  rounds: CombatRound[]
  attacker_losses: Record<string, number>
  defender_losses: Record<string, number>
  stolen: { metal: number; gas: number }      // from defender stockpile
  salvage: { metal: number; gas: number }     // from destroyed ships
  surviving_fleet: Record<string, number>
  attacker_username: string
  defender_username: string
}
```

`handleReturnFleet` reads `result.stolen.metal + result.salvage.metal` (and gas) when crediting the attacker's planet.

## Implementation Scope

All changes are in `supabase/functions/game-action/index.ts`:

1. **Ship cost map**: Add an inline `SHIP_COSTS` constant (mirrors `src/config/ships.ts`) accessible within the edge function.

2. **`handleResolveAttack`**: 
   - Calculate raw salvage from `combat.defenderLosses × SHIP_COSTS × 0.25`
   - Pool salvage metal + up to 50% of defender metal; pool salvage gas + up to 50% of defender gas
   - Apply cargo cap to combined pool
   - Determine how much of the combined pool came from the stockpile (subtract salvage, floor at 0) — this is the amount deducted from defender
   - Store `salvage` and `stolen` separately in result
   - Update event messages to reflect both

3. **`handleReturnFleet`**: Credit `stolen.metal + salvage.metal` and `stolen.gas + salvage.gas` to attacker planet.

## Event Messages

**Attacker (victory):**
> `Attack on 3:2:7 succeeded! Looted 400 metal, 200 gas. Salvaged 150 metal, 80 gas from destroyed ships. Fleet returning.`

**Defender (defeat):**
> `Your colony was raided! Lost 400 metal, 200 gas. Enemy salvaged ships from the battle.`

## Out of Scope

- No changes to frontend battle report rendering beyond what already displays `stolen` — the `salvage` field can be wired up in a separate pass.
- No changes to the cargo calculation logic itself.
