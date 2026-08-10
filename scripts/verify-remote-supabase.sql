\set ON_ERROR_STOP on
\pset pager off

\echo Remote Supabase structural verification

do $$
declare
  expected_tables text[] := array[
    'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships', 'profile_team_memberships',
    'players', 'player_team_memberships', 'practices', 'practice_attendance',
    'roster_imports',
    'practice_sessions', 'pitch_events', 'hitting_events', 'defense_events',
    'exercises', 'workouts', 'workout_sessions', 'workout_sets',
    'player_measurements', 'games', 'game_lineups', 'plate_appearances',
    'game_pitch_events', 'player_notes', 'development_goals', 'weekly_awards'
  ];
  expected_functions text[] := array[
    'public.set_updated_at()',
    'public.prevent_bootstrap_reopen()',
    'public.is_org_member(uuid)',
    'public.is_org_staff(uuid)',
    'public.is_org_admin(uuid)',
    'public.is_team_member(uuid)',
    'public.is_team_staff(uuid)',
    'public.is_team_admin(uuid)',
    'public.is_org_team_staff(uuid)',
    'public.is_season_staff(uuid)',
    'public.is_player_staff(uuid)',
    'public.is_practice_staff(uuid)',
    'public.is_session_staff(uuid)',
    'public.is_game_staff(uuid)',
    'public.is_workout_session_staff(uuid)',
    'public.bootstrap_metrolina_admin(uuid,text,text)',
    'public.current_profile_can_read_team(uuid)',
    'public.current_profile_can_manage_team(uuid)',
    'public.current_profile_can_admin_team(uuid)',
    'public.current_profile_can_access_org(uuid)',
    'public.current_profile_can_manage_org(uuid)',
    'public.player_matches_team_context(uuid,uuid,uuid)',
    'public.current_profile_can_read_player(uuid)'
  ];
  missing_tables text[];
  rls_disabled text[];
  missing_functions text[];
  foundation_applied boolean;
  secure_bootstrap_applied boolean;
  multi_team_applied boolean;
  roster_import_history_applied boolean;
  player_membership_rls_applied boolean;
  seeded_foundation boolean;
  seeded_team_views boolean;
  bootstrap_completed_at timestamptz;
  bootstrap_reopen_blocked boolean := false;
begin
  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260809000000'
  ) into foundation_applied;

  if not foundation_applied then
    raise exception 'Foundation migration 20260809000000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260809010000'
  ) into secure_bootstrap_applied;

  if not secure_bootstrap_applied then
    raise exception 'Secure bootstrap migration 20260809010000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810000000'
  ) into multi_team_applied;

  if not multi_team_applied then
    raise exception 'Multi-team membership migration 20260810000000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810010000'
  ) into roster_import_history_applied;

  if not roster_import_history_applied then
    raise exception 'Roster import history migration 20260810010000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810020000'
  ) into player_membership_rls_applied;

  if not player_membership_rls_applied then
    raise exception 'Player membership RLS recursion fix migration 20260810020000 is not applied.';
  end if;

  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(expected_tables) as table_name
  where to_regclass(format('public.%I', table_name)) is null;

  if coalesce(array_length(missing_tables, 1), 0) > 0 then
    raise exception 'Missing expected tables: %', missing_tables;
  end if;

  select array_agg(table_name order by table_name)
  into rls_disabled
  from unnest(expected_tables) as table_name
  join pg_class c on c.oid = to_regclass(format('public.%I', table_name))
  where c.relrowsecurity is not true;

  if coalesce(array_length(rls_disabled, 1), 0) > 0 then
    raise exception 'RLS is disabled on expected tables: %', rls_disabled;
  end if;

  select array_agg(signature order by signature)
  into missing_functions
  from unnest(expected_functions) as signature
  where to_regprocedure(signature) is null;

  if coalesce(array_length(missing_functions, 1), 0) > 0 then
    raise exception 'Missing expected helper/bootstrap functions: %', missing_functions;
  end if;

  select exists (
    select 1
    from public.organizations org
    join public.teams team on team.organization_id = org.id and team.name = 'Baseball'
    join public.seasons season on season.team_id = team.id and season.name = 'Fall 2026'
    where org.slug = 'metrolina-christian-academy'
  ) into seeded_foundation;

  if not seeded_foundation then
    raise exception 'Seeded Metrolina organization/team/season was not found.';
  end if;

  select exists (
    select 1
    from public.organizations org
    join public.teams varsity on varsity.organization_id = org.id and varsity.name = 'Metrolina Varsity'
    join public.seasons varsity_season on varsity_season.team_id = varsity.id and varsity_season.name = 'Fall 2026'
    join public.teams jv on jv.organization_id = org.id and jv.name = 'Metrolina JV'
    join public.seasons jv_season on jv_season.team_id = jv.id and jv_season.name = 'Fall 2026'
    where org.slug = 'metrolina-christian-academy'
  ) into seeded_team_views;

  if not seeded_team_views then
    raise exception 'Seeded Metrolina Varsity/JV Fall 2026 teams were not found.';
  end if;

  select org.bootstrap_completed_at
  into bootstrap_completed_at
  from public.organizations org
  where org.slug = 'metrolina-christian-academy';

  if bootstrap_completed_at is not null then
    begin
      update public.organizations
      set bootstrap_completed_at = null
      where slug = 'metrolina-christian-academy';
    exception
      when others then
        if sqlerrm = 'Organization bootstrap cannot be reopened.' then
          bootstrap_reopen_blocked := true;
        else
          raise;
        end if;
    end;

    if not bootstrap_reopen_blocked then
      raise exception 'bootstrap_completed_at was changed after completion.';
    end if;
  end if;
end $$;

select 'foundation migration applied' as check_name, 'pass' as result;
select 'secure bootstrap migration applied' as check_name, 'pass' as result;
select 'multi-team membership migration applied' as check_name, 'pass' as result;
select 'roster import history migration applied' as check_name, 'pass' as result;
select 'player membership RLS recursion fix migration applied' as check_name, 'pass' as result;
select 'expected tables exist' as check_name, count(*)::text as verified_count
from unnest(array[
  'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships', 'profile_team_memberships',
  'players', 'player_team_memberships', 'practices', 'practice_attendance',
  'roster_imports',
  'practice_sessions', 'pitch_events', 'hitting_events', 'defense_events',
  'exercises', 'workouts', 'workout_sessions', 'workout_sets',
  'player_measurements', 'games', 'game_lineups', 'plate_appearances',
  'game_pitch_events', 'player_notes', 'development_goals', 'weekly_awards'
]) as table_name;
select 'rls enabled on expected tables' as check_name, count(*)::text as verified_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = any(array[
    'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships', 'profile_team_memberships',
    'players', 'player_team_memberships', 'practices', 'practice_attendance',
    'roster_imports',
    'practice_sessions', 'pitch_events', 'hitting_events', 'defense_events',
    'exercises', 'workouts', 'workout_sessions', 'workout_sets',
    'player_measurements', 'games', 'game_lineups', 'plate_appearances',
    'game_pitch_events', 'player_notes', 'development_goals', 'weekly_awards'
  ])
  and c.relrowsecurity is true;
select 'bootstrap status' as check_name,
  case when bootstrap_completed_at is null then 'open' else 'closed' end as result,
  bootstrap_completed_at
from public.organizations
where slug = 'metrolina-christian-academy';
