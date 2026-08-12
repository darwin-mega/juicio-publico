-- Base MVP para amigos, invitaciones directas y campeonatos privados.
-- Ejecutar en Supabase SQL Editor cuando se quiera activar la capa social.

create table if not exists public.social_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  friend_code text not null unique,
  created_at_ms bigint not null,
  updated_at_ms bigint not null
);

create index if not exists social_user_profiles_username_idx
  on public.social_user_profiles (lower(username));

create table if not exists public.player_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists player_friendships_requester_idx
  on public.player_friendships (requester_id, status);

create index if not exists player_friendships_addressee_idx
  on public.player_friendships (addressee_id, status);

create unique index if not exists player_friendships_pair_unique_idx
  on public.player_friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create table if not exists public.room_direct_invites (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  expires_at_ms bigint,
  unique (room_id, invitee_id)
);

create index if not exists room_direct_invites_invitee_idx
  on public.room_direct_invites (invitee_id, status, created_at_ms desc);

create table if not exists public.private_competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator_id uuid not null references auth.users(id) on delete cascade,
  duration_type text not null check (duration_type in ('monthly', 'bimonthly')),
  starts_at_ms bigint not null,
  ends_at_ms bigint not null,
  status text not null check (status in ('upcoming', 'active', 'finished')),
  created_at_ms bigint not null,
  updated_at_ms bigint not null
);

create table if not exists public.private_competition_members (
  competition_id uuid not null references public.private_competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited', 'accepted', 'declined', 'active')),
  score integer not null default 0,
  invited_by uuid references auth.users(id) on delete set null,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  primary key (competition_id, user_id)
);

create index if not exists private_competition_members_user_idx
  on public.private_competition_members (user_id, status);

create index if not exists private_competition_members_score_idx
  on public.private_competition_members (competition_id, score desc);

alter table public.social_user_profiles enable row level security;
alter table public.player_friendships enable row level security;
alter table public.room_direct_invites enable row level security;
alter table public.private_competitions enable row level security;
alter table public.private_competition_members enable row level security;

drop policy if exists "players can read social profiles" on public.social_user_profiles;
create policy "players can read social profiles"
  on public.social_user_profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "players can upsert own social profile" on public.social_user_profiles;
create policy "players can upsert own social profile"
  on public.social_user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "players can update own social profile" on public.social_user_profiles;
create policy "players can update own social profile"
  on public.social_user_profiles for update
  using (auth.uid() = user_id);

drop policy if exists "players can read own friendships" on public.player_friendships;
create policy "players can read own friendships"
  on public.player_friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "players can create friendship requests" on public.player_friendships;
create policy "players can create friendship requests"
  on public.player_friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists "players can update own friendship side" on public.player_friendships;
create policy "players can update own friendship side"
  on public.player_friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "players can read own direct invites" on public.room_direct_invites;
create policy "players can read own direct invites"
  on public.room_direct_invites for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

drop policy if exists "players can create direct invites" on public.room_direct_invites;
create policy "players can create direct invites"
  on public.room_direct_invites for insert
  with check (auth.uid() = inviter_id);

drop policy if exists "players can update own direct invites" on public.room_direct_invites;
create policy "players can update own direct invites"
  on public.room_direct_invites for update
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

drop policy if exists "players can read own competitions" on public.private_competitions;
create policy "players can read own competitions"
  on public.private_competitions for select
  using (
    auth.uid() = creator_id or exists (
      select 1 from public.private_competition_members m
      where m.competition_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "players can create competitions" on public.private_competitions;
create policy "players can create competitions"
  on public.private_competitions for insert
  with check (auth.uid() = creator_id);

drop policy if exists "players can read own competition memberships" on public.private_competition_members;
create policy "players can read own competition memberships"
  on public.private_competition_members for select
  using (
    auth.uid() = user_id or exists (
      select 1 from public.private_competitions c
      where c.id = competition_id and c.creator_id = auth.uid()
    )
  );

drop policy if exists "competition creators can invite members" on public.private_competition_members;
create policy "competition creators can invite members"
  on public.private_competition_members for insert
  with check (
    exists (
      select 1 from public.private_competitions c
      where c.id = competition_id and c.creator_id = auth.uid()
    )
  );

drop policy if exists "players can update own competition membership" on public.private_competition_members;
create policy "players can update own competition membership"
  on public.private_competition_members for update
  using (
    auth.uid() = user_id or exists (
      select 1 from public.private_competitions c
      where c.id = competition_id and c.creator_id = auth.uid()
    )
  );
