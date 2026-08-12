\set ON_ERROR_STOP on
\pset pager off

\echo Remote Supabase structural verification

do $$
declare
  expected_tables text[] := array[
    'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships', 'profile_team_memberships',
    'profile_follows',
    'players', 'player_team_memberships', 'practices', 'practice_attendance',
    'roster_imports',
    'staff_members', 'staff_team_memberships', 'team_invitations', 'team_invitation_memberships',
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
    'public.current_profile_can_write_player_org(uuid)',
    'public.player_matches_team_context(uuid,uuid,uuid)',
    'public.current_profile_can_read_player(uuid)',
    'public.current_profile_can_admin_org(uuid)',
    'public.current_profile_can_view_staff_member(uuid)',
    'public.current_profile_can_admin_invitation(uuid)',
    'public.create_staff_invitation(text,text,text,text,text,text,timestamp with time zone,uuid[],uuid[])',
    'public.create_staff_invitation(text,text,text,text,text,text,timestamp with time zone,uuid[],uuid[],text)',
    'public.accept_staff_invitation(text)',
    'public.revoke_staff_invitation(uuid)',
    'public.refresh_staff_invitation(uuid,text,timestamp with time zone)'
  ];
  missing_tables text[];
  rls_disabled text[];
  missing_functions text[];
  foundation_applied boolean;
  secure_bootstrap_applied boolean;
  multi_team_applied boolean;
  roster_import_history_applied boolean;
  player_membership_rls_applied boolean;
  player_identity_write_rls_applied boolean;
  admin_membership_repair_applied boolean;
  staff_title_authorization_applied boolean;
  profile_role_team_authorization_applied boolean;
  staff_invitations_applied boolean;
  staff_invitation_acceptance_fix_applied boolean;
  staff_invitation_conflict_target_fix_applied boolean;
  seeded_foundation boolean;
  seeded_team_views boolean;
  admin_profiles_without_org_membership integer;
  admin_profiles_without_team_membership integer;
  program_admin_title_role_mismatches integer;
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

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810030000'
  ) into player_identity_write_rls_applied;

  if not player_identity_write_rls_applied then
    raise exception 'Player identity staff write RLS migration 20260810030000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810040000'
  ) into admin_membership_repair_applied;

  if not admin_membership_repair_applied then
    raise exception 'Metrolina admin membership repair migration 20260810040000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810050000'
  ) into staff_title_authorization_applied;

  if not staff_title_authorization_applied then
    raise exception 'Staff title authorization normalization migration 20260810050000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260810060000'
  ) into profile_role_team_authorization_applied;

  if not profile_role_team_authorization_applied then
    raise exception 'Profile role plus team membership authorization migration 20260810060000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260811000000'
  ) into staff_invitations_applied;

  if not staff_invitations_applied then
    raise exception 'Staff invitations migration 20260811000000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260811141000'
  ) into staff_invitation_acceptance_fix_applied;

  if not staff_invitation_acceptance_fix_applied then
    raise exception 'Staff invitation acceptance fix migration 20260811141000 is not applied.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260811145000'
  ) into staff_invitation_conflict_target_fix_applied;

  if not staff_invitation_conflict_target_fix_applied then
    raise exception 'Staff invitation acceptance conflict-target fix migration 20260811145000 is not applied.';
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
    join public.teams team on team.organization_id = org.id and team.name = 'Metrolina Varsity'
    join public.seasons season on season.team_id = team.id and season.name = 'Fall 2026'
    where org.slug = 'metrolina-christian-academy'
      and org.visibility = 'PUBLIC'
      and coalesce(nullif(org.city, ''), '') <> ''
      and coalesce(nullif(org.state, ''), '') <> ''
  ) into seeded_foundation;

  if not seeded_foundation then
    raise exception 'Seeded Metrolina organization/Varsity season identity was not found.';
  end if;

  select exists (
    select 1
    from public.organizations org
    join public.teams team on team.organization_id = org.id
    where org.slug = 'metrolina-christian-academy'
      and (
        lower(team.name) = 'baseball'
        or lower(coalesce(team.level, '')) = 'program'
        or lower(coalesce(team.team_type, '')) = 'program'
      )
  ) into seeded_foundation;

  if seeded_foundation then
    raise exception 'Legacy Metrolina Baseball Program pseudo-team still exists.';
  end if;

  select exists (
    select 1
    from public.organizations org
    join public.teams varsity on varsity.organization_id = org.id and varsity.name = 'Metrolina Varsity'
    join public.seasons varsity_season on varsity_season.team_id = varsity.id and varsity_season.name = 'Fall 2026'
    join public.teams jv on jv.organization_id = org.id and jv.name = 'Metrolina JV'
    join public.seasons jv_season on jv_season.team_id = jv.id and jv_season.name = 'Fall 2026'
    where org.slug = 'metrolina-christian-academy'
      and coalesce(nullif(varsity.city, ''), '') <> ''
      and coalesce(nullif(varsity.state, ''), '') <> ''
      and coalesce(nullif(jv.city, ''), '') <> ''
      and coalesce(nullif(jv.state, ''), '') <> ''
  ) into seeded_team_views;

  if not seeded_team_views then
    raise exception 'Seeded Metrolina Varsity/JV Fall 2026 teams or location identity were not found.';
  end if;

  select count(*)
  into admin_profiles_without_org_membership
  from public.profiles p
  join public.organizations org on org.slug = 'metrolina-christian-academy'
  left join public.organization_memberships om
    on om.organization_id = org.id
   and om.profile_id = p.id
   and om.active = true
   and om.role = 'ADMIN'
  where p.role = 'ADMIN'
    and om.id is null;

  if admin_profiles_without_org_membership <> 0 then
    raise exception 'Metrolina admin profiles missing organization membership: %', admin_profiles_without_org_membership;
  end if;

  select count(*)
  into admin_profiles_without_team_membership
  from public.profiles p
  join public.organizations org on org.slug = 'metrolina-christian-academy'
  where p.role = 'ADMIN'
    and not exists (
      select 1
      from public.profile_team_memberships ptm
      join public.teams team on team.id = ptm.team_id
      where ptm.profile_id = p.id
        and team.organization_id = org.id
        and ptm.active = true
        and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
    );

  if admin_profiles_without_team_membership <> 0 then
    raise exception 'Metrolina admin profiles missing staff team membership: %', admin_profiles_without_team_membership;
  end if;

  select count(*)
  into program_admin_title_role_mismatches
  from public.profile_team_memberships ptm
  join public.teams team on team.id = ptm.team_id
  join public.organizations org on org.id = team.organization_id
  where org.slug = 'metrolina-christian-academy'
    and ptm.active = true
    and upper(coalesce(ptm.title, '')) = 'PROGRAM ADMIN'
    and ptm.role <> 'ADMIN';

  if program_admin_title_role_mismatches <> 0 then
    raise exception 'Metrolina Program Admin memberships with non-admin role: %', program_admin_title_role_mismatches;
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
select 'player identity staff write RLS migration applied' as check_name, 'pass' as result;
select 'Metrolina admin membership repair migration applied' as check_name, 'pass' as result;
select 'staff title authorization normalization migration applied' as check_name, 'pass' as result;
select 'profile role plus team membership authorization migration applied' as check_name, 'pass' as result;
select 'staff invitations migration applied' as check_name, 'pass' as result;
select 'staff invitation acceptance fix migration applied' as check_name, 'pass' as result;
select 'staff invitation acceptance conflict-target fix migration applied' as check_name, 'pass' as result;
select 'expected tables exist' as check_name, count(*)::text as verified_count
from unnest(array[
  'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships', 'profile_team_memberships',
  'players', 'player_team_memberships', 'practices', 'practice_attendance',
  'roster_imports',
  'staff_members', 'staff_team_memberships', 'team_invitations', 'team_invitation_memberships',
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
    'staff_members', 'staff_team_memberships', 'team_invitations', 'team_invitation_memberships',
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
