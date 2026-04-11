-- Known locations discovered by scouts/explorers
create table known_locations (
  id            uuid primary key default gen_random_uuid(),
  planet_id     uuid not null references planets(id) on delete cascade,
  coordinates   text not null,
  name          text not null,
  location_type text not null,  -- 'asteroid_field', 'nebula', 'debris_field', 'bandit_camp'
  metadata      jsonb not null default '{}',
  discovered_at timestamptz not null default now(),
  unique (planet_id, coordinates)
);
alter table known_locations enable row level security;
create policy "known_locations_select_own" on known_locations
  for select using (planet_id in (select id from planets where player_id = auth.uid()));
create index known_locations_planet_id on known_locations (planet_id);

-- Active and completed missions
create table missions (
  id            uuid primary key default gen_random_uuid(),
  planet_id     uuid not null references planets(id) on delete cascade,
  mission_type  text not null,
  status        text not null default 'traveling',
  target_coords text not null,
  target_name   text not null,
  fleet         jsonb not null,
  dispatched_at timestamptz not null default now(),
  arrives_at    timestamptz not null,
  returns_at    timestamptz not null,
  result        jsonb,
  created_at    timestamptz not null default now()
);
alter table missions enable row level security;
create policy "missions_select_own" on missions
  for select using (planet_id in (select id from planets where player_id = auth.uid()));
create index missions_planet_id on missions (planet_id);
create index missions_active on missions (status) where status != 'completed';

-- Nearby sectors (refreshed periodically, generated server-side)
create table nearby_sectors (
  id           uuid primary key default gen_random_uuid(),
  planet_id    uuid not null references planets(id) on delete cascade,
  coordinates  text not null,
  name         text not null,
  sector_type  text not null,
  distance     integer not null,
  richness     integer not null default 1,
  danger_level integer not null default 0,
  expires_at   timestamptz not null,
  unique (planet_id, coordinates)
);
alter table nearby_sectors enable row level security;
create policy "nearby_sectors_select_own" on nearby_sectors
  for select using (planet_id in (select id from planets where player_id = auth.uid()));
create index nearby_sectors_planet_id on nearby_sectors (planet_id);
