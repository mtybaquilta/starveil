# Cooperative Apex World Boss Events — Design Spec

## Context

StarVeil shipped a single-player world boss framework (commits `33b7a8a`, `a0c699e`, `03f58d7`) with three tiers: minor (Derelict Dreadnought), elite (Pirate Flagship), apex (Void Leviathan). Each boss currently spawns on an individual player's galaxy map, resolves in one instant raid, and rewards a single killer via `world_boss_kills`.

This design adds a **cooperative, global, time-bounded event mode for apex bosses only**. Minor and elite bosses keep the existing solo code path unchanged. The goal is to introduce the game's first genuinely cooperative PvE loop, give the world a dramatic heartbeat, and build a reusable "server-wide event" primitive for future seasonal content.

**Design decisions (locked via brainstorming):**
- **Hybrid model** — solo for minor/elite, global co-op for apex.
- **Herald-then-spawn cadence** — telegraph before activation, creating preparation windows.
- **Wave-based contribution** — each dispatched fleet resolves as one combat round against a persistent boss HP pool.
- **Proportional rewards** — loot split by damage dealt, with a small killing-blow bonus (~10%).
- **Visibility: global, travel-gated** — every player sees apex events; fleet travel time is the natural range limit.
- **Window-expiry rule** — if the boss survives the window, it escapes; contributors receive partial rewards, no kill credit.
- **Cadence: manual dev-triggered for v1** — automate in v2 once balance is proven.

## Architecture

A new `apex_boss_events` row represents one server-wide event in a lifecycle: `heralded → active → resolved` (killed or escaped). The existing `galaxy_map` row for the boss acts as the spatial anchor and carries live HP/contributor state in its `metadata` JSONB. Contribution damage is computed inside the existing mission resolution path — the change is small: replace "boss fleet stateless one-shot" with "persistent HP pool, accumulate contributions".

### Lifecycle

1. **Herald** (dev/admin triggers): Insert `apex_boss_events` row, spawn `galaxy_map` entry with `metadata.phase = 'heralded'`. A herald window (default 2h) gives all players time to prep. Banner/event UI shows countdown and coords.
2. **Active**: Phase flips to `active` at herald expiry. Fleets can now be dispatched to the coordinates. Each arriving fleet resolves as one combat round against the boss HP pool, updating `metadata.hp_remaining` and incrementing `metadata.damage_contributors[player_id]`.
3. **Resolved — Killed**: When `hp_remaining <= 0`, compute final reward splits proportional to damage (with +10% killing-blow bonus for the player whose fleet dropped it), insert `world_boss_contributions` rows, credit rewards on next tick/return, mark `galaxy_map` entry cleared.
4. **Resolved — Escaped**: If `active` phase exceeds event window (default 24h), boss despawns. Contributors get partial rewards (same proportional split but applied to a reduced loot pool, e.g., 50%). No kill credit.

### Data Model

**New table: `apex_boss_events`**
```
id              uuid pk
boss_id         text (currently only 'void_leviathan'; future apex bosses extensible)
galaxy_map_id   uuid fk → galaxy_map
phase           text check in ('heralded','active','killed','escaped')
heralded_at     timestamptz
activates_at    timestamptz
expires_at      timestamptz  -- active window end
resolved_at     timestamptz nullable
killing_player  uuid fk → players nullable
created_at      timestamptz default now()
```
Indexed on `(phase, activates_at)` for querying the current/upcoming event. Public-read RLS.

**New table: `world_boss_contributions`**
```
event_id        uuid fk → apex_boss_events
player_id       uuid fk → players
damage_dealt    integer
rewarded_metal  integer
rewarded_gas    integer
killing_blow    boolean default false
primary key (event_id, player_id)
```
Public-read RLS (feeds leaderboard + post-event report).

**Existing `galaxy_map.metadata` additions (apex events only):**
```json
{
  "boss_id": "void_leviathan",
  "event_id": "<uuid>",
  "phase": "active",
  "hp_max": 12000,
  "hp_remaining": 8450,
  "damage_contributors": { "<player_uuid>": 1200, "<player_uuid>": 2350 }
}
```

### Critical Files

- `supabase/migrations/013_apex_boss_events.sql` *(new)* — tables + RLS.
- `supabase/functions/game-action/index.ts` — modify:
  - Add `handleHeraldApexBoss()` (dev-mode, mirrors existing `handleSpawnWorldBoss`).
  - Add `handleActivateApexEvent()` and `handleResolveApexEvent()` tick handlers (or fold into existing scheduled tick if one exists).
  - Modify `handleResolveMission()` (lines ~1212–1299): detect if target is an apex event in `active` phase; if so, branch to new `resolveApexContribution()` that deals damage to boss HP pool instead of instant kill. Update metadata atomically.
  - On boss kill or window expiry, compute reward splits and insert `world_boss_contributions`.
