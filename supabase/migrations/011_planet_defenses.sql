-- Create planet_defenses table (mirrors planet_ships)
create table planet_defenses (
  id           uuid primary key default gen_random_uuid(),
  planet_id    uuid not null references planets(id) on delete cascade,
  defense_type text not null,
  count        integer not null default 0,
  updated_at   timestamptz not null default now(),
  unique (planet_id, defense_type)
);
alter table planet_defenses enable row level security;
create policy "planet_defenses_select_own" on planet_defenses
  for select using (planet_id in (select id from planets where player_id = auth.uid()));
create index planet_defenses_planet_id on planet_defenses (planet_id);

-- Migrate existing defense building levels → defense counts
insert into planet_defenses (planet_id, defense_type, count)
  select planet_id, building_id, level
  from planet_buildings
  where building_id in (
    'perimeter_turret','ion_cannon','missile_battery',
    'shield_generator','sensor_jammer','orbital_platform'
  )
  on conflict (planet_id, defense_type) do nothing;

-- Remove defense buildings from planet_buildings
delete from planet_buildings
  where building_id in (
    'perimeter_turret','ion_cannon','missile_battery',
    'shield_generator','sensor_jammer','orbital_platform'
  );

-- Update initialize_player: remove defense building inserts, add planet_defenses inserts
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

  insert into planet_buildings (planet_id, building_id, level) values
    (v_planet_id, 'headquarters',    1),
    (v_planet_id, 'metal_mine',      0),
    (v_planet_id, 'gas_refinery',    0),
    (v_planet_id, 'solar_array',     1),
    (v_planet_id, 'metal_storage',   0),
    (v_planet_id, 'gas_storage',     0),
    (v_planet_id, 'weather_station', 0),
    (v_planet_id, 'research_lab',    0),
    (v_planet_id, 'shipyard',        0),
    (v_planet_id, 'radar_array',     0);

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

  insert into planet_defenses (planet_id, defense_type, count) values
    (v_planet_id, 'perimeter_turret', 0),
    (v_planet_id, 'ion_cannon',       0),
    (v_planet_id, 'missile_battery',  0),
    (v_planet_id, 'shield_generator', 0),
    (v_planet_id, 'sensor_jammer',    0),
    (v_planet_id, 'orbital_platform', 0);

  insert into player_technologies (player_id, tech_id, level) values
    (v_player_id, 'reinforced_hulls',         0),
    (v_player_id, 'advanced_weapons',         0),
    (v_player_id, 'capital_ship_engineering', 0),
    (v_player_id, 'efficient_refining',       0),
    (v_player_id, 'deep_core_mining',         0),
    (v_player_id, 'expanded_storage',         0),
    (v_player_id, 'rapid_extraction',         0),
    (v_player_id, 'long_range_sensors',       0),
    (v_player_id, 'probe_durability',         0),
    (v_player_id, 'advanced_cartography',     0),
    (v_player_id, 'solar_efficiency',         0),
    (v_player_id, 'storm_hardening',          0),
    (v_player_id, 'fusion_theory',            0);

  insert into planet_weather (planet_id, weather_type, expires_at)
    values (v_planet_id, 'calm_skies', null);
  insert into planet_events (planet_id, event_type, message)
    values (v_planet_id, 'system', 'Welcome to your new colony! Start building your empire.');
  return v_planet_id;
end;
$$ language plpgsql security definer;

-- Backfill planet_defenses for all existing planets (those not caught by migration above)
insert into planet_defenses (planet_id, defense_type, count)
  select p.id, d.defense_type, 0
  from planets p
  cross join (
    values ('perimeter_turret'),('ion_cannon'),('missile_battery'),
           ('shield_generator'),('sensor_jammer'),('orbital_platform')
  ) as d(defense_type)
  on conflict (planet_id, defense_type) do nothing;
