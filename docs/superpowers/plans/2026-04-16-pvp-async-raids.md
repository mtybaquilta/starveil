# PvP Async Raids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can discover, scan, and attack each other's planets asynchronously using probe-based discovery, fleet combat, and resource theft.

**Architecture:** New `player_attacks` table tracks attack lifecycle (in_transit → returning → resolved). The `send_probe` handler gains player colony detection (priority 1 before habitable planet check). A new `scan_coordinate` action lets players scan arbitrary coordinates without radar detection. `attack_player` dispatches fleets, `resolve_attack` runs combat using existing `resolveCombat()`, and surviving ships return with stolen resources. Both players see fleet movement on the galaxy map. A dev-only `spawn_test_opponent` action creates a test player for single-player testing.

**Tech Stack:** Supabase (Postgres + Edge Functions/Deno), React + Tailwind CSS v4.2, Vitest

---

## File Structure

### New Files
- `supabase/migrations/010_pvp_attacks.sql` — `player_attacks` table + RLS policies + planets public read policy
- `src/hooks/useAttacks.ts` — Fetches outgoing/incoming attacks, auto-resolves on arrival, dispatches attacks

### Modified Files
- `supabase/functions/game-action/index.ts` — 5 new handlers: `scan_coordinate`, `attack_player`, `resolve_attack`, `return_fleet`, `spawn_test_opponent`; modify `handleSendProbe` to detect player colonies first
- `src/hooks/usePlanet.ts` — Add `PlayerAttack` type, fetch outgoing + incoming attacks
- `src/components/Layout.tsx` — Pass attacks to context
- `src/pages/GalaxyMapPage.tsx` — Player colony marker, attack fleet dots (outgoing + incoming), attack detail panel with "Attack" button
- `src/config/__tests__/ships.test.ts` — Already fixed (10 ships)

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/010_pvp_attacks.sql`

- [ ] **Step 1: Write migration file**

```sql
-- PvP: Player Attacks
create table player_attacks (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references players(id),
  attacker_planet_id uuid not null references planets(id),
  defender_id uuid not null references players(id),
  defender_planet_id uuid not null references planets(id),
  fleet jsonb not null,
  status text not null default 'in_transit',
  dispatched_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  return_arrives_at timestamptz,
  resolved_at timestamptz,
  result jsonb,
  target_coordinates text not null
);

create index player_attacks_attacker on player_attacks (attacker_id);
create index player_attacks_defender on player_attacks (defender_id);

alter table player_attacks enable row level security;

-- Attacker can see their outgoing attacks
create policy "attacks_select_attacker" on player_attacks
  for select using (attacker_id = auth.uid());

-- Defender can see incoming attacks
create policy "attacks_select_defender" on player_attacks
  for select using (defender_id = auth.uid());

-- Allow reading other players' basic planet info (name, coordinates)
-- The client query only selects name + coordinates, never resources
create policy "planets_select_any" on planets
  for select using (true);

-- Allow reading other players' usernames for PvP display
create policy "players_select_any" on players
  for select using (true);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat supabase/migrations/010_pvp_attacks.sql`

Verify: Table has all columns from spec, both RLS policies exist, planets and players get public SELECT policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_pvp_attacks.sql
git commit -m "feat(pvp): add player_attacks table and public read policies"
```

---

## Task 2: Edge function — player colony detection in send_probe

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (handleSendProbe, ~line 889)

The priority order changes from:
1. Check `galaxy_planets` → habitable_planet
2. Roll `rollLocationType()` → asteroid/bandit/debris

To:
1. Check other player's planet → `player_colony`
2. Check `galaxy_planets` → `habitable_planet`
3. Roll `rollLocationType()` → asteroid/bandit/debris

- [ ] **Step 1: Add player colony check before habitable planet check in handleSendProbe**

In `handleSendProbe`, immediately after `// Consume probe` and before `// Check for habitable planet`, add:

```typescript
  // Priority 1: Check for another player's planet at this coordinate
  const { data: otherPlanet } = await supabase.from('planets')
    .select('id, player_id, name, coordinates')
    .eq('coordinates', targetCoords)
    .neq('player_id', userId)
    .limit(1)
    .single()
```

Then restructure the if/else chain:

```typescript
  if (otherPlanet) {
    // Discovered another player's colony
    const { data: owner } = await supabase.from('players').select('username').eq('id', otherPlanet.player_id).single()
    locationType = 'player_colony'
    name = otherPlanet.name
    metadata = {
      owner_id: otherPlanet.player_id,
      owner_username: owner?.username ?? 'Unknown',
      planet_id: otherPlanet.id,
    }
  } else if (habitablePlanet && !habitablePlanet.claimed_by) {
    // existing habitable planet code...
  } else {
    // existing rollLocationType code...
  }
```

- [ ] **Step 2: Test locally by reading the modified code**

Verify: The `otherPlanet` query runs before `habitablePlanet` query. The metadata includes `owner_id`, `owner_username`, and `planet_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): detect player colonies on probe scan"
```

---

## Task 3: Edge function — scan_coordinate action

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (route + new handler)

`scan_coordinate` differs from `send_probe`: it doesn't require a prior radar detection. The player specifies arbitrary coordinates. It still costs 1 probe.

- [ ] **Step 1: Add route for scan_coordinate**

After the `send_probe` route in the action dispatcher (~line 56):

```typescript
    if (action === 'scan_coordinate') {
      return await handleScanCoordinate(supabase, user.id, planetId, body.targetCoords, corsHeaders)
    }
```

- [ ] **Step 2: Add handleScanCoordinate handler**