- `src/config/bosses.ts` — add apex event config (herald window, active window, escape-penalty multiplier).
- `src/pages/GalaxyMapPage.tsx` — render heralded vs. active apex bosses distinctly (e.g., pulsing magenta during herald, solid during active); show HP bar + top contributors on detail panel.
- `src/pages/MissionsPage.tsx` — apex warning panel shows current HP %, top contributors, time remaining.
- `src/components/Layout.tsx` (or `Sidebar.tsx`) — global event banner during heralded/active phases.
- `src/pages/LeaderboardPage.tsx` — new tab or section for apex event kill history with contributor breakdowns.
- `src/hooks/useApexEvent.ts` *(new)* — subscribes to current event row + galaxy_map metadata.

### Reuse of Existing Code

- `resolveCombat()` in `game-action/index.ts` — reused for per-wave damage calculation. Change: feed it the boss's remaining fleet (HP derived from `hp_remaining`) rather than the full static fleet.
- `handleSpawnWorldBoss()` pattern — herald handler mirrors it with added event-row insert.
- `galaxy_map.metadata` — already JSONB, no schema change to this column.
- Mission dispatch / travel time / return — untouched. Fleets still travel, still return home with losses.

### Error Handling & Edge Cases

- **Concurrent contributions**: Two fleets arriving simultaneously must not double-deal damage or both claim killing blow. Use a row lock on `apex_boss_events` inside `resolveApexContribution()` (Postgres `SELECT … FOR UPDATE`) so contribution writes are serialized.
- **Fleet arrives after window expired**: Reject with a clear error, fleet returns home without losses (it never engaged). Handled in `handleResolveMission` by checking `phase` before damage application.
- **Killing blow + overkill**: If incoming damage exceeds `hp_remaining`, cap the recorded damage at `hp_remaining` so reward split reflects actual contribution, not raw rolled damage.
- **Player has no fleet when herald fires**: Fine — participation is opt-in. Herald UI clearly states minimum recommended fleet.
- **Only one contributor**: Proportional split still works (they get 100%, plus killing-blow bonus). Feels solo but permitted.
- **Zero contributors (escaped with no damage)**: Event resolves as `escaped` with no `world_boss_contributions` rows. Broadcasts a "the Void Leviathan has fled…" inbox message to all players for lore/tension.

### Testing Strategy

- **Unit:** `resolveApexContribution()` with synthetic HP pools — verify damage capping, contributor map updates, killing-blow detection.
- **Integration (Supabase local):** Full lifecycle test — herald → activate → two players contribute → kill → rewards written.
- **Edge cases:** Concurrent-contribution race (spawn two fleets with identical arrival times); fleet arrives after expiry; zero-contributor escape.
- **E2E manual via Playwright MCP:** Trigger herald via dev button; verify banner appears; verify HP drops after raid resolves; verify leaderboard post-kill.

## Verification (End-to-End)

1. Apply migration locally: `supabase db reset` (or equivalent), verify new tables.
2. Deploy edge function: `supabase functions deploy game-action --no-verify-jwt`.
3. In-browser:
   - Dev button triggers `herald-apex-boss` action. Confirm `apex_boss_events` row in `heralded` phase + `galaxy_map` entry + global banner on all logged-in clients.
   - Wait for/fast-forward herald window; phase flips to `active`.
   - Two test accounts each dispatch a raid; verify arrival → HP decrement → `damage_contributors` updates in galaxy_map detail.
   - Third raid lands killing blow; verify `world_boss_contributions` rows, proportional reward math, killing-blow +10% flag, galaxy_map entry cleared, event marked `killed`.
4. Second scenario: trigger herald, let window expire with boss at partial HP. Verify `escaped` phase, partial-reward contributions inserted, inbox message sent.
5. Leaderboard page shows recent apex event with contributor breakdown.

## Out of Scope (Explicitly Deferred)

- **Automated event scheduling** — v2. v1 is dev-triggered.
- **New apex boss variants** — Void Leviathan reuses its existing stats; additional apex bosses come later.
- **Alliance / party mechanics** — no formal grouping; cooperation is organic via shared-target.
- **Cancel/recall on fleets or queues** — tracked as separate backlog item (see memory `project_cancel_recall_backlog.md`).
- **Chat / coordination UI** — players coordinate out-of-game for v1.
- **Risk-weighted damage rewards** — v1 uses raw damage for simplicity.
