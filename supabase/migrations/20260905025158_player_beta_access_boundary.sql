begin;

alter table public.profiles alter column role set default 'PLAYER';
revoke delete on public.profiles from authenticated,anon;
create or replace function public.player_beta_protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      -- INSERT is also invoked by an upsert of an existing coach profile.
      new.role := coalesce((select role from public.profiles where id = new.id), 'PLAYER');
    elsif new.role is distinct from old.role then
      raise exception 'Account role is managed by authorized staff.';
    end if;
  end if;
  return new;
end;
$$;
create trigger player_beta_protect_profile_role before insert or update on public.profiles
for each row execute function public.player_beta_protect_profile_role();

create schema if not exists clubhouse_private;
revoke all on schema clubhouse_private from public, anon;
grant usage on schema clubhouse_private to authenticated, service_role;

create function clubhouse_private.is_staff_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.profile_team_memberships m where m.profile_id=auth.uid() and m.active
      and m.role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'))
    or exists(select 1 from public.organization_memberships m where m.profile_id=auth.uid() and m.active and m.role in ('ADMIN','COACH'))
  );
$$;
revoke all on function clubhouse_private.is_staff_account() from public, anon;
grant execute on function clubhouse_private.is_staff_account() to authenticated, service_role;

-- Global profile labels and free-form staff titles are not team authority.
create or replace function public.current_profile_can_manage_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profile_team_memberships m where m.profile_id=auth.uid()
    and m.team_id=target_team_id and m.active and m.role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'))
  or exists(select 1 from public.organization_memberships m join public.teams t on t.organization_id=m.organization_id
    where m.profile_id=auth.uid() and t.id=target_team_id and m.active and m.role in ('ADMIN','COACH'));
$$;
create or replace function public.current_profile_can_admin_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profile_team_memberships m where m.profile_id=auth.uid()
    and m.team_id=target_team_id and m.active and m.role in ('OWNER','ADMIN','HEAD_COACH'))
  or exists(select 1 from public.organization_memberships m join public.teams t on t.organization_id=m.organization_id
    where m.profile_id=auth.uid() and t.id=target_team_id and m.active and m.role='ADMIN');
$$;
create or replace function public.current_profile_can_write_player_org(target_org_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_memberships m where m.profile_id=auth.uid()
    and m.organization_id=target_org_id and m.active and m.role in ('ADMIN','COACH'))
  or exists(select 1 from public.profile_team_memberships m join public.teams t on t.id=m.team_id
    where m.profile_id=auth.uid() and t.organization_id=target_org_id and m.active
      and m.role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'));
$$;
create or replace function public.current_profile_can_admin_org(target_org_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_memberships m where m.profile_id=auth.uid()
    and m.organization_id=target_org_id and m.active and m.role='ADMIN')
  or exists(select 1 from public.profile_team_memberships m join public.teams t on t.id=m.team_id
    where m.profile_id=auth.uid() and t.organization_id=target_org_id and m.active and m.role in ('OWNER','ADMIN','HEAD_COACH'));
$$;
revoke all on function public.current_profile_can_admin_org(uuid) from public,anon;
grant execute on function public.current_profile_can_admin_org(uuid) to authenticated,service_role;
revoke all on function public.current_profile_can_manage_team(uuid),public.current_profile_can_admin_team(uuid),public.current_profile_can_write_player_org(uuid) from public,anon;
grant execute on function public.current_profile_can_manage_team(uuid),public.current_profile_can_admin_team(uuid),public.current_profile_can_write_player_org(uuid) to authenticated,service_role;

-- Restrictive policies are ANDed with existing per-resource policies. Player
-- reads use server projections instead of exposing raw metadata columns.
do $$ declare target text; begin
  foreach target in array array[
    'players','player_team_memberships','practices','practice_attendance','practice_sessions',
    'practice_session_contributors','pitch_events','hitting_events','defense_events',
    'workouts','workout_sessions','workout_sets','player_measurements','games','game_lineups',
    'plate_appearances','game_pitch_events','player_notes','development_goals','weekly_awards',
    'staff_members','staff_team_memberships','team_invitations','team_invitation_memberships',
    'roster_imports','schedule_events','weight_room_workouts','weight_room_workout_groups',
    'weight_room_workout_group_members','weight_room_workout_stations'
  ] loop
    if to_regclass('public.' || target) is not null then
      execute format('alter table public.%I enable row level security',target);
      execute format('create policy player_beta_staff_boundary on public.%I as restrictive for all to authenticated using ((select clubhouse_private.is_staff_account())) with check ((select clubhouse_private.is_staff_account()))',target);
    end if;
  end loop;
end $$;

alter table public.development_goals add column if not exists player_visible boolean not null default false;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_player_links') then
    alter publication supabase_realtime add table public.profile_player_links;
  end if;
end $$;

commit;