Add before the radar handler section:

```typescript
// deno-lint-ignore no-explicit-any
async function handleScanCoordinate(supabase: any, userId: string, planetId: string, targetCoords: string, cors: Record<string, string>) {
  const { data: planet } = await supabase.from('planets').select('id, player_id').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Validate coordinate format (galaxy:system:position)
  if (!targetCoords || !/^\d+:\d+:\d+$/.test(targetCoords)) {
    return new Response(JSON.stringify({ error: 'Invalid coordinate format (use galaxy:system:position)' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Check probe availability
  const { data: probeRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', 'probe').single()
  const probeCount = probeRow?.count ?? 0
  if (probeCount < 1) return new Response(JSON.stringify({ error: 'No probes available' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Check if already revealed on galaxy map
  const { data: existing } = await supabase.from('galaxy_map').select('id, visibility').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (existing?.visibility === 'revealed') {
    return new Response(JSON.stringify({ error: 'Coordinate already revealed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Consume probe
  await supabase.from('planet_ships').update({ count: probeCount - 1 }).eq('planet_id', planetId).eq('ship_type', 'probe')

  const now = new Date()
  // deno-lint-ignore no-explicit-any
  let locationType: string, name: string, metadata: Record<string, any> = {}

  // Priority 1: Check for another player's planet
  const { data: otherPlanet } = await supabase.from('planets')
    .select('id, player_id, name, coordinates')
    .eq('coordinates', targetCoords)
    .neq('player_id', userId)
    .limit(1)
    .single()

  if (otherPlanet) {
    const { data: owner } = await supabase.from('players').select('username').eq('id', otherPlanet.player_id).single()
    locationType = 'player_colony'
    name = otherPlanet.name
    metadata = { owner_id: otherPlanet.player_id, owner_username: owner?.username ?? 'Unknown', planet_id: otherPlanet.id }
  } else {
    // Priority 2: Check for habitable planet
    const { data: habitablePlanet } = await supabase.from('galaxy_planets')
      .select('id, name, diameter, max_building_slots, claimed_by')
      .eq('coordinates', targetCoords)
      .single()

    if (habitablePlanet && !habitablePlanet.claimed_by) {
      locationType = 'habitable_planet'
      name = habitablePlanet.name
      metadata = { galaxy_planet_id: habitablePlanet.id, diameter: habitablePlanet.diameter, max_building_slots: habitablePlanet.max_building_slots }
    } else {
      // Priority 3: Check for own planet (can't "discover" yourself)
      const { data: ownPlanet } = await supabase.from('planets')
        .select('id')
        .eq('coordinates', targetCoords)
        .eq('player_id', userId)
        .single()

      if (ownPlanet) {
        return new Response(JSON.stringify({ error: 'That is your own planet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Priority 4: Roll random location
      locationType = rollLocationType()
      name = randomLocationName(locationType)
      if (locationType === 'asteroid_field') metadata.richness = Math.floor(Math.random() * 5) + 1
      if (locationType === 'bandit_camp') metadata.size = Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large'
      if (locationType === 'debris_field') metadata.salvage_metal = Math.floor(Math.random() * 800 + 200)
    }
  }

  // Upsert into galaxy_map (may or may not have a prior 'detected' entry)
  if (existing) {
    await supabase.from('galaxy_map').update({
      visibility: 'revealed',
      location_type: locationType,
      name,
      metadata,
      revealed_at: now.toISOString(),
      cleared_at: null,
      respawns_at: null,
    }).eq('id', existing.id)
  } else {
    await supabase.from('galaxy_map').insert({
      player_id: userId,
      coordinates: targetCoords,
      visibility: 'revealed',
      location_type: locationType,
      name,
      metadata,
      detected_at: now.toISOString(),
      revealed_at: now.toISOString(),
    })
  }

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'scan_result',
    message: `Scan of ${targetCoords} revealed: ${name}`,
    metadata: { coordinates: targetCoords, location_type: locationType, name },
  })

  return new Response(JSON.stringify({ success: true, location_type: locationType, name }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): add scan_coordinate action for targeted probing"
```

---

## Task 4: Edge function — attack_player action

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (route + handler)

- [ ] **Step 1: Add route**

After `scan_coordinate` in the action dispatcher:

```typescript
    if (action === 'attack_player') {
      return await handleAttackPlayer(supabase, user.id, planetId, body.targetCoords, body.fleet, !!devMode, corsHeaders)
    }
```

- [ ] **Step 2: Add handleAttackPlayer handler**

Add after the scan_coordinate handler:

