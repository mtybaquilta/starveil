# PvP Attack Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ship salvage rewards (25% of destroyed ships' build cost) pooled with resource stealing (up to 50% of defender stockpile), both capped by cargo capacity.

**Architecture:** All changes are in the single edge function file. The `SHIPS` constant already holds build costs — use `SHIPS[type]?.cost` to calculate salvage. The `result` object gains a `salvage` field alongside the existing `stolen` field so battle reports can distinguish the two reward sources. `handleReturnFleet` is updated to deliver both.

**Tech Stack:** Deno, Supabase edge functions, TypeScript

---

## File Map

- Modify: `supabase/functions/game-action/index.ts`
  - `handleResolveAttack` (~line 1830): replace stolen-resources block with pooled salvage + stolen logic
  - `handleReturnFleet` (~line 1934): update resource delivery to include salvage

---

### Task 1: Update `handleResolveAttack` — calculate salvage and pool rewards

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (lines ~1830–1853, ~1873–1909)

- [ ] **Step 1: Replace the stolen-resources block with the new pooled reward logic**

Find this block (around line 1830):

```typescript
  // Calculate stolen resources if attacker won
  let stolenMetal = 0, stolenGas = 0
  if (combat.victory) {
    let totalCargo = 0
    for (const [type, count] of Object.entries(survivingAttackerFleet)) {
      if (count <= 0) continue
      totalCargo += (SHIP_STATS[type]?.cargo ?? 0) * count
    }

    if (totalCargo > 0) {
      const { data: defPlanet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', attack.defender_planet_id).single()
      if (defPlanet) {
        const maxStealMetal = Math.floor(defPlanet.metal_amount * 0.5)
        const maxStealGas = Math.floor(defPlanet.gas_amount * 0.5)
        stolenMetal = Math.min(maxStealMetal, Math.floor(totalCargo * 0.6))
        stolenGas = Math.min(maxStealGas, Math.floor(totalCargo * 0.4))

        await supabase.from('planets').update({
          metal_amount: defPlanet.metal_amount - stolenMetal,
          gas_amount: defPlanet.gas_amount - stolenGas,
        }).eq('id', attack.defender_planet_id)
      }
    }
  }
```

Replace it with:

```typescript
  // Calculate salvage from destroyed defender ships (25% of build cost)
  let salvageMetal = 0, salvageGas = 0
  for (const [type, count] of Object.entries(combat.defenderLosses)) {
    if (count <= 0) continue
    const cost = SHIPS[type]?.cost
    if (!cost) continue
    salvageMetal += Math.floor(count * cost.metal * 0.25)
    salvageGas += Math.floor(count * cost.gas * 0.25)
  }

  // Calculate stolen resources and apply cargo cap to pooled rewards
  let stolenMetal = 0, stolenGas = 0
  if (combat.victory) {
    let totalCargo = 0
    for (const [type, count] of Object.entries(survivingAttackerFleet)) {
      if (count <= 0) continue
      totalCargo += (SHIP_STATS[type]?.cargo ?? 0) * count
    }

    const metalCap = Math.floor(totalCargo * 0.6)
    const gasCap = Math.floor(totalCargo * 0.4)

    const { data: defPlanet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', attack.defender_planet_id).single()
    if (defPlanet) {
      const maxStealMetal = Math.floor(defPlanet.metal_amount * 0.5)
      const maxStealGas = Math.floor(defPlanet.gas_amount * 0.5)

      // Pool salvage + stockpile, cap by cargo
      const totalMetal = Math.min(salvageMetal + maxStealMetal, metalCap)
      const totalGas = Math.min(salvageGas + maxStealGas, gasCap)

      // Salvage fills cargo first; remainder comes from stockpile
      const actualSalvageMetal = Math.min(salvageMetal, totalMetal)
      const actualSalvageGas = Math.min(salvageGas, totalGas)
      stolenMetal = totalMetal - actualSalvageMetal
      stolenGas = totalGas - actualSalvageGas
      salvageMetal = actualSalvageMetal
      salvageGas = actualSalvageGas

      if (stolenMetal > 0 || stolenGas > 0) {
        await supabase.from('planets').update({
          metal_amount: defPlanet.metal_amount - stolenMetal,
          gas_amount: defPlanet.gas_amount - stolenGas,
        }).eq('id', attack.defender_planet_id)
      }
    } else {
      // No defender planet data — salvage still capped by cargo
      salvageMetal = Math.min(salvageMetal, metalCap)
      salvageGas = Math.min(salvageGas, gasCap)
    }
  } else {
    // Attacker lost — no salvage (all ships destroyed, no survivors to carry wreckage)
    salvageMetal = 0
    salvageGas = 0
  }
```

- [ ] **Step 2: Update the `result` object to include `salvage`**

Find (around line 1873):

```typescript
  const result = {
    victory: combat.victory,
    rounds: combat.rounds,
    attacker_losses: combat.attackerLosses,
    defender_losses: combat.defenderLosses,
    stolen: { metal: stolenMetal, gas: stolenGas },
    surviving_fleet: survivingAttackerFleet,
    attacker_username: attackerPlayer?.username ?? 'Unknown',
    defender_username: defenderPlayer?.username ?? 'Unknown',
  }
```

Replace with:

```typescript
  const result = {
    victory: combat.victory,
    rounds: combat.rounds,
    attacker_losses: combat.attackerLosses,
    defender_losses: combat.defenderLosses,
    stolen: { metal: stolenMetal, gas: stolenGas },
    salvage: { metal: salvageMetal, gas: salvageGas },
    surviving_fleet: survivingAttackerFleet,
    attacker_username: attackerPlayer?.username ?? 'Unknown',
    defender_username: defenderPlayer?.username ?? 'Unknown',
  }
```

