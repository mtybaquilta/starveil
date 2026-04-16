-- Player Achievements
create table player_achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique (player_id, achievement_id)
);

create index player_achievements_player on player_achievements (player_id);

alter table player_achievements enable row level security;

create policy "player_achievements_select_own" on player_achievements
  for select using (player_id = auth.uid());
