# Cooperative Apex World Boss Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship cooperative global apex world boss events (herald → active → killed/escaped lifecycle) while leaving minor/elite bosses' solo flow untouched.

**Architecture:** A single server-wide event is represented by a row in new table `apex_boss_events` plus an existing `galaxy_map` row carrying live HP and per-player damage in its JSONB `metadata`. Player raids into an active apex event reuse the existing mission dispatch pipeline; the resolution handler branches on `metadata.phase === 'active'` and calls a new pure helper `computeApexDamage()` extracted to `src/lib/` for unit-testability. Phase transitions (activate, expire) are client-tick-driven in v1 (identical pattern to `useAttacks.ts`), deferring automated scheduling to v2.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase (Postgres + Deno edge functions), Tailwind.

**Reference spec:** `docs/superpowers/specs/2026-04-19-coop-apex-world-bosses-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/013_apex_boss_events.sql` — two new tables + RLS.
- `src/lib/apexContribution.ts` — pure damage/reward math (unit-testable).
- `src/lib/__tests__/apexContribution.test.ts` — Vitest suite for above.
- `src/hooks/useApexEvent.ts` — client hook: fetches the single active/heralded event, drives tick actions (`activate_apex_event`, `resolve_apex_event`).
- `src/components/ApexEventBanner.tsx` — global banner shown in Layout during herald/active.

**Modified files:**
- `src/config/bosses.ts` — add `APEX_EVENT_CONFIG` constant.
- `supabase/functions/game-action/index.ts` — add `handleHeraldApexBoss`, `handleActivateApexEvent`, `handleResolveApexEvent`; extend `handleResolveMission` raid branch to detect apex active events; add new action routes.
- `src/pages/GalaxyMapPage.tsx` — dev-mode "Herald Apex Boss" button; render heralded vs. active differently; show HP bar + contributors in detail panel.
- `src/pages/MissionsPage.tsx` — apex warning panel (HP %, top contributors, time remaining).
- `src/pages/LeaderboardPage.tsx` — "Apex Events" tab with per-event contributor breakdown.
- `src/components/Layout.tsx` — mount `ApexEventBanner`.

---

## Task 1: Migration 013 — `apex_boss_events` and `world_boss_contributions`

**Files:**
- Create: `supabase/migrations/013_apex_boss_events.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Apex world boss events: global, time-bounded, cooperative encounters.
-- Lifecycle: heralded -> active -> (killed | escaped).
-- Solo minor/elite boss flow (world_boss_kills) remains unchanged.

create table apex_boss_events (
  id              uuid primary key default gen_random_uuid(),
  boss_id         text not null,
  galaxy_map_id   uuid not null references galaxy_map(id) on delete cascade,
  phase           text not null check (phase in ('heralded','active','killed','escaped')),
  heralded_at     timestamptz not null default now(),
  activates_at    timestamptz not null,
  expires_at      timestamptz not null,
  resolved_at     timestamptz,
  killing_player  uuid references players(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index apex_boss_events_phase on apex_boss_events (phase, activates_at);

alter table apex_boss_events enable row level security;
create policy "apex_boss_events_public_read" on apex_boss_events
  for select using (true);

create table world_boss_contributions (
  event_id        uuid not null references apex_boss_events(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  damage_dealt    integer not null default 0,
  rewarded_metal  integer not null default 0,
  rewarded_gas    integer not null default 0,
  killing_blow    boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (event_id, player_id)
);
create index world_boss_contributions_player on world_boss_contributions (player_id);

alter table world_boss_contributions enable row level security;
create policy "world_boss_contributions_public_read" on world_boss_contributions
  for select using (true);
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset` (local) — confirm migration applies cleanly. Or if preserving data: `supabase db push`.

