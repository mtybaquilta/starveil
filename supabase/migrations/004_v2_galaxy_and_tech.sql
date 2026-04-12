-- ============================================================
-- 004: v2 Galaxy Map, Technologies, and Research Queue
-- ============================================================

-- Galaxy Map: one row per coordinate a player knows about
-- visibility: 'detected' = Radar found something here (type unknown)
--             'revealed'  = Probe confirmed what is at this coordinate
create table galaxy_map (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  coordinates   text not null,
  visibility    text not null default 'detected', -- 'detected' | 'revealed'
  location_type text,           -- null until revealed: 'asteroid_field' | 'bandit_camp' | 'debris_field' | 'empty'
  name          text,
  metadata      jsonb not null default '{}',
  detected_at   timestamptz not null default now(),
  revealed_at   timestamptz,
  cleared_at    timestamptz,    -- set when location content is consumed/defeated
  respawns_at   timestamptz,    -- set alongside cleared_at; content regenerates after this time
  unique (player_id, coordinates)
);
alter table galaxy_map enable row level security;
create policy "galaxy_map_select_own" on galaxy_map
  for select using (player_id = auth.uid());
create index galaxy_map_player_id on galaxy_map (player_id);
create index galaxy_map_respawns on galaxy_map (respawns_at) where respawns_at is not null;

-- Player Technologies: tracks research level per player per tech
create table player_technologies (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  tech_id    text not null,
  level      integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (player_id, tech_id)
);
alter table player_technologies enable row level security;
create policy "player_technologies_select_own" on player_technologies
  for select using (player_id = auth.uid());
create index player_technologies_player_id on player_technologies (player_id);

-- Research Queue: one active research slot per player (independent of build/ship queues)
create table research_queue (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  tech_id      text not null,
  target_level integer not null,
  started_at   timestamptz not null default now(),
  completes_at timestamptz not null,
  unique (player_id)   -- only one active research at a time
);
alter table research_queue enable row level security;
create policy "research_queue_select_own" on research_queue
  for select using (player_id = auth.uid());
create index research_queue_player_id on research_queue (player_id);

-- ============================================================
-- Update initialize_player: add radar_array, new ship types,
-- seed player_technologies for all known techs
-- ============================================================
create or replace function initialize_player(p_username text) returns uuid as $$
declare
  v_planet_id uuid;
  v_player_id uuid;
begin
  v_player_id := auth.uid();

  insert into players (id, username) values (v_player_id, p_username);

  insert into planets (player_id, name, coordinates)
  values (
    v_player_id,
    'Homeworld',
    '1:' || floor(random() * 500 + 1)::text || ':' || floor(random() * 15 + 1)::text
  )
  returning id into v_planet_id;

  -- Buildings (includes radar_array at level 0)
  insert into planet_buildings (planet_id, building_id, level) values
    (v_planet_id, 'headquarters',  1),
    (v_planet_id, 'metal_mine',    0),
    (v_planet_id, 'gas_refinery',  0),
    (v_planet_id, 'solar_array',   1),
    (v_planet_id, 'metal_storage', 0),
    (v_planet_id, 'gas_storage',   0),
    (v_planet_id, 'weather_station', 0),
    (v_planet_id, 'research_lab',  0),
    (v_planet_id, 'shipyard',      0),
    (v_planet_id, 'radar_array',   0);

  -- Ships (v2 roster)
  insert into planet_ships (planet_id, ship_type, count) values
    (v_planet_id, 'probe',         0),
    (v_planet_id, 'small_fighter', 0),
    (v_planet_id, 'large_fighter', 0),
    (v_planet_id, 'cruiser',       0),
    (v_planet_id, 'gunship',       0),
    (v_planet_id, 'destroyer',     0),
    (v_planet_id, 'harvester',     0),
    (v_planet_id, 'small_cargo',   0),
    (v_planet_id, 'large_cargo',   0);

  -- Technologies (all start at level 0)
  insert into player_technologies (player_id, tech_id, level) values
    (v_player_id, 'reinforced_hulls',        0),
    (v_player_id, 'advanced_weapons',        0),
    (v_player_id, 'capital_ship_engineering',0),
    (v_player_id, 'efficient_refining',      0),
    (v_player_id, 'deep_core_mining',        0),
    (v_player_id, 'expanded_storage',        0),
    (v_player_id, 'rapid_extraction',        0),
    (v_player_id, 'long_range_sensors',      0),
    (v_player_id, 'probe_durability',        0),
    (v_player_id, 'advanced_cartography',    0),
    (v_player_id, 'solar_efficiency',        0),
    (v_player_id, 'storm_hardening',         0),
    (v_player_id, 'fusion_theory',           0);

  insert into planet_weather (planet_id, weather_type, expires_at)
    values (v_planet_id, 'calm_skies', null);

  insert into planet_events (planet_id, event_type, message)
    values (v_planet_id, 'system', 'Welcome to your new colony! Start building your empire.');

  return v_planet_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Backfill existing planets / players
-- ============================================================

-- Add radar_array building to existing planets
insert into planet_buildings (planet_id, building_id, level)
  select id, 'radar_array', 0 from planets
  on conflict (planet_id, building_id) do nothing;

-- Add v2 ship types to existing planets
insert into planet_ships (planet_id, ship_type, count)
  select p.id, s.ship_type, 0
  from planets p
  cross join (
    values ('cruiser'), ('gunship'), ('destroyer'), ('harvester'), ('small_cargo'), ('large_cargo')
  ) as s(ship_type)
  on conflict (planet_id, ship_type) do nothing;

-- Seed player_technologies for all existing players
insert into player_technologies (player_id, tech_id, level)
  select pl.id, t.tech_id, 0
  from players pl
  cross join (
    values
      ('reinforced_hulls'), ('advanced_weapons'), ('capital_ship_engineering'),
      ('efficient_refining'), ('deep_core_mining'), ('expanded_storage'), ('rapid_extraction'),
      ('long_range_sensors'), ('probe_durability'), ('advanced_cartography'),
      ('solar_efficiency'), ('storm_hardening'), ('fusion_theory')
  ) as t(tech_id)
  on conflict (player_id, tech_id) do nothing;
