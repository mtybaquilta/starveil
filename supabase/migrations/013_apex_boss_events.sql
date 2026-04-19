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
