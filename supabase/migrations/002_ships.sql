-- planet_ships: tracks fleet counts per planet
create table planet_ships (
  id          uuid primary key default gen_random_uuid(),
  planet_id   uuid not null references planets(id) on delete cascade,
  ship_type   text not null,
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (planet_id, ship_type)
);
alter table planet_ships enable row level security;
create policy "planet_ships_select_own" on planet_ships
  for select using (planet_id in (select id from planets where player_id = auth.uid()));
create index planet_ships_planet_id on planet_ships (planet_id);

-- ship_queue: one active ship build per planet
create table ship_queue (
  id           uuid primary key default gen_random_uuid(),
  planet_id    uuid not null references planets(id) on delete cascade,
  ship_type    text not null,
  quantity     integer not null default 1,
  started_at   timestamptz not null default now(),
  completes_at timestamptz not null
);
alter table ship_queue enable row level security;
create policy "ship_queue_select_own" on ship_queue
  for select using (planet_id in (select id from planets where player_id = auth.uid()));
create index ship_queue_planet_id on ship_queue (planet_id);

-- Updated initialize_player: adds shipyard building + all ship fleet rows
create or replace function initialize_player(p_username text) returns uuid as $$
declare v_planet_id uuid;
begin
  insert into players (id, username) values (auth.uid(), p_username);
  insert into planets (player_id, name, coordinates)
  values (auth.uid(), 'Homeworld', '1:' || floor(random() * 500 + 1)::text || ':' || floor(random() * 15 + 1)::text)
  returning id into v_planet_id;
  insert into planet_buildings (planet_id, building_id, level) values
    (v_planet_id, 'headquarters', 1),
    (v_planet_id, 'metal_mine', 0),
    (v_planet_id, 'gas_refinery', 0),
    (v_planet_id, 'solar_array', 1),
    (v_planet_id, 'metal_storage', 0),
    (v_planet_id, 'gas_storage', 0),
    (v_planet_id, 'weather_station', 0),
    (v_planet_id, 'research_lab', 0),
    (v_planet_id, 'shipyard', 0);
  insert into planet_ships (planet_id, ship_type, count) values
    (v_planet_id, 'probe', 0),
    (v_planet_id, 'scout', 0),
    (v_planet_id, 'explorer', 0),
    (v_planet_id, 'small_fighter', 0),
    (v_planet_id, 'large_fighter', 0),
    (v_planet_id, 'transport', 0);
  insert into planet_weather (planet_id, weather_type, expires_at)
    values (v_planet_id, 'calm_skies', null);
  insert into planet_events (planet_id, event_type, message)
    values (v_planet_id, 'system', 'Welcome to your new colony! Start building your empire.');
  return v_planet_id;
end;
$$ language plpgsql security definer;

-- Backfill existing planets with shipyard building
insert into planet_buildings (planet_id, building_id, level)
  select id, 'shipyard', 0 from planets
  on conflict (planet_id, building_id) do nothing;

-- Backfill existing planets with all ship fleet rows
insert into planet_ships (planet_id, ship_type, count)
  select p.id, s.ship_type, 0
  from planets p
  cross join (
    values ('probe'), ('scout'), ('explorer'), ('small_fighter'), ('large_fighter'), ('transport')
  ) as s(ship_type)
  on conflict (planet_id, ship_type) do nothing;
