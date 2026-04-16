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
create policy "planets_select_any" on planets
  for select using (true);

-- Allow reading other players' usernames for PvP display
create policy "players_select_any" on players
  for select using (true);
