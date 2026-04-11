-- Players
create table players (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table players enable row level security;

create policy "players_select_own" on players
  for select using (id = auth.uid());
create policy "players_update_own" on players
  for update using (id = auth.uid());
create policy "players_insert_own" on players
  for insert with check (id = auth.uid());

-- Planets
create table planets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  name text not null,
  coordinates text not null,
  diameter integer not null default 12400,
  max_building_slots integer not null default 12,
  metal_amount numeric not null default 500,
  gas_amount numeric not null default 200,
  last_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table planets enable row level security;

create policy "planets_select_own" on planets
  for select using (player_id = auth.uid());
create policy "planets_update_own" on planets
  for update using (player_id = auth.uid());

-- Planet Buildings
create table planet_buildings (
  id uuid primary key default gen_random_uuid(),
  planet_id uuid not null references planets(id) on delete cascade,
  building_id text not null,
  level integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (planet_id, building_id)
);

alter table planet_buildings enable row level security;

create policy "planet_buildings_select_own" on planet_buildings
  for select using (
    planet_id in (select id from planets where player_id = auth.uid())
  );
create policy "planet_buildings_update_own" on planet_buildings
  for update using (
    planet_id in (select id from planets where player_id = auth.uid())
  );

-- Construction Queue
create table construction_queue (
  id uuid primary key default gen_random_uuid(),
  planet_id uuid not null references planets(id) on delete cascade,
  building_id text not null,
  target_level integer not null,
  started_at timestamptz not null default now(),
  completes_at timestamptz not null
);

alter table construction_queue enable row level security;

create policy "construction_queue_select_own" on construction_queue
  for select using (
    planet_id in (select id from planets where player_id = auth.uid())
  );

-- Planet Events
create table planet_events (
  id uuid primary key default gen_random_uuid(),
  planet_id uuid not null references planets(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index planet_events_planet_created on planet_events (planet_id, created_at desc);

alter table planet_events enable row level security;

create policy "planet_events_select_own" on planet_events
  for select using (
    planet_id in (select id from planets where player_id = auth.uid())
  );

-- Planet Weather
create table planet_weather (
  id uuid primary key default gen_random_uuid(),
  planet_id uuid not null references planets(id) on delete cascade,
  weather_type text not null default 'calm_skies',
  metal_multiplier numeric not null default 1.0,
  gas_multiplier numeric not null default 1.0,
  energy_multiplier numeric not null default 1.0,
  started_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table planet_weather enable row level security;

create policy "planet_weather_select_own" on planet_weather
  for select using (
    planet_id in (select id from planets where player_id = auth.uid())
  );

-- Function: Initialize a new player with a starting planet
create or replace function initialize_player(
  p_username text
) returns uuid as $$
declare
  v_planet_id uuid;
begin
  -- Create player
  insert into players (id, username) values (auth.uid(), p_username);

  -- Create starting planet
  insert into planets (player_id, name, coordinates)
  values (auth.uid(), 'Homeworld', '1:' || floor(random() * 500 + 1)::text || ':' || floor(random() * 15 + 1)::text)
  returning id into v_planet_id;

  -- Initialize all buildings (HQ and Solar Array start at level 1, rest at 0)
  insert into planet_buildings (planet_id, building_id, level)
  values
    (v_planet_id, 'headquarters', 1),
    (v_planet_id, 'metal_mine', 0),
    (v_planet_id, 'gas_refinery', 0),
    (v_planet_id, 'solar_array', 1),
    (v_planet_id, 'metal_storage', 0),
    (v_planet_id, 'gas_storage', 0),
    (v_planet_id, 'weather_station', 0),
    (v_planet_id, 'research_lab', 0);

  -- Initialize weather as Calm Skies (permanent)
  insert into planet_weather (planet_id, weather_type, expires_at)
  values (v_planet_id, 'calm_skies', null);

  -- Welcome event
  insert into planet_events (planet_id, event_type, message)
  values (v_planet_id, 'system', 'Welcome to your new colony! Start building your empire.');

  return v_planet_id;
end;
$$ language plpgsql security definer;