- [ ] **Step 3: Update the attacker and defender event messages**

Find (around line 1891):

```typescript
  const attackerMsg = combat.victory
    ? `Attack on ${attack.target_coordinates} succeeded! Stole ${stolenMetal} metal, ${stolenGas} gas. Fleet returning.`
    : `Attack on ${attack.target_coordinates} failed. All ships lost.`
```

Replace with:

```typescript
  const attackerMsg = combat.victory
    ? `Attack on ${attack.target_coordinates} succeeded! Looted ${stolenMetal} metal, ${stolenGas} gas. Salvaged ${salvageMetal} metal, ${salvageGas} gas from destroyed ships. Fleet returning.`
    : `Attack on ${attack.target_coordinates} failed. All ships lost.`
```

Find (around line 1901):

```typescript
  const defenderMsg = combat.victory
    ? `Your colony was raided! Lost ${stolenMetal} metal, ${stolenGas} gas.`
    : `Incoming attack repelled! Enemy fleet destroyed.`
```

Replace with:

```typescript
  const defenderMsg = combat.victory
    ? `Your colony was raided! Lost ${stolenMetal} metal, ${stolenGas} gas. Enemy salvaged ships from the battle.`
    : `Incoming attack repelled! Enemy fleet destroyed.`
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): add ship salvage rewards pooled with resource stealing"
```

---

### Task 2: Update `handleReturnFleet` — deliver salvage alongside stolen resources

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (lines ~1925–1950)

- [ ] **Step 1: Update the result type annotation and resource delivery**

Find (around line 1925):

```typescript
  const result = attack.result as { surviving_fleet: Record<string, number>; stolen: { metal: number; gas: number } }
```

Replace with:

```typescript
  const result = attack.result as { surviving_fleet: Record<string, number>; stolen: { metal: number; gas: number }; salvage: { metal: number; gas: number } }
```

- [ ] **Step 2: Update the planet resource credit to include salvage**

Find (around line 1937):

```typescript
  if (attackerPlanet) {
    await supabase.from('planets').update({
      metal_amount: attackerPlanet.metal_amount + result.stolen.metal,
      gas_amount: attackerPlanet.gas_amount + result.stolen.gas,
    }).eq('id', attack.attacker_planet_id)
  }
```

Replace with:

```typescript
  if (attackerPlanet) {
    const totalMetal = result.stolen.metal + (result.salvage?.metal ?? 0)
    const totalGas = result.stolen.gas + (result.salvage?.gas ?? 0)
    await supabase.from('planets').update({
      metal_amount: attackerPlanet.metal_amount + totalMetal,
      gas_amount: attackerPlanet.gas_amount + totalGas,
    }).eq('id', attack.attacker_planet_id)
  }
```

- [ ] **Step 3: Update the fleet_returned event message**

Find (around line 1945):

```typescript
  await supabase.from('planet_events').insert({
    planet_id: attack.attacker_planet_id,
    event_type: 'fleet_returned',
    message: `Raiding fleet returned with ${result.stolen.metal} metal, ${result.stolen.gas} gas`,
    metadata: { attack_id: attackId },
  })
```

Replace with:

```typescript
  const returnMetal = result.stolen.metal + (result.salvage?.metal ?? 0)
  const returnGas = result.stolen.gas + (result.salvage?.gas ?? 0)
  await supabase.from('planet_events').insert({
    planet_id: attack.attacker_planet_id,
    event_type: 'fleet_returned',
    message: `Raiding fleet returned with ${returnMetal} metal, ${returnGas} gas (${result.stolen.metal} looted, ${result.salvage?.metal ?? 0} salvaged)`,
    metadata: { attack_id: attackId },
  })
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): deliver salvage resources on fleet return"
```

---

### Task 3: Deploy and verify in dev mode

**Files:**
- No code changes

- [ ] **Step 1: Deploy the edge function**

```bash
npx supabase functions deploy game-action --no-verify-jwt
```

Expected: `Deployed Functions game-action`

- [ ] **Step 2: Launch the app and create a dev-mode attack**

Start the dev server if not running:
```bash
npm run dev
```

In the UI: use the galaxy map to attack another player's colony with a mixed fleet (include fighters AND cargo ships). Trigger with dev mode so it resolves instantly.

- [ ] **Step 3: Verify battle report shows both reward types**

In the attacker's planet events panel, the `attack_result` event message should read:
> `Attack on X:Y:Z succeeded! Looted N metal, N gas. Salvaged N metal, N gas from destroyed ships. Fleet returning.`

If the defender had ships, `Salvaged` values should be > 0. If no defenders, `Salvaged` should be 0.

- [ ] **Step 4: Verify fleet return delivers correct resources**

After the return timer expires, trigger `return_fleet`. The attacker's metal and gas should increase by `stolen + salvage` combined. The `fleet_returned` event message should show the breakdown.

- [ ] **Step 5: Verify defender loses only the stockpile portion**

The defender's planet resources should only decrease by `stolenMetal`/`stolenGas` — not by the salvage amount (salvage comes from wreckage, not their stockpile).

- [ ] **Step 6: Verify attacker loses with no cargo yields no resources**

Send a pure fighter fleet with zero cargo ships. If victorious, `stolenMetal` and `stolenGas` should both be 0 (no cargo capacity). `salvageMetal`/`salvageGas` should also be 0 (cargo cap applies to the whole pool).
