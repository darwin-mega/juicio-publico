-- Endurecimiento conservador de la base existente.
-- No modifica datos ni cambia el acceso público efectivo al ranking.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Quitar privilegios que RLS no necesita y, en el caso de TRUNCATE,
-- que ni siquiera pasan por las políticas por fila.
revoke all on table public.player_progress_profiles from anon, authenticated;
revoke all on table public.progress_processed_games from anon, authenticated;
revoke all on table public.progress_notifications from anon, authenticated;
revoke all on table public.social_user_profiles from anon, authenticated;
revoke all on table public.player_friendships from anon, authenticated;
revoke all on table public.room_direct_invites from anon, authenticated;
revoke all on table public.private_competitions from anon, authenticated;
revoke all on table public.private_competition_members from anon, authenticated;

grant select on table public.player_progress_profiles to anon, authenticated;
grant select on table public.progress_notifications to authenticated;
grant select, insert, update on table public.social_user_profiles to authenticated;
grant select, insert, update on table public.player_friendships to authenticated;
grant select, insert, update on table public.room_direct_invites to authenticated;
grant select, insert on table public.private_competitions to authenticated;
grant select, insert, update on table public.private_competition_members to authenticated;

-- El ranking ya era público mediante una política USING (true). La política
-- de lectura propia era redundante y generaba múltiples políticas permisivas.
drop policy if exists "players can read own progress" on public.player_progress_profiles;
drop policy if exists "players can read ranking profiles" on public.player_progress_profiles;
create policy "players can read ranking profiles"
  on public.player_progress_profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "players can read own notifications" on public.progress_notifications;
create policy "players can read own notifications"
  on public.progress_notifications
  for select
  to authenticated
  using ((select auth.uid())::text = player_id);

drop policy if exists "players can read social profiles" on public.social_user_profiles;
create policy "players can read social profiles"
  on public.social_user_profiles
  for select
  to authenticated
  using (true);

drop policy if exists "players can upsert own social profile" on public.social_user_profiles;
create policy "players can upsert own social profile"
  on public.social_user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "players can update own social profile" on public.social_user_profiles;
create policy "players can update own social profile"
  on public.social_user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "players can read own friendships" on public.player_friendships;
create policy "players can read own friendships"
  on public.player_friendships
  for select
  to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

drop policy if exists "players can create friendship requests" on public.player_friendships;
create policy "players can create friendship requests"
  on public.player_friendships
  for insert
  to authenticated
  with check ((select auth.uid()) = requester_id);

drop policy if exists "players can update own friendship side" on public.player_friendships;
create policy "players can update own friendship side"
  on public.player_friendships
  for update
  to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

drop policy if exists "players can read own direct invites" on public.room_direct_invites;
create policy "players can read own direct invites"
  on public.room_direct_invites
  for select
  to authenticated
  using ((select auth.uid()) = inviter_id or (select auth.uid()) = invitee_id);

drop policy if exists "players can create direct invites" on public.room_direct_invites;
create policy "players can create direct invites"
  on public.room_direct_invites
  for insert
  to authenticated
  with check ((select auth.uid()) = inviter_id);

drop policy if exists "players can update own direct invites" on public.room_direct_invites;
create policy "players can update own direct invites"
  on public.room_direct_invites
  for update
  to authenticated
  using ((select auth.uid()) = inviter_id or (select auth.uid()) = invitee_id)
  with check ((select auth.uid()) = inviter_id or (select auth.uid()) = invitee_id);

drop policy if exists "players can read own competitions" on public.private_competitions;
create policy "players can read own competitions"
  on public.private_competitions
  for select
  to authenticated
  using (
    (select auth.uid()) = creator_id
    or exists (
      select 1 from public.private_competition_members member
      where member.competition_id = private_competitions.id
        and member.user_id = (select auth.uid())
    )
  );

drop policy if exists "players can create competitions" on public.private_competitions;
create policy "players can create competitions"
  on public.private_competitions
  for insert
  to authenticated
  with check ((select auth.uid()) = creator_id);

drop policy if exists "players can read own competition memberships" on public.private_competition_members;
create policy "players can read own competition memberships"
  on public.private_competition_members
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.private_competitions competition
      where competition.id = private_competition_members.competition_id
        and competition.creator_id = (select auth.uid())
    )
  );

drop policy if exists "competition creators can invite members" on public.private_competition_members;
create policy "competition creators can invite members"
  on public.private_competition_members
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.private_competitions competition
      where competition.id = private_competition_members.competition_id
        and competition.creator_id = (select auth.uid())
    )
  );

drop policy if exists "players can update own competition membership" on public.private_competition_members;
create policy "players can update own competition membership"
  on public.private_competition_members
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.private_competitions competition
      where competition.id = private_competition_members.competition_id
        and competition.creator_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.private_competitions competition
      where competition.id = private_competition_members.competition_id
        and competition.creator_id = (select auth.uid())
    )
  );

create index if not exists private_competition_members_invited_by_idx
  on public.private_competition_members (invited_by);
create index if not exists private_competitions_creator_idx
  on public.private_competitions (creator_id);
create index if not exists room_direct_invites_inviter_idx
  on public.room_direct_invites (inviter_id);
