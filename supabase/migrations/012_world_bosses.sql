-- World boss kills leaderboard
create table world_boss_kills (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  planet_id  uuid not null references planets(id) on delete cascade,
  boss_id    text not null,
  killed_at  timestamptz not null default now()
);
create index world_boss_kills_boss on world_boss_kills (boss_id, killed_at desc);
create index world_boss_kills_player on world_boss_kills (player_id);
alter table world_boss_kills enable row level security;
create policy "world_boss_kills_public_read" on world_boss_kills
  for select using (true);
