create extension if not exists pgcrypto;

create table if not exists public.player_progress_profiles (
  player_id text primary key,
  display_name text not null,
  stats jsonb not null,
  monthly_prestige jsonb not null default '{}'::jsonb,
  highlighted_title_id text,
  unlocked_title_ids text[] not null default '{}',
  unlocked_rewards jsonb not null default '[]'::jsonb,
  created_at_ms bigint not null,
  updated_at_ms bigint not null
);

create table if not exists public.progress_processed_games (
  game_id text primary key,
  processed_at_ms bigint not null
);

create table if not exists public.progress_notifications (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_progress_profiles(player_id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  reward_id text,
  read_at timestamptz,
  created_at_ms bigint not null
);

create index if not exists player_progress_profiles_prestige_idx
  on public.player_progress_profiles (((stats->>'publicPrestige')::int) desc);

create index if not exists progress_notifications_player_idx
  on public.progress_notifications (player_id, created_at_ms desc);

create unique index if not exists progress_notifications_player_reward_idx
  on public.progress_notifications (player_id, reward_id)
  where reward_id is not null;

alter table public.player_progress_profiles enable row level security;
alter table public.progress_processed_games enable row level security;
alter table public.progress_notifications enable row level security;

drop policy if exists "players can read own progress" on public.player_progress_profiles;
create policy "players can read own progress"
  on public.player_progress_profiles
  for select
  using (auth.uid()::text = player_id);

drop policy if exists "players can read ranking profiles" on public.player_progress_profiles;
create policy "players can read ranking profiles"
  on public.player_progress_profiles
  for select
  using (true);

drop policy if exists "players can read own notifications" on public.progress_notifications;
create policy "players can read own notifications"
  on public.progress_notifications
  for select
  using (auth.uid()::text = player_id);
