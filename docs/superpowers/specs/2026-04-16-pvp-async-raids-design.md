# PvP: Async Raids

## Context

The first multiplayer feature. Players can discover and attack each other's planets using the existing fleet dispatch and combat resolution mechanics. Designed to be asynchronous — no real-time interaction required. Both attacker and defender see fleet movement on the galaxy map, creating tension without requiring simultaneous play.

---

## Discovery & Targeting

### Probe-Based Discovery

Modify `send_probe` in the edge function:
1. Before checking `galaxy_planets` (colonizable) and before rolling `rollLocationType()`, check if any other player's planet exists at the target coordinate
2. If found: reveal as `player_colony` location type with the owner's username
3. Player colonies appear on the galaxy map with a distinct marker (red/orange icon)

### Targeted Scanning

New edge function action: `scan_coordinate`
- Player specifies exact coordinates to scan (e.g., "1:250:7")
- Costs 1 probe (consumed, same as `send_probe`)
- Reveals what's at that coordinate — could be a player colony, asteroid field, habitable planet, or empty space
- This gives players agency in finding neighbors vs. relying on random radar discovery

### Priority order for coordinate resolution:
1. Check for other player's planet → `player_colony`
2. Check `galaxy_planets` for unclaimed habitable planet → `habitable_planet`
3. Roll `rollLocationType()` → existing types (asteroid, bandit, debris, empty)

---

## Attack Flow

### 1. Dispatch (`attack_player` action)

**Prerequisites:**
- Target must be a discovered `player_colony` on the player's galaxy map
- Player must have combat ships on the attacking planet
- Cannot attack your own planets

**Process:**
- Player selects fleet composition from available ships
- Ships are removed from `planet_ships` (committed to the attack)
- Travel time = `distance / slowestShipSpeed * 60` seconds (same formula as missions)
- Creates entry in `player_attacks` table with status `in_transit`

### 2. Travel Phase

- Both attacker and defender can see the fleet on the galaxy map as a **moving dot**
- Attacker sees: outbound attack with ETA countdown
- Defender sees: "Incoming attack from [username]" with ETA countdown
- Defender receives a planet event: "Warning: Fleet from [username] detected, ETA [time]"
- This gives the defender time to recall fleets from missions or build more ships

### 3. Combat Resolution (`resolve_attack` action)

Triggered when `arrives_at` is reached (client polls and calls resolve, same pattern as mission resolution).

**Defender's fleet**: All ships currently stationed on the target planet (ships on missions are not counted — they're away). Future: defense buildings could add bonus stats.

**Combat mechanics**: Reuse existing `resolveCombat()` function:
- Attacker's fleet vs. defender's stationed fleet
- Same HP/attack/defense per-ship-type calculations
- Same round-by-round resolution

**Outcomes:**

**Attacker wins:**
- Surviving attacker ships steal resources up to total cargo capacity
- Resources deducted from defender's planet
- Surviving ships return to attacker's planet (new return mission created)
- Both players get combat report in planet_events

**Defender wins:**
- Attacker's entire fleet is destroyed (already removed from planet_ships on dispatch)
- Defender loses ships destroyed during combat
- Defender keeps all resources
- Both players get combat report in planet_events

**Draw / partial:**
- If attacker has surviving ships but no cargo capacity, they return empty
- If defender has no stationed fleet, attacker wins automatically (undefended planet)

---

## Database

### New Table

```sql
player_attacks (
  id uuid PK DEFAULT gen_random_uuid(),
  attacker_id uuid NOT NULL REFERENCES players(id),
  attacker_planet_id uuid NOT NULL REFERENCES planets(id),
  defender_id uuid NOT NULL REFERENCES players(id),
  defender_planet_id uuid NOT NULL REFERENCES planets(id),
  fleet jsonb NOT NULL,                    -- e.g. {"small_fighter": 5, "cruiser": 2}
  status text NOT NULL DEFAULT 'in_transit', -- in_transit | returning | resolved
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  arrives_at timestamptz NOT NULL,
  return_arrives_at timestamptz,           -- set after combat, for surviving fleet return
  resolved_at timestamptz,
  result jsonb,                            -- combat log, resources stolen, losses
  target_coordinates text NOT NULL
)
```

### RLS Policies

```sql
-- Attacker can see their outgoing attacks
CREATE POLICY "attacks_select_attacker" ON player_attacks
  FOR SELECT USING (attacker_id = auth.uid());

-- Defender can see incoming attacks
CREATE POLICY "attacks_select_defender" ON player_attacks
  FOR SELECT USING (defender_id = auth.uid());
```

### Planet Visibility (Limited)

Add a public read policy on `planets` for minimal info only:
```sql
-- Any authenticated player can see basic planet info (for galaxy map markers)
CREATE POLICY "planets_select_public_basic" ON planets
  FOR SELECT USING (true)
  -- Application enforces that only name + coordinates are exposed via the query
```

The client query for discovered player colonies only selects `name, coordinates, player_id` — never resources or building data.

---

## Galaxy Map Updates

### New Markers

- **Player Colony** (discovered): Distinct icon (red/orange planet) with owner's username label
- **Own Colony**: Current green/blue marker (unchanged)

### Fleet Movement Visualization

- **Outgoing attack**: Moving dot from your planet toward target, with fleet composition tooltip on hover
- **Incoming attack**: Moving dot from attacker toward your planet, with "Incoming Attack" label and ETA
- **Returning fleet**: Moving dot from target back to your planet (after combat)

### Position Calculation

Fleet position interpolated based on:
```
progress = (now - dispatched_at) / (arrives_at - dispatched_at)
currentPosition = lerp(sourceCoords, targetCoords, progress)
```

---

## Testing Strategy

### Dev Mode: Spawn Test Opponent

New dev-only action `spawn_test_opponent`:
- Creates a second player account with a planet near the current player
- Pre-stocks the opponent with ships and resources
- Allows testing the full attack flow single-handedly

### Accelerated Timers

In dev mode, attack travel time is shortened to 10 seconds regardless of distance.

### Two-Browser Testing

For validating the real-time feel:
- Open two browsers with different auth sessions
- One attacks, the other watches the incoming fleet dot
- Verify both sides see correct combat results

---

## What's NOT in V1

- No alliances/clans
- No real-time chat
- No trade between players
- No leaderboards (fast follow-up)
- No espionage beyond probe discovery
- Defense buildings don't factor into PvP combat (fleet-only)
- No attack cooldowns or peace treaties (add if griefing becomes an issue)

---

## Verification

1. Probe a coordinate with another player's planet → reveals as "Player Colony"
2. Use `scan_coordinate` to check a specific coordinate → works correctly
3. Dispatch attack fleet → ships removed from planet, attack visible on galaxy map
4. Defender sees incoming attack with ETA on their galaxy map
5. Combat resolves correctly using existing mechanics
6. Attacker wins → resources stolen, surviving fleet returns
7. Defender wins → attacker fleet destroyed, defender keeps resources
8. Combat reports appear in both players' event logs
9. Dev mode: spawn test opponent and run full attack cycle in <30 seconds