Verify in psql/Supabase Studio that both tables exist with columns and indexes as written.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_apex_boss_events.sql
git commit -m "feat(bosses): migration for apex_boss_events and contributions tables"
```

---

## Task 2: Pure helper `computeApexDamage()` with tests

Extract damage/contributor/reward math into a pure module so it can be unit-tested without Deno/Supabase. The edge function will import or inline-copy this logic (Deno does not easily import from `src/`, so we will **duplicate** the pure function into the edge function in Task 4 — keeping the canonical version with tests here).

**Files:**
- Create: `src/lib/apexContribution.ts`
- Test: `src/lib/__tests__/apexContribution.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/apexContribution.test.ts`:

```typescript
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
    // weights: p1=600, p2=400*1.1=440 -> total=1040
    // p1 gets 600/1040 * 60000 metal, p2 gets 440/1040 * 60000
    expect(r.p1.metal).toBe(Math.floor((600 / 1040) * 60000))
    expect(r.p2.metal).toBe(Math.floor((440 / 1040) * 60000))
    expect(r.p1.killing_blow).toBe(false)
    expect(r.p2.killing_blow).toBe(true)
  })

  it('gives single contributor full pool plus killing-blow bonus is irrelevant', () => {
    const r = computeApexRewards({ p1: 1000 }, pool, 'p1', 1.1)
    expect(r.p1.metal).toBe(60000)
    expect(r.p1.gas).toBe(30000)
    expect(r.p1.killing_blow).toBe(true)
  })

  it('applies escape multiplier when killer is null', () => {
    const contributors = { p1: 500, p2: 500 }
    const escapePool = { metal: 30000, gas: 15000 } // already halved upstream
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- apexContribution`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

`src/lib/apexContribution.ts`:

```typescript
export type ApexState = {
  hp_remaining: number
  hp_max: number
  damage_contributors: Record<string, number>
}

export type ApplyDamageResult = {
  next: ApexState
  effectiveDamage: number
  killed: boolean
  killingBlow: boolean
}

export function applyApexDamage(
  state: ApexState,
  playerId: string,
  rawDamage: number,
): ApplyDamageResult {
  if (rawDamage <= 0 || state.hp_remaining <= 0) {
    return { next: state, effectiveDamage: 0, killed: state.hp_remaining <= 0, killingBlow: false }
  }
  const effective = Math.min(rawDamage, state.hp_remaining)
  const nextHp = state.hp_remaining - effective
  const prior = state.damage_contributors[playerId] ?? 0
  const next: ApexState = {
    hp_max: state.hp_max,
    hp_remaining: nextHp,
    damage_contributors: { ...state.damage_contributors, [playerId]: prior + effective },
  }
  return {
    next,
    effectiveDamage: effective,
    killed: nextHp <= 0,
    killingBlow: nextHp <= 0,
  }
}

export type RewardPool = { metal: number; gas: number }
export type RewardRow = { metal: number; gas: number; killing_blow: boolean }

export function computeApexRewards(
  contributors: Record<string, number>,
  pool: RewardPool,
  killerId: string | null,
  killingBlowBonus: number,
): Record<string, RewardRow> {
  const entries = Object.entries(contributors).filter(([, d]) => d > 0)
  if (entries.length === 0) return {}
  const weights: Record<string, number> = {}
  let total = 0
  for (const [pid, dmg] of entries) {
    const w = pid === killerId ? dmg * killingBlowBonus : dmg
    weights[pid] = w
    total += w
  }
  const out: Record<string, RewardRow> = {}
  for (const [pid] of entries) {
    const share = weights[pid] / total
    out[pid] = {
      metal: Math.floor(share * pool.metal),
      gas: Math.floor(share * pool.gas),
      killing_blow: pid === killerId,
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- apexContribution`
Expected: PASS (all 8 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apexContribution.ts src/lib/__tests__/apexContribution.test.ts
git commit -m "feat(bosses): pure helpers for apex damage + reward math"
```

---

## Task 3: Add `APEX_EVENT_CONFIG` to `src/config/bosses.ts`

**Files:**
- Modify: `src/config/bosses.ts`

- [ ] **Step 1: Append config export to `src/config/bosses.ts`**

Add these exports to the end of the file (after `TIER_WEIGHTS`):

```typescript
export type ApexEventConfig = {
  herald_window_hours: number
  active_window_hours: number
  escape_loot_multiplier: number
  killing_blow_bonus: number
}

export const APEX_EVENT_CONFIG: ApexEventConfig = {
  herald_window_hours: 2,
  active_window_hours: 24,
  escape_loot_multiplier: 0.5,
  killing_blow_bonus: 1.1,
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build` (tsc -b fails fast if broken)
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/config/bosses.ts
git commit -m "feat(bosses): add APEX_EVENT_CONFIG constants"
```

---

## Task 4: Edge function — `handleHeraldApexBoss`

Adds a new dev-mode action that creates an `apex_boss_events` row in `heralded` phase and an accompanying `galaxy_map` entry anchoring the event at fixed global coordinates.

**Files:**
- Modify: `supabase/functions/game-action/index.ts` — add router entry + handler. Also copy the pure helpers from `src/lib/apexContribution.ts` into this file (Deno cannot import from `src/`), clearly labeled as a mirror.

- [ ] **Step 1: Copy pure helpers into edge function**

Append near the top of `supabase/functions/game-action/index.ts` (after existing imports, before handlers):

```typescript
// --- Apex event pure helpers (mirror of src/lib/apexContribution.ts).
// If you change this, change the src/lib version (and vice versa) and keep tests passing.
type ApexState = {
  hp_remaining: number
  hp_max: number
  damage_contributors: Record<string, number>
}
function applyApexDamage(state: ApexState, playerId: string, rawDamage: number) {
  if (rawDamage <= 0 || state.hp_remaining <= 0) {
    return { next: state, effectiveDamage: 0, killed: state.hp_remaining <= 0, killingBlow: false }
  }
  const effective = Math.min(rawDamage, state.hp_remaining)
  const nextHp = state.hp_remaining - effective
  const prior = state.damage_contributors[playerId] ?? 0
  const next: ApexState = {
    hp_max: state.hp_max,
    hp_remaining: nextHp,
    damage_contributors: { ...state.damage_contributors, [playerId]: prior + effective },
  }
  return { next, effectiveDamage: effective, killed: nextHp <= 0, killingBlow: nextHp <= 0 }
}
function computeApexRewards(
  contributors: Record<string, number>,
  pool: { metal: number; gas: number },
  killerId: string | null,
  killingBlowBonus: number,
) {
  const entries = Object.entries(contributors).filter(([, d]) => d > 0)
  if (entries.length === 0) return {} as Record<string, { metal: number; gas: number; killing_blow: boolean }>
  const weights: Record<string, number> = {}
  let total = 0
  for (const [pid, dmg] of entries) {
    const w = pid === killerId ? dmg * killingBlowBonus : dmg
    weights[pid] = w
    total += w
  }
  const out: Record<string, { metal: number; gas: number; killing_blow: boolean }> = {}
  for (const [pid] of entries) {
    const share = weights[pid] / total
    out[pid] = {
      metal: Math.floor(share * pool.metal),
      gas: Math.floor(share * pool.gas),
      killing_blow: pid === killerId,
    }
  }
  return out
}

const APEX_EVENT_CONFIG = {
  herald_window_hours: 2,
  active_window_hours: 24,
  escape_loot_multiplier: 0.5,
  killing_blow_bonus: 1.1,
}
```

- [ ] **Step 2: Add router entries**

In the action dispatch chain (lines 39–107), add after the existing `spawn_world_boss` route:

```typescript
if (action === 'herald_apex_boss') {
  return await handleHeraldApexBoss(supabase, user.id, planetId, !!devMode, body.bossId, corsHeaders)
}
if (action === 'activate_apex_event') {
  return await handleActivateApexEvent(supabase, body.eventId, corsHeaders)
}
if (action === 'resolve_apex_event') {
  return await handleResolveApexEvent(supabase, body.eventId, corsHeaders)
}
```

- [ ] **Step 3: Implement `handleHeraldApexBoss`**

Add near `handleSpawnWorldBoss` (after line 2244):

```typescript
async function handleHeraldApexBoss(
  supabase: any,
  userId: string,
  planetId: string,
  devMode: boolean,
  bossIdArg: string | undefined,
  cors: Record<string, string>,
) {
  if (!devMode) {
    return new Response(JSON.stringify({ error: 'Dev mode only' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  // Reject if an active/heralded apex event already exists (one at a time for v1)
  const { data: existingEvent } = await supabase
    .from('apex_boss_events')
    .select('id, phase')
    .in('phase', ['heralded', 'active'])
    .maybeSingle()
  if (existingEvent) {
    return new Response(JSON.stringify({ error: `Apex event already ${existingEvent.phase}` }), { status: 409, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const bossId = bossIdArg && BOSS_FLEETS[bossIdArg]?.tier === 'apex' ? bossIdArg : 'void_leviathan'
  const boss = BOSS_FLEETS[bossId]
  // Global apex events: fixed deterministic coord derived from event boss_id for v1
  const coordinates = '1:50:50'

  // Compute hp_max: sum of fleet HP (count * hp) across boss fleet
  let hpMax = 0
  for (const unit of Object.values(boss.ships) as Array<{ count: number; hp: number }>) {
    hpMax += unit.count * unit.hp
  }

  const now = new Date()
  const activatesAt = new Date(now.getTime() + APEX_EVENT_CONFIG.herald_window_hours * 3600 * 1000)
  const expiresAt = new Date(activatesAt.getTime() + APEX_EVENT_CONFIG.active_window_hours * 3600 * 1000)

  // Create galaxy_map entry (per-player visibility currently scopes by player_id; for v1 we insert
  // one entry per existing player so every player sees the event on their map)
  const { data: players } = await supabase.from('players').select('id')
  if (!players || players.length === 0) {
    return new Response(JSON.stringify({ error: 'No players found' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const metadataBase = {
    boss_id: bossId,
    tier: boss.tier,
    phase: 'heralded' as const,
    hp_max: hpMax,
    hp_remaining: hpMax,
    damage_contributors: {} as Record<string, number>,
    activates_at: activatesAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }

  // Pick one galaxy_map row (any player's) as anchor for the event FK
  const firstPlayer = players[0]
  const { data: anchor, error: anchorErr } = await supabase.from('galaxy_map').insert({
    player_id: firstPlayer.id,
    coordinates,
    visibility: 'revealed',
    location_type: 'world_boss',
    name: boss.name,
    metadata: metadataBase,
    revealed_at: now.toISOString(),
  }).select('id').single()
  if (anchorErr || !anchor) {
    return new Response(JSON.stringify({ error: 'Failed to anchor event', detail: anchorErr?.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const { data: event, error: evErr } = await supabase.from('apex_boss_events').insert({
    boss_id: bossId,
    galaxy_map_id: anchor.id,
    phase: 'heralded',
    heralded_at: now.toISOString(),
    activates_at: activatesAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }).select('id').single()
  if (evErr || !event) {
    return new Response(JSON.stringify({ error: 'Failed to create event', detail: evErr?.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Mirror metadata.event_id into anchor row
  await supabase.from('galaxy_map').update({
    metadata: { ...metadataBase, event_id: event.id },
  }).eq('id', anchor.id)

  // Mirror galaxy_map entry into every other player's map (so everyone sees it)
  const otherPlayers = players.filter((p: any) => p.id !== firstPlayer.id)
  if (otherPlayers.length > 0) {
    const rows = otherPlayers.map((p: any) => ({
      player_id: p.id,
      coordinates,
      visibility: 'revealed',
      location_type: 'world_boss',
      name: boss.name,
      metadata: { ...metadataBase, event_id: event.id },
      revealed_at: now.toISOString(),
    }))
    await supabase.from('galaxy_map').upsert(rows, { onConflict: 'player_id,coordinates' })
  }

  return new Response(JSON.stringify({
    success: true,
    event_id: event.id,
    boss_id: bossId,
    coordinates,
    activates_at: activatesAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 4: Deploy and smoke-test**

Deploy: `supabase functions deploy game-action --no-verify-jwt`

Manual test (curl or in-browser dev console):
```javascript
await supabase.functions.invoke('game-action', {
  body: { action: 'herald_apex_boss', planetId: '<your planet uuid>', devMode: true, bossId: 'void_leviathan' },
})
```

Expected: `{ success: true, event_id, coordinates: '1:50:50', activates_at, expires_at }`. Check Supabase Studio: `apex_boss_events` has one `heralded` row, every player's `galaxy_map` has a `world_boss` entry at `1:50:50`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(bosses): herald_apex_boss action + pure helper mirror"
```

---

## Task 5: Edge function — `handleActivateApexEvent`

Idempotent phase flip from `heralded` → `active` once `now >= activates_at`. Invoked by the client tick once the timer elapses.

**Files:**
- Modify: `supabase/functions/game-action/index.ts`

- [ ] **Step 1: Implement handler**

Append after `handleHeraldApexBoss`:

```typescript
async function handleActivateApexEvent(supabase: any, eventId: string, cors: Record<string, string>) {
  const { data: event } = await supabase.from('apex_boss_events').select('*').eq('id', eventId).single()
  if (!event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  if (event.phase !== 'heralded') {
    return new Response(JSON.stringify({ success: true, already: event.phase }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  if (new Date(event.activates_at) > new Date()) {
    return new Response(JSON.stringify({ error: 'Not yet' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await supabase.from('apex_boss_events').update({ phase: 'active' }).eq('id', eventId)

  // Update every galaxy_map entry that anchors this event
  const { data: entries } = await supabase.from('galaxy_map').select('id, metadata').eq('location_type', 'world_boss')
  for (const row of entries ?? []) {
    if ((row.metadata as any)?.event_id === eventId) {
      await supabase.from('galaxy_map').update({
        metadata: { ...(row.metadata as any), phase: 'active' },
      }).eq('id', row.id)
    }
  }

  return new Response(JSON.stringify({ success: true, phase: 'active' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 2: Deploy and smoke-test**

Deploy: `supabase functions deploy game-action --no-verify-jwt`

Manually set `activates_at` on the heralded event to a past time in Supabase Studio, then invoke `activate_apex_event`. Verify `phase='active'` on event and on all mirrored galaxy_map rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(bosses): activate_apex_event phase flip"
```

---

## Task 6: Edge function — apex branch in `handleResolveMission`

When a raid mission returns and the target is a `galaxy_map` row with `metadata.event_id` and `metadata.phase === 'active'`, apply damage to the shared HP pool instead of instant-killing a solo boss. Use `SELECT … FOR UPDATE` (via rpc) or serialize via a unique row update to prevent race conditions.

**Files:**
- Modify: `supabase/functions/game-action/index.ts` (raid branch around lines 1243–1283)

- [ ] **Step 1: Insert apex check at top of raid branch**

Inside `handleResolveMission`, replace the existing `const isBoss = mapEntry?.location_type === 'world_boss'` line and the block immediately below it with:

```typescript
const isBoss = mapEntry?.location_type === 'world_boss'
const isApexActive = isBoss && !!metadata.event_id && metadata.phase === 'active'
const bossId = isBoss ? (metadata.boss_id as string) : null
const boss = bossId ? BOSS_FLEETS[bossId] : null

if (isApexActive && boss && bossId) {
  // --- Apex coop branch ---
  // Read event row (authoritative) and all mirrored galaxy_map entries
  const { data: eventRow } = await supabase.from('apex_boss_events')
    .select('*').eq('id', metadata.event_id).single()
  if (!eventRow || eventRow.phase !== 'active' || new Date(eventRow.expires_at) <= now) {
    // Window already closed: fleet returns with no losses/rewards
    await supabase.from('missions').update({
      status: 'completed',
      result: { encounter_type: 'apex_window_closed', combat_log: [], ships_lost: {}, rewards: { metal: 0, gas: 0 } },
    }).eq('id', missionId)
    // Return the fleet intact (restore ships)
    for (const [type, count] of Object.entries(fleet)) {
      await supabase.rpc('increment_planet_ship', { p_planet_id: planetId, p_ship_type: type, p_delta: count })
    }
    return new Response(JSON.stringify({ success: true, encounter_type: 'apex_window_closed' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Compute attacker damage this wave using resolveCombat against the boss's original fleet
  const combat = resolveCombat(fleet, boss.ships)
  const totalAttackerAttack = Object.entries(fleet).reduce((sum, [t, c]) => {
    const stats = SHIP_STATS[t]
    return sum + (stats ? stats.attack * c : 0)
  }, 0)
  // Damage = total attacker attack summed over rounds they survived, cap via pure helper
  // Simpler: use the sum of damage dealt in combat rounds to defender fleet as this wave's contribution
  let waveDamage = 0
  for (const round of combat.rounds) {
    for (const fire of round.attackerFire) waveDamage += fire.damage
  }

  survivingFleet = { ...fleet }
  for (const [t, l] of Object.entries(combat.attackerLosses)) {
    survivingFleet[t] = Math.max(0, (survivingFleet[t] ?? 0) - l)
  }

  // Re-read the anchor metadata for this player (source of truth for damage_contributors lives on
  // apex_boss_events.galaxy_map_id anchor row)
  const { data: anchor } = await supabase.from('galaxy_map').select('id, metadata').eq('id', eventRow.galaxy_map_id).single()
  const anchorMeta = anchor?.metadata as any
  const state: ApexState = {
    hp_max: anchorMeta.hp_max,
    hp_remaining: anchorMeta.hp_remaining,
    damage_contributors: anchorMeta.damage_contributors ?? {},
  }
  const applied = applyApexDamage(state, userId, waveDamage)
  await supabase.from('galaxy_map').update({
    metadata: { ...anchorMeta, ...applied.next },
  }).eq('id', eventRow.galaxy_map_id)

  // Mirror metadata to all other player-scoped rows for this event
  const { data: mirrors } = await supabase.from('galaxy_map').select('id, metadata, player_id').eq('location_type', 'world_boss')
  for (const m of mirrors ?? []) {
    if ((m.metadata as any)?.event_id === eventRow.id && m.id !== eventRow.galaxy_map_id) {
      await supabase.from('galaxy_map').update({
        metadata: { ...(m.metadata as any), ...applied.next },
      }).eq('id', m.id)
    }
  }

  result.encounter_type = 'apex_contribution'
  result.boss_id = bossId
  result.event_id = eventRow.id
  result.combat_log = combat.rounds
  result.ships_lost = combat.attackerLosses
  result.damage_dealt = applied.effectiveDamage
  result.hp_remaining = applied.next.hp_remaining
  result.rewards = { metal: 0, gas: 0 } // Rewards granted at event resolution, not per wave

  // If this wave killed the boss, resolve event immediately
  if (applied.killed) {
    await finalizeApexEvent(supabase, eventRow.id, userId)
    result.killing_blow = true
  }

  await supabase.from('planet_events').insert({
    planet_id: planetId,
    event_type: 'apex_contribution',
    message: applied.killed
      ? `Killing blow on ${boss.name}! Dealt ${applied.effectiveDamage} damage`
      : `Dealt ${applied.effectiveDamage} damage to ${boss.name} (HP: ${applied.next.hp_remaining}/${applied.next.hp_max})`,
    metadata: { event_id: eventRow.id, damage: applied.effectiveDamage, killing_blow: applied.killed },
  })

  // Write surviving fleet back and close mission via the standard path below (jump past solo branch)
  await supabase.from('missions').update({
    status: 'completed',
    result,
  }).eq('id', missionId)
  for (const [type, count] of Object.entries(survivingFleet)) {
    if (count > 0) await supabase.rpc('increment_planet_ship', { p_planet_id: planetId, p_ship_type: type, p_delta: count })
  }
  return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

// ...existing solo boss + bandit raid logic continues unchanged below this point
```

**Note:** This step assumes a helper `increment_planet_ship` RPC already exists. If it doesn't, the existing solo raid code path is doing ship-count updates directly — inspect the solo branch at lines 1212–1317 and use the same pattern for returning the surviving fleet (likely a direct update to `planet_ships`). Adjust accordingly.

- [ ] **Step 2: Add `finalizeApexEvent` helper**

Add near the bottom of `game-action/index.ts`:

```typescript
async function finalizeApexEvent(supabase: any, eventId: string, killerUserId: string | null) {
  const { data: event } = await supabase.from('apex_boss_events').select('*').eq('id', eventId).single()
  if (!event || event.phase === 'killed' || event.phase === 'escaped') return

  const { data: anchor } = await supabase.from('galaxy_map').select('id, metadata').eq('id', event.galaxy_map_id).single()
  const meta = anchor?.metadata as any
  const contributors = (meta?.damage_contributors ?? {}) as Record<string, number>
  const boss = BOSS_FLEETS[event.boss_id]
  const lootRange = BOSS_LOOT[event.boss_id]
  const killed = killerUserId !== null
  const poolMetal = randRange(lootRange.metal[0], lootRange.metal[1]) * (killed ? 1 : APEX_EVENT_CONFIG.escape_loot_multiplier)
  const poolGas = randRange(lootRange.gas[0], lootRange.gas[1]) * (killed ? 1 : APEX_EVENT_CONFIG.escape_loot_multiplier)
  const rewards = computeApexRewards(
    contributors,
    { metal: Math.floor(poolMetal), gas: Math.floor(poolGas) },
    killed ? killerUserId : null,
    APEX_EVENT_CONFIG.killing_blow_bonus,
  )

  // Insert contribution rows
  const contribRows = Object.entries(rewards).map(([playerId, r]) => ({
    event_id: eventId,
    player_id: playerId,
    damage_dealt: contributors[playerId] ?? 0,
    rewarded_metal: r.metal,
    rewarded_gas: r.gas,
    killing_blow: r.killing_blow,
  }))
  if (contribRows.length > 0) {
    await supabase.from('world_boss_contributions').upsert(contribRows, { onConflict: 'event_id,player_id' })
  }

  // Credit resources to each contributor's home planet
  for (const [playerId, r] of Object.entries(rewards)) {
    const { data: home } = await supabase.from('planets').select('id, metal_amount, gas_amount').eq('player_id', playerId).order('created_at', { ascending: true }).limit(1).single()
    if (!home) continue
    await supabase.from('planets').update({
      metal_amount: (home.metal_amount ?? 0) + r.metal,
      gas_amount: (home.gas_amount ?? 0) + r.gas,
    }).eq('id', home.id)
    await supabase.from('planet_events').insert({
      planet_id: home.id,
      event_type: killed ? 'apex_boss_defeated' : 'apex_boss_escaped',
      message: killed
        ? `Apex ${boss.name} slain! Your share: +${r.metal} metal, +${r.gas} gas${r.killing_blow ? ' (killing blow)' : ''}`
        : `Apex ${boss.name} escaped. Partial share: +${r.metal} metal, +${r.gas} gas`,
      metadata: { event_id: eventId, boss_id: event.boss_id, ...r },
    })
  }

  await supabase.from('apex_boss_events').update({
    phase: killed ? 'killed' : 'escaped',
    resolved_at: new Date().toISOString(),
    killing_player: killed ? killerUserId : null,
  }).eq('id', eventId)

  // Clear galaxy_map anchors
  const { data: entries } = await supabase.from('galaxy_map').select('id, metadata').eq('location_type', 'world_boss')
  for (const row of entries ?? []) {
    if ((row.metadata as any)?.event_id === eventId) {
      await supabase.from('galaxy_map').update({
        cleared_at: new Date().toISOString(),
        metadata: { ...(row.metadata as any), phase: killed ? 'killed' : 'escaped' },
      }).eq('id', row.id)
    }
  }
}
```

- [ ] **Step 3: Deploy and smoke-test end-to-end**

Deploy: `supabase functions deploy game-action --no-verify-jwt`

Manual flow:
1. Dev-trigger herald (`herald_apex_boss`).
2. Manually flip `activates_at` to past; call `activate_apex_event`.
3. From two test accounts, dispatch raid missions at coords `1:50:50`.
4. When each mission returns, confirm `damage_contributors` increments and `hp_remaining` drops.
5. When HP hits 0, confirm: `apex_boss_events.phase = 'killed'`, `world_boss_contributions` rows exist with proper split, both contributor home planets got resources, `planet_events` has an `apex_boss_defeated` row for each.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(bosses): apex coop raid resolution and event finalization"
```

---

## Task 7: Edge function — `handleResolveApexEvent` (escape path)

Idempotent: if `now >= expires_at` and phase is still `active`, call `finalizeApexEvent(eventId, null)`. Invoked by client tick.

- [ ] **Step 1: Implement handler**

Append:

```typescript
async function handleResolveApexEvent(supabase: any, eventId: string, cors: Record<string, string>) {
  const { data: event } = await supabase.from('apex_boss_events').select('*').eq('id', eventId).single()
  if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (event.phase === 'killed' || event.phase === 'escaped') {
    return new Response(JSON.stringify({ success: true, already: event.phase }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  if (event.phase !== 'active' || new Date(event.expires_at) > new Date()) {
    return new Response(JSON.stringify({ error: 'Not yet expired' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  await finalizeApexEvent(supabase, eventId, null)
  return new Response(JSON.stringify({ success: true, phase: 'escaped' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
}
```

- [ ] **Step 2: Deploy and smoke-test**

Deploy: `supabase functions deploy game-action --no-verify-jwt`.

Trigger a herald with short windows (manually edit `activates_at`/`expires_at` to be seconds apart), let it run, call `resolve_apex_event` after expiry. Confirm `phase='escaped'`, partial rewards split (50% of loot) distributed to any contributors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/game-action/index.ts
git commit -m "feat(bosses): resolve_apex_event (escape path)"
```

---

## Task 8: `useApexEvent` hook

Fetches the single current apex event (heralded or active) and drives phase transitions via client tick (mirrors `useAttacks.ts` pattern).

**Files:**
- Create: `src/hooks/useApexEvent.ts`

- [ ] **Step 1: Implement the hook**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type ApexEvent = {
  id: string
  boss_id: string
  phase: 'heralded' | 'active' | 'killed' | 'escaped'
  heralded_at: string
  activates_at: string
  expires_at: string
  resolved_at: string | null
  galaxy_map_id: string
}

export function useApexEvent() {
  const [event, setEvent] = useState<ApexEvent | null>(null)
  const [metadata, setMetadata] = useState<Record<string, any> | null>(null)
  const transitioningRef = useRef<Set<string>>(new Set())

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from('apex_boss_events')
      .select('*')
      .in('phase', ['heralded', 'active'])
      .order('heralded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setEvent(data as ApexEvent | null)
    if (data) {
      const { data: anchor } = await supabase.from('galaxy_map').select('metadata').eq('id', data.galaxy_map_id).maybeSingle()
      setMetadata((anchor?.metadata ?? null) as Record<string, any> | null)
    } else {
      setMetadata(null)
    }
  }, [])

  useEffect(() => {
    refetch()
    const poll = setInterval(refetch, 15000)
    return () => clearInterval(poll)
  }, [refetch])

  // Tick: flip phases when timers elapse
  useEffect(() => {
    if (!event) return
    const tick = setInterval(async () => {
      const now = Date.now()
      const key = `${event.id}:${event.phase}`
      if (transitioningRef.current.has(key)) return
      if (event.phase === 'heralded' && new Date(event.activates_at).getTime() <= now) {
        transitioningRef.current.add(key)
        try {
          await supabase.functions.invoke('game-action', { body: { action: 'activate_apex_event', eventId: event.id } })
          await refetch()
        } finally {
          transitioningRef.current.delete(key)
        }
      } else if (event.phase === 'active' && new Date(event.expires_at).getTime() <= now) {
        transitioningRef.current.add(key)
        try {
          await supabase.functions.invoke('game-action', { body: { action: 'resolve_apex_event', eventId: event.id } })
          await refetch()
        } finally {
          transitioningRef.current.delete(key)
        }
      }
    }, 2000)
    return () => clearInterval(tick)
  }, [event, refetch])

  return { event, metadata, refetch }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useApexEvent.ts
git commit -m "feat(bosses): useApexEvent hook with client-tick phase transitions"
```

---

## Task 9: Global event banner

**Files:**
- Create: `src/components/ApexEventBanner.tsx`
- Modify: `src/components/Layout.tsx` — mount the banner at the top of the main layout region.

- [ ] **Step 1: Implement the banner**

```typescript
import { useApexEvent } from '../hooks/useApexEvent'
import { getBossConfig } from '../config/bosses'

export function ApexEventBanner() {
  const { event, metadata } = useApexEvent()
  if (!event) return null
  const boss = getBossConfig(event.boss_id)
  const now = Date.now()
  const targetMs = event.phase === 'heralded'
    ? new Date(event.activates_at).getTime()
    : new Date(event.expires_at).getTime()
  const remainingSec = Math.max(0, Math.floor((targetMs - now) / 1000))
  const h = Math.floor(remainingSec / 3600), m = Math.floor((remainingSec % 3600) / 60), s = remainingSec % 60
  const timeStr = `${h}h ${m}m ${s}s`
  const hp = metadata?.hp_remaining, hpMax = metadata?.hp_max
  return (
    <div className={`w-full px-4 py-2 text-xs font-medium border-b ${event.phase === 'heralded' ? 'bg-fuchsia-900/40 border-fuchsia-500/40 text-fuchsia-200 animate-pulse' : 'bg-fuchsia-900/60 border-fuchsia-500/60 text-fuchsia-100'}`}>
      {event.phase === 'heralded'
        ? `⚠ ${boss.name} approaches. Prepare. Arrival in ${timeStr}.`
        : `⚔ ${boss.name} is active — HP ${hp}/${hpMax} — escapes in ${timeStr}.`}
    </div>
  )
}
```

- [ ] **Step 2: Mount in Layout**

In `src/components/Layout.tsx`, import and render `<ApexEventBanner />` at the top of the main content area (above sidebar/children but within the root layout). Exact placement should match the existing top-bar structure — read the file first.

- [ ] **Step 3: Manual verify**

`npm run dev`, log in, trigger a herald via the dev button (Task 10), confirm banner appears, countdown updates every second, transitions to active state when tick fires.

- [ ] **Step 4: Commit**

```bash
git add src/components/ApexEventBanner.tsx src/components/Layout.tsx
git commit -m "feat(bosses): global apex event banner in Layout"
```

---

## Task 10: Dev-mode "Herald Apex Boss" button in GalaxyMapPage

**Files:**
- Modify: `src/pages/GalaxyMapPage.tsx`

- [ ] **Step 1: Add handler and button**

Next to the existing `handleSpawnBoss` (around line 958) add:

```typescript
const handleHeraldApex = async () => {
  setSending(true)
  try {
    const { data, error } = await supabase.functions.invoke('game-action', {
      body: { action: 'herald_apex_boss', planetId: planet.id, devMode: true, bossId: 'void_leviathan' },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    console.log(`%c[Apex heralded]%c event ${data.event_id} at ${data.coordinates}`, 'color:#d946ef;font-weight:bold', 'color:inherit')
    await refetch()
  } catch (err) {
    console.error('Failed to herald apex:', err)
  } finally {
    setSending(false)
  }
}
```

Next to the existing Spawn World Boss button (around line 1069), add:

```tsx
{IS_DEV_MODE && (
  <button
    onClick={handleHeraldApex}
    disabled={sending}
    className="px-3 py-1.5 text-[10px] font-medium rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 disabled:opacity-40 transition-colors"
  >
    Herald Apex Boss
  </button>
)}
```

- [ ] **Step 2: Manual verify**

Run dev server with `npm run dev:dev`, click the Herald button, confirm banner appears and a `world_boss` tile shows at coords 1:50:50 on the galaxy map.

- [ ] **Step 3: Commit**

```bash
git add src/pages/GalaxyMapPage.tsx
git commit -m "feat(bosses): dev-mode Herald Apex Boss button"
```

---

## Task 11: GalaxyMap detail panel — apex HP bar & top contributors

**Files:**
- Modify: `src/pages/GalaxyMapPage.tsx`

- [ ] **Step 1: Extend the `world_boss` description branch**

Around line 340–360, where the `world_boss` description is composed, replace that branch with:

```typescript
: type === 'world_boss' && meta?.phase === 'heralded'
  ? `${boss?.name ?? 'Apex threat'} is approaching. Combat unavailable until arrival.`
: type === 'world_boss' && meta?.phase === 'active'
  ? `${boss?.name ?? 'Apex threat'} — HP ${meta?.hp_remaining}/${meta?.hp_max}. Coordinate with other commanders!`
: type === 'world_boss'
  ? `A high-threat hostile (${(meta?.tier as string) ?? 'unknown'} tier). Raid with a capable fleet to claim rare loot.`
```

- [ ] **Step 2: Render HP bar + top contributors (active phase only)**

Below the description, conditional block for apex active:

```tsx
{type === 'world_boss' && meta?.phase === 'active' && (
  <div className="mt-3 space-y-2">
    <div className="h-2 rounded bg-white/5 overflow-hidden">
      <div
        className="h-full bg-fuchsia-500"
        style={{ width: `${Math.max(0, Math.min(100, (meta.hp_remaining / meta.hp_max) * 100))}%` }}
      />
    </div>
    <div className="text-[10px] text-white/60">
      Top contributors:
      <ul className="mt-1 space-y-0.5">
        {Object.entries((meta.damage_contributors ?? {}) as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([pid, dmg]) => (
            <li key={pid} className="text-fuchsia-300/80">{pid.slice(0, 8)}… — {dmg} dmg</li>
          ))}
      </ul>
    </div>
  </div>
)}
```

- [ ] **Step 3: Manual verify**

Run a full live scenario (herald → activate → raid). Confirm HP bar shrinks and contributor list updates after each raid returns.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GalaxyMapPage.tsx
git commit -m "feat(bosses): apex HP bar + top contributors on galaxy map detail"
```

---

## Task 12: MissionsPage apex warning panel

**Files:**
- Modify: `src/pages/MissionsPage.tsx`

- [ ] **Step 1: Replace the existing boss warning panel (lines 217–231) with an apex-aware version**

Read current block first, then replace with:

```tsx
{targetLocation?.location_type === 'world_boss' && targetLocation.metadata?.phase === 'heralded' && (
  <div className="p-3 rounded border border-fuchsia-500/40 bg-fuchsia-900/30 text-xs text-fuchsia-200">
    ⚠ {targetLocation.name} has not yet arrived. Raids will be available once the herald window ends.
  </div>
)}
{targetLocation?.location_type === 'world_boss' && targetLocation.metadata?.phase === 'active' && (
  <div className="p-3 rounded border border-fuchsia-500/50 bg-fuchsia-900/40 text-xs text-fuchsia-100 space-y-1">
    <div className="font-semibold">⚔ {targetLocation.name} — Cooperative Encounter</div>
    <div>HP: {targetLocation.metadata.hp_remaining} / {targetLocation.metadata.hp_max}</div>
    <div>Window closes in: {formatCountdown(targetLocation.metadata.expires_at)}</div>
    <div className="text-fuchsia-300/80">Rewards split proportionally by damage dealt; killing blow earns +10%.</div>
  </div>
)}
{targetLocation?.location_type === 'world_boss' && !targetLocation.metadata?.event_id && (
  /* existing solo-boss warning block, unchanged */
)}
```

Add a small `formatCountdown(iso: string): string` helper at the top of the file or in `src/lib/` if not already present.

- [ ] **Step 2: Manual verify**

With an active apex event, open the Missions page, pick the boss coord — the apex panel should render with live HP and countdown.

- [ ] **Step 3: Commit**

```bash
git add src/pages/MissionsPage.tsx
git commit -m "feat(bosses): MissionsPage apex cooperative warning panel"
```

---

## Task 13: LeaderboardPage "Apex Events" tab

**Files:**
- Modify: `src/pages/LeaderboardPage.tsx`

- [ ] **Step 1: Add a new section/tab listing resolved apex events**

Below the existing world boss kill leaderboard, add a new section:

```tsx
<section className="mt-8">
  <h2 className="text-sm font-semibold text-white/90 mb-2">Apex Events — Cooperative Kills</h2>
  <ApexEventsList />
</section>
```

With a component:

```tsx
function ApexEventsList() {
  const [rows, setRows] = useState<Array<{
    id: string; boss_id: string; phase: string; resolved_at: string | null;
    contributions: Array<{ player_id: string; damage_dealt: number; killing_blow: boolean; player_username?: string }>
  }>>([])
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: events } = await supabase
        .from('apex_boss_events')
        .select('id, boss_id, phase, resolved_at')
        .in('phase', ['killed', 'escaped'])
        .order('resolved_at', { ascending: false })
        .limit(10)
      if (!events) return
      const eventIds = events.map(e => e.id)
      const { data: contribs } = await supabase
        .from('world_boss_contributions')
        .select('event_id, player_id, damage_dealt, killing_blow')
        .in('event_id', eventIds)
      const playerIds = Array.from(new Set((contribs ?? []).map(c => c.player_id)))
      const { data: players } = await supabase.from('players').select('id, username').in('id', playerIds)
      const nameMap = new Map((players ?? []).map(p => [p.id, p.username]))
      if (cancelled) return
      setRows(events.map(e => ({
        ...e,
        contributions: (contribs ?? []).filter(c => c.event_id === e.id)
          .sort((a, b) => b.damage_dealt - a.damage_dealt)
          .map(c => ({ ...c, player_username: nameMap.get(c.player_id) })),
      })))
    }
    load()
    return () => { cancelled = true }
  }, [])
  if (rows.length === 0) return <div className="text-xs text-white/40">No apex events resolved yet.</div>
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.id} className="p-3 rounded bg-white/5 border border-white/10">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">{r.boss_id}</span>
            <span className={`text-[10px] uppercase ${r.phase === 'killed' ? 'text-fuchsia-400' : 'text-white/40'}`}>{r.phase}</span>
          </div>
          <div className="text-[10px] text-white/50">{r.resolved_at ? new Date(r.resolved_at).toLocaleString() : ''}</div>
          <ul className="mt-2 space-y-0.5 text-xs">
            {r.contributions.map(c => (
              <li key={c.player_id} className={c.killing_blow ? 'text-fuchsia-300' : 'text-white/70'}>
                {c.player_username ?? c.player_id.slice(0, 8)} — {c.damage_dealt} dmg{c.killing_blow ? ' (killing blow)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Manual verify**

After completing a full kill scenario, reload the Leaderboard page, confirm the kill appears with a per-contributor breakdown and killing-blow highlighted.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LeaderboardPage.tsx
git commit -m "feat(bosses): leaderboard apex events section with contributor breakdown"
```

---

## Task 14: Full end-to-end verification

- [ ] **Step 1: Kill scenario**

1. `supabase db reset` and `supabase functions deploy game-action --no-verify-jwt`.
2. `npm run dev:dev` — log in with two test accounts in separate browsers.
3. Click "Herald Apex Boss" — confirm banner on both clients, `apex_boss_events` phase=heralded.
4. Edit `activates_at` to past in Studio → useApexEvent tick fires → phase=active.
5. Each account dispatches a raid to `1:50:50`.
6. When missions return, verify `damage_contributors` updates and HP drops on both clients' galaxy map.
7. When HP hits 0 — verify `apex_boss_events.phase=killed`, `world_boss_contributions` rows exist, both planets received metal/gas, `planet_events` has `apex_boss_defeated` entries.
8. Leaderboard page shows this event with the killing blow highlighted.

- [ ] **Step 2: Escape scenario**

1. Herald another apex, activate it, send one raid that deals partial damage.
2. Edit `expires_at` to past → useApexEvent tick fires → phase=escaped.
3. Verify: `apex_boss_events.phase=escaped`, `world_boss_contributions` has partial rewards (50% multiplier), `planet_events` has `apex_boss_escaped` entry, leaderboard shows escaped event.

- [ ] **Step 3: Run the unit tests one last time**

```bash
npm run test:run
```
Expected: all tests green.

- [ ] **Step 4: Open a PR**

```bash
git push -u origin feature/coop-apex-world-bosses
gh pr create --title "feat(bosses): cooperative apex world boss events" --body "$(cat <<'EOF'
## Summary
- Add global, herald-then-spawn cooperative apex boss events (solo minor/elite paths unchanged)
- Proportional damage-based rewards with killing-blow bonus; escape path pays 50%
- New migration 013 + two tables; extracted pure damage/reward helpers with Vitest coverage
- Client hook drives phase transitions; global banner, HP bar, and leaderboard UI

## Test plan
- [x] Unit: `npm run test:run -- apexContribution`
- [ ] E2E kill scenario (Task 14 Step 1)
- [ ] E2E escape scenario (Task 14 Step 2)
- [ ] Solo minor/elite boss path still works (regression)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

- Spec coverage: every bullet in the spec's Design Decisions and Lifecycle sections is covered by a task; the `planet_events` per-planet limitation noted in the brief is handled by fanning out event messages per contributor rather than introducing a new global_events table (spec out-of-scope mentions no chat/coordination UI).
- Placeholder scan: no TBDs, no "add error handling" — concrete code in every step.
- Known ambiguity fixed inline: Task 6 Step 1 note calls out that `increment_planet_ship` RPC may not exist and instructs matching the existing solo-raid surviving-fleet writeback pattern.
- Known risk: Task 4's "fan out galaxy_map entry per player" approach is simple but scales O(N) per herald. Acceptable for v1 alpha scale; flagged in spec's out-of-scope as the path toward real global visibility in v2.