```typescript
// deno-lint-ignore no-explicit-any
async function handleAttackPlayer(
  supabase: any, userId: string, planetId: string,
  targetCoords: string, fleet: Record<string, number>,
  devMode: boolean, cors: Record<string, string>
) {
  const { data: planet } = await supabase.from('planets').select('id, player_id, coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Verify target is a discovered player_colony
  const { data: mapEntry } = await supabase.from('galaxy_map').select('*').eq('player_id', userId).eq('coordinates', targetCoords).single()
  if (!mapEntry || mapEntry.location_type !== 'player_colony') {
    return new Response(JSON.stringify({ error: 'Target is not a discovered player colony' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const meta = mapEntry.metadata as { owner_id: string; planet_id: string; owner_username: string }
  if (meta.owner_id === userId) {
    return new Response(JSON.stringify({ error: 'Cannot attack your own planet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Verify defender planet still exists at those coordinates
  const { data: defenderPlanet } = await supabase.from('planets')
    .select('id, player_id')
    .eq('id', meta.planet_id)
    .single()
  if (!defenderPlanet) {
    return new Response(JSON.stringify({ error: 'Target planet no longer exists' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate fleet — must have at least one combat ship
  if (!fleet || Object.values(fleet).every((c) => c <= 0)) {
    return new Response(JSON.stringify({ error: 'Must send at least one ship' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Validate and deduct ships from planet
  let slowest = 999
  for (const [shipType, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const stats = SHIP_STATS[shipType]
    if (!stats) return new Response(JSON.stringify({ error: `Unknown ship: ${shipType}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    slowest = Math.min(slowest, stats.speed)

    const { data: shipRow } = await supabase.from('planet_ships').select('count').eq('planet_id', planetId).eq('ship_type', shipType).single()
    const available = shipRow?.count ?? 0
    if (available < count) {
      return new Response(JSON.stringify({ error: `Not enough ${shipType} (have ${available}, need ${count})` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    await supabase.from('planet_ships').update({ count: available - count }).eq('planet_id', planetId).eq('ship_type', shipType)
  }

  // Calculate travel time
  const distance = coordDistance(planet.coordinates, targetCoords)
  const travelSeconds = devMode ? 10 : Math.max(60, Math.floor((distance / slowest) * 60))
  const now = new Date()
  const arrivesAt = new Date(now.getTime() + travelSeconds * 1000)

  // Create attack record
  const { data: attack } = await supabase.from('player_attacks').insert({
    attacker_id: userId,
    attacker_planet_id: planetId,
    defender_id: defenderPlanet.player_id,
    defender_planet_id: defenderPlanet.id,
    fleet,
    status: 'in_transit',
    dispatched_at: now.toISOString(),
    arrives_at: arrivesAt.toISOString(),
    target_coordinates: targetCoords,
  }).select('id').single()

  // Event on attacker's planet
  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'attack_dispatched',
    message: `Attack fleet dispatched to ${meta.owner_username}'s colony at ${targetCoords}`,
    metadata: { attack_id: attack?.id, target_coords: targetCoords, target_owner: meta.owner_username },
  })

  // Warning event on defender's planet
  await supabase.from('planet_events').insert({
    planet_id: defenderPlanet.id,
    event_type: 'incoming_attack',
    message: `Warning: Incoming attack fleet detected! ETA: ${Math.ceil(travelSeconds / 60)} minutes`,
    metadata: { attack_id: attack?.id, attacker_id: userId },
  })

  return new Response(JSON.stringify({ success: true, attackId: attack?.id, arrivesAt: arrivesAt.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): add attack_player fleet dispatch"
```

---

## Task 5: Edge function — resolve_attack action

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (route + handler)

- [ ] **Step 1: Add route**

```typescript
    if (action === 'resolve_attack') {
      return await handleResolveAttack(supabase, user.id, body.attackId, corsHeaders)
    }
    if (action === 'return_fleet') {
      return await handleReturnFleet(supabase, user.id, body.attackId, corsHeaders)
    }
```

- [ ] **Step 2: Add handleResolveAttack handler**

```typescript
// deno-lint-ignore no-explicit-any
async function handleResolveAttack(supabase: any, userId: string, attackId: string, cors: Record<string, string>) {
  const { data: attack } = await supabase.from('player_attacks').select('*').eq('id', attackId).single()
  if (!attack) return new Response(JSON.stringify({ error: 'Attack not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (attack.status !== 'in_transit') return new Response(JSON.stringify({ error: 'Attack already resolved' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Either attacker or defender can trigger resolution
  if (attack.attacker_id !== userId && attack.defender_id !== userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const now = new Date()
  if (new Date(attack.arrives_at) > now) {
    return new Response(JSON.stringify({ error: 'Attack has not arrived yet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Get defender's stationed fleet
  const { data: defenderShips } = await supabase.from('planet_ships').select('ship_type, count').eq('planet_id', attack.defender_planet_id)
  const defenderFleet: Record<string, { count: number; hp: number; attack: number; defense: number }> = {}
  for (const row of (defenderShips ?? [])) {
    if (row.count <= 0) continue
    const stats = SHIP_STATS[row.ship_type]
    if (!stats) continue
    defenderFleet[row.ship_type] = { count: row.count, hp: stats.defense * 3, attack: stats.attack, defense: stats.defense }
  }

  // Run combat
  const hasDefenders = Object.values(defenderFleet).some((d) => d.count > 0)
  const attackerFleet = attack.fleet as Record<string, number>
  let combat
  if (hasDefenders) {
    combat = resolveCombat(attackerFleet, defenderFleet)
  } else {
    // Undefended — attacker wins automatically
    combat = { victory: true, rounds: [], attackerLosses: {}, defenderLosses: {} }
  }

  // Calculate surviving attacker fleet
  const survivingAttackerFleet: Record<string, number> = { ...attackerFleet }
  for (const [t, l] of Object.entries(combat.attackerLosses)) {
    survivingAttackerFleet[t] = Math.max(0, (survivingAttackerFleet[t] ?? 0) - l)
  }

  // Update defender's fleet (subtract losses)
  for (const [t, l] of Object.entries(combat.defenderLosses)) {
    if (l <= 0) continue
    const { data: row } = await supabase.from('planet_ships').select('count').eq('planet_id', attack.defender_planet_id).eq('ship_type', t).single()
    const newCount = Math.max(0, (row?.count ?? 0) - l)
    await supabase.from('planet_ships').update({ count: newCount }).eq('planet_id', attack.defender_planet_id).eq('ship_type', t)
  }

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
        // Steal up to 50% of defender's resources, limited by cargo
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

  // If attacker has survivors, create return trip
  const totalSurvivors = Object.values(survivingAttackerFleet).reduce((s, c) => s + c, 0)
  let returnArrivesAt: string | null = null
  if (combat.victory && totalSurvivors > 0) {
    const distance = coordDistance(attack.target_coordinates, (await supabase.from('planets').select('coordinates').eq('id', attack.attacker_planet_id).single()).data?.coordinates ?? '1:1:1')
    let slowest = 999
    for (const [type, count] of Object.entries(survivingAttackerFleet)) {
      if (count > 0 && SHIP_STATS[type]) slowest = Math.min(slowest, SHIP_STATS[type].speed)
    }
    const returnSeconds = Math.max(60, Math.floor((distance / slowest) * 60))
    returnArrivesAt = new Date(now.getTime() + returnSeconds * 1000).toISOString()
  }

  const result = {
    victory: combat.victory,
    rounds: combat.rounds,
    attacker_losses: combat.attackerLosses,
    defender_losses: combat.defenderLosses,
    stolen: { metal: stolenMetal, gas: stolenGas },
    surviving_fleet: survivingAttackerFleet,
  }

  await supabase.from('player_attacks').update({
    status: combat.victory && totalSurvivors > 0 ? 'returning' : 'resolved',
    resolved_at: now.toISOString(),
    return_arrives_at: returnArrivesAt,
    result,
  }).eq('id', attackId)

  // Combat report for attacker
  const attackerMsg = combat.victory
    ? `Attack on ${attack.target_coordinates} succeeded! Stole ${stolenMetal} metal, ${stolenGas} gas. Fleet returning.`
    : `Attack on ${attack.target_coordinates} failed. All ships lost.`
  await supabase.from('planet_events').insert({
    planet_id: attack.attacker_planet_id,
    event_type: 'attack_result',
    message: attackerMsg,
    metadata: { attack_id: attackId, result },
  })

  // Combat report for defender
  const defenderMsg = combat.victory
    ? `Your colony was raided! Lost ${stolenMetal} metal, ${stolenGas} gas.`
    : `Incoming attack repelled! Enemy fleet destroyed.`
  await supabase.from('planet_events').insert({
    planet_id: attack.defender_planet_id,
    event_type: 'attack_result',
    message: defenderMsg,
    metadata: { attack_id: attackId, result },
  })

  return new Response(JSON.stringify({ success: true, result }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 3: Add handleReturnFleet handler**

```typescript
// deno-lint-ignore no-explicit-any
async function handleReturnFleet(supabase: any, userId: string, attackId: string, cors: Record<string, string>) {
  const { data: attack } = await supabase.from('player_attacks').select('*').eq('id', attackId).eq('attacker_id', userId).single()
  if (!attack) return new Response(JSON.stringify({ error: 'Attack not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (attack.status !== 'returning') return new Response(JSON.stringify({ error: 'Fleet not returning' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const now = new Date()
  if (new Date(attack.return_arrives_at) > now) {
    return new Response(JSON.stringify({ error: 'Fleet has not arrived yet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const result = attack.result as { surviving_fleet: Record<string, number>; stolen: { metal: number; gas: number } }

  // Return ships to planet
  for (const [type, count] of Object.entries(result.surviving_fleet)) {
    if (count <= 0) continue
    const { data: row } = await supabase.from('planet_ships').select('count').eq('planet_id', attack.attacker_planet_id).eq('ship_type', type).single()
    await supabase.from('planet_ships').update({ count: (row?.count ?? 0) + count }).eq('planet_id', attack.attacker_planet_id).eq('ship_type', type)
  }

  // Add stolen resources
  const { data: planet } = await supabase.from('planets').select('metal_amount, gas_amount').eq('id', attack.attacker_planet_id).single()
  if (planet) {
    await supabase.from('planets').update({
      metal_amount: planet.metal_amount + result.stolen.metal,
      gas_amount: planet.gas_amount + result.stolen.gas,
    }).eq('id', attack.attacker_planet_id)
  }

  await supabase.from('player_attacks').update({ status: 'resolved' }).eq('id', attackId)

  await supabase.from('planet_events').insert({
    planet_id: attack.attacker_planet_id,
    event_type: 'fleet_returned',
    message: `Raiding fleet returned with ${result.stolen.metal} metal, ${result.stolen.gas} gas`,
    metadata: { attack_id: attackId },
  })

  return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): add resolve_attack and return_fleet handlers"
```

---

## Task 6: Edge function — spawn_test_opponent (dev-only)

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (route + handler)

- [ ] **Step 1: Add route**

```typescript
    if (action === 'spawn_test_opponent') {
      return await handleSpawnTestOpponent(supabase, user.id, planetId, !!devMode, corsHeaders)
    }
```

- [ ] **Step 2: Add handler**

```typescript
// deno-lint-ignore no-explicit-any
async function handleSpawnTestOpponent(supabase: any, userId: string, planetId: string, devMode: boolean, cors: Record<string, string>) {
  if (!devMode) {
    return new Response(JSON.stringify({ error: 'Dev mode only' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { data: planet } = await supabase.from('planets').select('coordinates').eq('id', planetId).eq('player_id', userId).single()
  if (!planet) return new Response(JSON.stringify({ error: 'Planet not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })

  const homeCoord = parseCoord(planet.coordinates)

  // Create a test auth user via admin API
  const testEmail = `test-opponent-${Date.now()}@starveil-dev.local`
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'test-opponent-password-12345',
    email_confirm: true,
  })
  if (authErr || !authUser?.user) {
    return new Response(JSON.stringify({ error: 'Failed to create test user: ' + (authErr?.message ?? 'unknown') }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const opponentId = authUser.user.id
  const opponentName = `TestOpponent_${Math.floor(Math.random() * 9999)}`

  // Create player record
  await supabase.from('players').insert({ id: opponentId, username: opponentName })

  // Place opponent 2-5 systems away
  const offset = Math.floor(Math.random() * 4) + 2
  const dir = Math.random() > 0.5 ? 1 : -1
  const opponentCoords = `${homeCoord.galaxy}:${Math.max(1, homeCoord.system + offset * dir)}:${Math.floor(Math.random() * 15) + 1}`

  // Create planet
  const { data: opponentPlanet } = await supabase.from('planets').insert({
    player_id: opponentId,
    name: `${opponentName}'s Colony`,
    coordinates: opponentCoords,
    diameter: 12400,
    max_building_slots: 12,
    metal_amount: 50000,
    gas_amount: 30000,
  }).select('id').single()

  if (!opponentPlanet) {
    return new Response(JSON.stringify({ error: 'Failed to create opponent planet' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Initialize buildings
  await supabase.from('planet_buildings').insert([
    { planet_id: opponentPlanet.id, building_id: 'headquarters', level: 3 },
    { planet_id: opponentPlanet.id, building_id: 'metal_mine', level: 5 },
    { planet_id: opponentPlanet.id, building_id: 'gas_refinery', level: 4 },
    { planet_id: opponentPlanet.id, building_id: 'solar_array', level: 5 },
    { planet_id: opponentPlanet.id, building_id: 'shipyard', level: 4 },
  ])

  // Stock with ships
  await supabase.from('planet_ships').insert([
    { planet_id: opponentPlanet.id, ship_type: 'small_fighter', count: 10 },
    { planet_id: opponentPlanet.id, ship_type: 'large_fighter', count: 3 },
    { planet_id: opponentPlanet.id, ship_type: 'small_cargo', count: 5 },
  ])

  // Initialize weather
  await supabase.from('planet_weather').insert({ planet_id: opponentPlanet.id, weather_type: 'calm_skies', expires_at: null })

  // Auto-discover opponent on the player's galaxy map
  await supabase.from('galaxy_map').upsert({
    player_id: userId,
    coordinates: opponentCoords,
    visibility: 'revealed',
    location_type: 'player_colony',
    name: `${opponentName}'s Colony`,
    metadata: { owner_id: opponentId, owner_username: opponentName, planet_id: opponentPlanet.id },
    detected_at: new Date().toISOString(),
    revealed_at: new Date().toISOString(),
  }, { onConflict: 'player_id,coordinates' })

  return new Response(JSON.stringify({
    success: true,
    opponent: { id: opponentId, username: opponentName, coordinates: opponentCoords, planetId: opponentPlanet.id },
  }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(pvp): add dev-only spawn_test_opponent"
```

---

## Task 7: Frontend — useAttacks hook + usePlanet integration

**Files:**
- Create: `src/hooks/useAttacks.ts`
- Modify: `src/hooks/usePlanet.ts` — Add `PlayerAttack` type, fetch attacks
- Modify: `src/components/Layout.tsx` — Pass attacks through context

- [ ] **Step 1: Add PlayerAttack type to usePlanet.ts**

After the `PlayerAchievement` type (~line 93):

```typescript
export type PlayerAttack = {
  id: string
  attacker_id: string
  attacker_planet_id: string
  defender_id: string
  defender_planet_id: string
  fleet: Record<string, number>
  status: 'in_transit' | 'returning' | 'resolved'
  dispatched_at: string
  arrives_at: string
  return_arrives_at: string | null
  resolved_at: string | null
  result: {
    victory?: boolean
    stolen?: { metal: number; gas: number }
    surviving_fleet?: Record<string, number>
    attacker_losses?: Record<string, number>
    defender_losses?: Record<string, number>
  } | null
  target_coordinates: string
}
```

- [ ] **Step 2: Add attacks state and fetch in usePlanet.ts**

Add state after `achievements`:

```typescript
  const [outgoingAttacks, setOutgoingAttacks] = useState<PlayerAttack[]>([])
  const [incomingAttacks, setIncomingAttacks] = useState<PlayerAttack[]>([])
```

Add to the `Promise.all` array (after `achievementsRes`):

```typescript
        supabase
          .from('player_attacks')
          .select('*')
          .eq('attacker_id', playerId)
          .neq('status', 'resolved')
          .order('dispatched_at', { ascending: false }),
        supabase
          .from('player_attacks')
          .select('*')
          .eq('defender_id', playerId)
          .neq('status', 'resolved')
          .order('dispatched_at', { ascending: false }),
```

Update the destructuring to include `outgoingAttacksRes` and `incomingAttacksRes`, and add:

```typescript
      if (outgoingAttacksRes.data) setOutgoingAttacks(outgoingAttacksRes.data)
      if (incomingAttacksRes.data) setIncomingAttacks(incomingAttacksRes.data)
```

Add to the return object:

```typescript
    outgoingAttacks,
    incomingAttacks,
```

- [ ] **Step 3: Create useAttacks.ts**

```typescript
import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PlayerAttack } from './usePlanet'

export function useAttacks(
  planetId: string | undefined,
  outgoingAttacks: PlayerAttack[],
  incomingAttacks: PlayerAttack[],
  onComplete: () => void
) {
  const resolvingRef = useRef<Set<string>>(new Set())

  const resolveAttack = useCallback(async (attackId: string, action: string) => {
    if (!planetId || resolvingRef.current.has(attackId)) return
    resolvingRef.current.add(attackId)
    try {
      await supabase.functions.invoke('game-action', {
        body: { action, planetId, attackId },
      })
      onComplete()
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      resolvingRef.current.delete(attackId)
    }
  }, [planetId, onComplete])

  useEffect(() => {
    const allAttacks = [...outgoingAttacks, ...incomingAttacks]
    if (allAttacks.length === 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      for (const attack of allAttacks) {
        if (attack.status === 'in_transit' && new Date(attack.arrives_at).getTime() <= now) {
          resolveAttack(attack.id, 'resolve_attack')
        } else if (attack.status === 'returning' && attack.return_arrives_at && new Date(attack.return_arrives_at).getTime() <= now) {
          resolveAttack(attack.id, 'return_fleet')
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [outgoingAttacks, incomingAttacks, resolveAttack])

  const dispatchAttack = useCallback(
    async (fleet: Record<string, number>, targetCoords: string, devMode: boolean) => {
      if (!planetId) return
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'attack_player', planetId, fleet, targetCoords, devMode },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      onComplete()
      return data
    },
    [planetId, onComplete]
  )

  return { outgoingAttacks, incomingAttacks, dispatchAttack }
}
```

- [ ] **Step 4: Wire into Layout.tsx**

Import `useAttacks` and call it after `useWeather`:

```typescript
import { useAttacks } from '../hooks/useAttacks'

// Inside Layout():
  const { outgoingAttacks, incomingAttacks, dispatchAttack } = useAttacks(
    planet?.id,
    outgoingAttacks: outgoingAttacksRaw,
    incomingAttacks: incomingAttacksRaw,
    refetchAll
  )
```

Note: rename the raw data from `usePlanet` to avoid conflicts:
- In the `usePlanet` destructuring, rename: `outgoingAttacks: outgoingAttacksRaw, incomingAttacks: incomingAttacksRaw`
- Pass the raw arrays to `useAttacks`
- Add to Outlet context: `outgoingAttacks, incomingAttacks, dispatchAttack`
- Add to `GameContext` type:
  ```typescript
  outgoingAttacks: PlayerAttack[]
  incomingAttacks: PlayerAttack[]
  dispatchAttack: ReturnType<typeof useAttacks>['dispatchAttack']
  ```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAttacks.ts src/hooks/usePlanet.ts src/components/Layout.tsx
git commit -m "feat(pvp): add useAttacks hook and wire into Layout context"
```

---

## Task 8: Galaxy map — player colony markers + attack UI

**Files:**
- Modify: `src/pages/GalaxyMapPage.tsx`

This is the largest frontend task. Adds:
1. Player colony tile (red/orange planet icon)
2. Attack button in detail panel
3. Fleet selector modal for attack dispatch
4. Attack fleet dots (outgoing and incoming)
5. Scan coordinate input

- [ ] **Step 1: Add PlayerColonyTile component**

After `HabitablePlanetTile`:

```typescript
function PlayerColonyTile() {
  return (
    <div
      className="w-[28px] h-[28px] rounded-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 35% 35%, #f87171 0%, #dc2626 40%, #7f1d1d 80%)',
        boxShadow: '0 0 12px rgba(248,113,113,0.3)',
      }}
    >
      <div className="absolute w-[8px] h-[3px] bg-red-300/40 rounded-full top-[25%] left-[20%] -rotate-[15deg]" />
      <div className="absolute w-[10px] h-[3px] bg-red-400/25 rounded-full top-[55%] left-[40%] rotate-[10deg]" />
    </div>
  )
}
```

- [ ] **Step 2: Update LocationNode tile classes for player_colony**

In the `tileClasses` chain, add after `habitable_planet`:

```typescript
      : type === 'player_colony'
        ? 'w-[50px] h-[50px] rounded-full border-[1.5px] border-red-500/25 bg-gradient-to-br from-red-900/20 to-red-950/30'
```

In `labelColor`, add after `habitable_planet`:

```typescript
    : type === 'player_colony' ? 'text-red-400'
```

Add render in the tile content area:

```typescript
        {!isDetected && type === 'player_colony' && <PlayerColonyTile />}
```

- [ ] **Step 3: Update minimap dot color**

```typescript
      case 'player_colony': return 'bg-red-500'
```

- [ ] **Step 4: Update DetailPanel for player_colony**

Add `player_colony` to typeLabel, titleColor, badgeBg, and description mappings. Add attack button.

typeLabel: `type === 'player_colony' ? 'Player Colony'`

titleColor: `type === 'player_colony' ? 'text-red-400'`

badgeBg: `type === 'player_colony' ? 'bg-red-500/10 border-red-500/20 text-red-600'`

description: `type === 'player_colony' ? \`A colony belonging to ${(meta?.owner_username as string) ?? 'unknown'}. Send an attack fleet to raid their resources.\``

Add metadata display for player_colony:

```typescript
            {!isDetected && type === 'player_colony' && (
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Owner</div>
                <div className="text-[13px] font-semibold text-red-400">{(meta?.owner_username as string) ?? 'Unknown'}</div>
              </div>
            )}
```

Add attack button in actions section:

```typescript
          {!isDetected && type === 'player_colony' && (
            <button
              onClick={() => onAttack(entry.coordinates)}
              disabled={sending}
              className="w-full py-2 text-[11px] font-semibold rounded-lg text-white disabled:opacity-40 transition-colors"
              style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', boxShadow: '0 2px 8px rgba(220,38,38,0.25)' }}
            >
              {sending ? 'Dispatching...' : 'Send Attack Fleet'}
            </button>
          )}
```

Add `onAttack` prop to DetailPanel:

```typescript
  onAttack: (coords: string) => void
```

- [ ] **Step 5: Add attack fleet dots**

In GalaxyMapPage, add an `AttackDot` component (similar to `MissionDot`) that reads from `outgoingAttacks` and `incomingAttacks`. Outgoing attacks interpolate from your planet to target. Incoming attacks interpolate from source to your planet. Returning fleets interpolate from target back to your planet.

```typescript
function AttackDot({
  attack,
  homeCoords,
  isIncoming,
}: {
  attack: PlayerAttack
  homeCoords: string
  isIncoming: boolean
}) {
  const dispatched = new Date(attack.dispatched_at).getTime()
  const arrives = new Date(attack.arrives_at).getTime()
  const now = Date.now()

  const targetPos = coordsToPosition(attack.target_coordinates, homeCoords)

  let x: number, y: number
  if (attack.status === 'in_transit') {
    const progress = Math.min(1, Math.max(0, (now - dispatched) / (arrives - dispatched)))
    if (isIncoming) {
      // Moving from target toward home
      x = targetPos.x + (HOME_X - targetPos.x) * progress
      y = targetPos.y + (HOME_Y - targetPos.y) * progress
    } else {
      // Moving from home toward target
      x = HOME_X + (targetPos.x - HOME_X) * progress
      y = HOME_Y + (targetPos.y - HOME_Y) * progress
    }
  } else if (attack.status === 'returning' && attack.return_arrives_at) {
    const resolvedAt = new Date(attack.resolved_at!).getTime()
    const returnArrives = new Date(attack.return_arrives_at).getTime()
    const progress = Math.min(1, Math.max(0, (now - resolvedAt) / (returnArrives - resolvedAt)))
    x = targetPos.x + (HOME_X - targetPos.x) * progress
    y = targetPos.y + (HOME_Y - targetPos.y) * progress
  } else {
    return null
  }

  const color = isIncoming ? '#ef4444' : '#f97316'
  const glowColor = isIncoming ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'

  return (
    <div
      className="absolute z-[8] pointer-events-none transition-all duration-[5000ms] ease-linear"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: glowColor, width: 10, height: 10, margin: -2 }}
      />
      <div
        className="w-[6px] h-[6px] rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${glowColor}` }}
      />
      <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-semibold" style={{ color }}>
        {isIncoming ? 'INCOMING' : attack.status === 'returning' ? 'RETURNING' : 'ATTACK'}
      </div>
    </div>
  )
}
```

Render the dots in the canvas area, after `MissionDot`:

```typescript
          {/* Attack dots */}
          {outgoingAttacks.map((attack) => (
            <AttackDot key={`atk-${attack.id}`} attack={attack} homeCoords={planet.coordinates} isIncoming={false} />
          ))}
          {incomingAttacks.map((attack) => (
            <AttackDot key={`def-${attack.id}`} attack={attack} homeCoords={planet.coordinates} isIncoming={true} />
          ))}
```

Also add SVG route lines for attacks (red dashed lines).

- [ ] **Step 6: Add scan coordinate button to header**

Next to the existing search input, add a "Scan" button that calls `scan_coordinate`:

```typescript
          <button
            onClick={handleScanCoordinate}
            disabled={sending || probeCount === 0 || !searchCoords.trim()}
            className="px-3 py-1.5 text-[10px] font-medium rounded bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Scan
          </button>
```

Add handler:

```typescript
  const handleScanCoordinate = async () => {
    const coords = searchCoords.trim()
    if (!coords) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'scan_coordinate', planetId: planet.id, targetCoords: coords },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setSearchCoords('')
      await refetch()
    } catch (err) {
      setSearchError((err as Error).message)
      setTimeout(() => setSearchError(''), 3000)
    } finally {
      setSending(false)
    }
  }
```

- [ ] **Step 7: Add attack dispatch handler and fleet selector state**

In `GalaxyMapPage`, add state for attack fleet selection:

```typescript
  const [attackTarget, setAttackTarget] = useState<string | null>(null)
  const [attackFleet, setAttackFleet] = useState<Record<string, number>>({})
  const [attackError, setAttackError] = useState<string | null>(null)
```

When the "Send Attack Fleet" button is clicked in the detail panel, set `attackTarget` to open the fleet selector overlay. The overlay shows available combat ships with +/- controls, then a "Launch Attack" button.

Add `AttackFleetSelector` as an overlay component rendered in the map viewport:

```typescript
function AttackFleetSelector({
  shipFleet,
  attackFleet,
  setAttackFleet,
  onLaunch,
  onCancel,
  sending,
  error,
}: {
  shipFleet: { ship_type: string; count: number }[]
  attackFleet: Record<string, number>
  setAttackFleet: React.Dispatch<React.SetStateAction<Record<string, number>>>
  onLaunch: () => void
  onCancel: () => void
  sending: boolean
  error: string | null
}) {
  const combatShips = SHIPS.filter((s) => s.stats.attackPower > 0)

  return (
    <div
      data-clickable
      className="absolute bottom-0 left-0 right-0 z-[30] border-t border-red-700/20 px-5 py-4 backdrop-blur-xl"
      style={{ background: 'linear-gradient(180deg, rgba(30,10,10,0.95), rgba(15,5,5,0.98))' }}
    >
      <div className="text-sm font-bold text-red-400 mb-3">Select Attack Fleet</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {combatShips.map((ship) => {
          const available = shipFleet.find((s) => s.ship_type === ship.id)?.count ?? 0
          const selected = attackFleet[ship.id] ?? 0
          if (available === 0 && selected === 0) return null
          return (
            <div key={ship.id} className="flex items-center gap-2 bg-slate-800/40 rounded px-2 py-1.5">
              <span className="text-xs text-slate-300 flex-1">{ship.name}</span>
              <span className="text-[10px] text-slate-500">{available}</span>
              <input
                type="number"
                min={0}
                max={available}
                value={selected}
                onChange={(e) => setAttackFleet((f) => ({ ...f, [ship.id]: Math.max(0, Math.min(available, Number(e.target.value) || 0)) }))}
                className="w-12 bg-slate-900 border border-slate-700/40 rounded px-1 py-0.5 text-xs text-slate-200 text-center focus:border-red-500/40 focus:outline-none"
              />
            </div>
          )
        })}
      </div>
      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={onLaunch}
          disabled={sending || Object.values(attackFleet).every((c) => c <= 0)}
          className="flex-1 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 transition-colors cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}
        >
          {sending ? 'Launching...' : 'Launch Attack'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-700/30 border border-slate-600/12 rounded-lg transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

Wire the launch handler:

```typescript
  const handleLaunchAttack = async () => {
    if (!attackTarget) return
    setSending(true)
    setAttackError(null)
    try {
      await dispatchAttack(attackFleet, attackTarget, IS_DEV_MODE)
      setAttackTarget(null)
      setAttackFleet({})
      setSelected(null)
    } catch (err) {
      setAttackError((err as Error).message)
    } finally {
      setSending(false)
    }
  }
```

Import `IS_DEV_MODE` from `../lib/devMode` and `SHIPS` from `../config/ships`, and import the `PlayerAttack` type. Destructure `outgoingAttacks, incomingAttacks, dispatchAttack` from `useOutletContext<GameContext>()`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/GalaxyMapPage.tsx
git commit -m "feat(pvp): player colony markers, attack UI, fleet dots on galaxy map"
```

---

## Task 9: Dev-mode spawn button + incoming attack banner

**Files:**
- Modify: `src/pages/GalaxyMapPage.tsx` — Add "Spawn Test Opponent" dev button
- Modify: `src/components/ResourceBar.tsx` — Add incoming attack warning indicator

- [ ] **Step 1: Add dev-mode spawn button to galaxy map header**

In the header section, if `IS_DEV_MODE` is true, add:

```typescript
          {IS_DEV_MODE && (
            <button
              onClick={handleSpawnOpponent}
              disabled={sending}
              className="px-3 py-1.5 text-[10px] font-medium rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 disabled:opacity-40 transition-colors"
            >
              Spawn Opponent
            </button>
          )}
```

Handler:

```typescript
  const handleSpawnOpponent = async () => {
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'spawn_test_opponent', planetId: planet.id, devMode: true },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await refetch()
    } catch (err) {
      console.error('Failed to spawn opponent:', err)
    } finally {
      setSending(false)
    }
  }
```

- [ ] **Step 2: Add incoming attack indicator to ResourceBar**

Add `incomingAttackCount` prop to ResourceBar:

```typescript
  incomingAttackCount: number
```

In the ResourceBar, after the weather section, add:

```typescript
        {incomingAttackCount > 0 && (
          <span className="text-red-400 font-semibold animate-pulse">
            ⚠ {incomingAttackCount} incoming {incomingAttackCount === 1 ? 'attack' : 'attacks'}
          </span>
        )}
```

Pass the prop from Layout:

```typescript
          incomingAttackCount={incomingAttacks.filter((a) => a.status === 'in_transit').length}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/GalaxyMapPage.tsx src/components/ResourceBar.tsx src/components/Layout.tsx
git commit -m "feat(pvp): dev spawn button and incoming attack warning"
```

---

## Task 10: Tests + final verification

**Files:**
- Modify: `src/config/__tests__/ships.test.ts` — Already updated (10 ships)
- Run all tests and type check

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Apply migration and deploy**

```bash
npx supabase db push
npx supabase functions deploy game-action --no-verify-jwt
```

- [ ] **Step 5: Manual testing checklist**

1. Open galaxy map → click "Spawn Opponent" (dev mode)
2. Red planet marker appears on map with opponent's name
3. Click player colony → detail panel shows owner, "Send Attack Fleet" button
4. Click "Send Attack Fleet" → fleet selector opens
5. Select ships → "Launch Attack" → orange attack dot moves toward target
6. After arrival (10s in dev mode) → combat resolves, event log shows result
7. If won: fleet returns (orange returning dot), resources added on arrival
8. Use "Scan" button with known opponent coordinates → discovers player colony
9. Check resource bar shows "incoming attack" warning (test from opponent's perspective with two browsers)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(pvp): async raids - player discovery, attacks, combat, fleet dots"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `010_pvp_attacks.sql` |
| 2 | Probe detects player colonies | `game-action/index.ts` |
| 3 | scan_coordinate action | `game-action/index.ts` |
| 4 | attack_player dispatch | `game-action/index.ts` |
| 5 | resolve_attack + return_fleet | `game-action/index.ts` |
| 6 | spawn_test_opponent (dev) | `game-action/index.ts` |
| 7 | useAttacks hook + Layout wiring | `useAttacks.ts`, `usePlanet.ts`, `Layout.tsx` |
| 8 | Galaxy map: markers + attack UI | `GalaxyMapPage.tsx` |
| 9 | Dev spawn button + attack banner | `GalaxyMapPage.tsx`, `ResourceBar.tsx`, `Layout.tsx` |
| 10 | Tests, type check, deploy, manual test | All |
