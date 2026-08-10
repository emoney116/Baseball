\set ON_ERROR_STOP on
\pset pager off

\echo Remote Supabase write/read smoke verification

do $$
declare
  v_marker text := __SMOKE_MARKER_SQL_LITERAL__;
  v_now_value timestamptz := now();
  v_org_id uuid;
  v_team_id uuid;
  v_season_id uuid;
  v_exercise_id uuid;
  v_player_id uuid := gen_random_uuid();
  v_practice_id uuid := gen_random_uuid();
  v_attendance_id uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_hitting_event_id uuid := gen_random_uuid();
  v_workout_session_id uuid := gen_random_uuid();
  v_workout_set_id uuid := gen_random_uuid();
  v_game_id uuid := gen_random_uuid();
  v_roster_import_id uuid := gen_random_uuid();
begin
  select org.id, team.id, season.id
  into v_org_id, v_team_id, v_season_id
  from public.organizations org
  join public.teams team on team.organization_id = org.id and team.name = 'Baseball'
  join public.seasons season on season.team_id = team.id and season.name = 'Fall 2026'
  where org.slug = 'metrolina-christian-academy';

  if v_org_id is null or v_team_id is null or v_season_id is null then
    raise exception 'Metrolina seed foundation is missing.';
  end if;

  select id into v_exercise_id
  from public.exercises
  where organization_id = v_org_id and name = 'Back Squat';

  if v_exercise_id is null then
    raise exception 'Back Squat seed exercise is missing.';
  end if;

  insert into public.players (
    id, organization_id, first_name, last_name, jersey_number, graduation_year,
    primary_position, secondary_position, bats, throws, height, weight,
    is_pitcher, is_hitter, metadata, created_at, updated_at
  )
  values (
    v_player_id, v_org_id, 'Codex', v_marker, 99, 2027,
    'SS', 'RHP', 'R', 'R', '6-0', 180,
    true, true, jsonb_build_object('remoteVerification', v_marker), v_now_value, v_now_value
  );

  insert into public.player_team_memberships (player_id, team_id, season_id, roster_status, jersey_number)
  values (v_player_id, v_team_id, v_season_id, 'Undecided', 99);

  insert into public.roster_imports (
    id, organization_id, team_id, season_id, file_names, teams, modes,
    rows_processed, players_created, players_updated, memberships_added,
    memberships_updated, memberships_removed, rows_skipped, summary,
    created_at, updated_at
  )
  values (
    v_roster_import_id, v_org_id, v_team_id, v_season_id,
    jsonb_build_array(v_marker || '.csv'), jsonb_build_array('Baseball'), jsonb_build_array('add'),
    1, 1, 0, 1, 0, 0, 0,
    jsonb_build_object('remoteVerification', v_marker),
    v_now_value, v_now_value
  );

  update public.player_team_memberships
  set roster_status = 'Varsity'
  where player_id = v_player_id and team_id = v_team_id and season_id = v_season_id;

  insert into public.practices (
    id, organization_id, team_id, season_id, practice_date, starts_at,
    name, practice_type, location, notes, status, created_at, updated_at
  )
  values (
    v_practice_id, v_org_id, v_team_id, v_season_id, current_date, v_now_value,
    v_marker || ' Practice', 'Full Practice', 'Remote Verification',
    'Created by automated remote Supabase smoke verification.', 'active', v_now_value, v_now_value
  );

  insert into public.practice_attendance (id, practice_id, player_id, role, checked_in_at)
  values (v_attendance_id, v_practice_id, v_player_id, 'Two-way', v_now_value);

  insert into public.practice_sessions (
    id, practice_id, player_id, category, session_type, started_at, metadata
  )
  values (v_session_id, v_practice_id, v_player_id, 'hitting', 'Machine', v_now_value, jsonb_build_object('remoteVerification', v_marker));

  insert into public.hitting_events (
    id, practice_id, session_id, hitter_id, event_number, action, contact_result,
    contact_quality, direction, is_live_bp, context, created_at
  )
  values (
    v_hitting_event_id, v_practice_id, v_session_id, v_player_id, 1, 'Ball in play',
    'Line drive', 'Barrel', 'Middle', false, 'practice', v_now_value
  );

  insert into public.workout_sessions (
    id, organization_id, team_id, season_id, player_id, session_date, week_of,
    day_name, completed, effort_score, body_weight, created_at, updated_at
  )
  values (
    v_workout_session_id, v_org_id, v_team_id, v_season_id, v_player_id, current_date, current_date,
    'Mon', true, 8, 180, v_now_value, v_now_value
  );

  insert into public.workout_sets (
    id, workout_session_id, player_id, exercise_id, weight, reps, sets, prior_value, created_at
  )
  values (v_workout_set_id, v_workout_session_id, v_player_id, v_exercise_id, 225, 5, 3, 205, v_now_value);

  insert into public.games (
    id, organization_id, team_id, season_id, opponent, game_date, starts_at,
    home_away, location, game_type, status, our_score, opponent_score,
    current_pitcher_id, current_batter_id, created_at, updated_at
  )
  values (
    v_game_id, v_org_id, v_team_id, v_season_id, v_marker || ' Opponent', current_date, v_now_value,
    'Home', 'Remote Verification', 'Scrimmage', 'active', 0, 0,
    v_player_id, v_player_id, v_now_value, v_now_value
  );

  perform 1
  from public.players p
  join public.player_team_memberships ptm on ptm.player_id = p.id and ptm.roster_status = 'Varsity' and ptm.jersey_number = 99
  join public.practices pr on pr.id = v_practice_id
  join public.practice_attendance pa on pa.practice_id = pr.id and pa.player_id = p.id
  join public.practice_sessions ps on ps.id = v_session_id and ps.player_id = p.id
  join public.hitting_events he on he.id = v_hitting_event_id and he.hitter_id = p.id
  join public.workout_sessions ws on ws.id = v_workout_session_id and ws.player_id = p.id
  join public.workout_sets wset on wset.id = v_workout_set_id and wset.player_id = p.id
  join public.games g on g.id = v_game_id and g.current_batter_id = p.id
  join public.roster_imports ri on ri.id = v_roster_import_id and ri.summary ->> 'remoteVerification' = v_marker
  where p.id = v_player_id
    and p.metadata ->> 'remoteVerification' = v_marker;

  if not found then
    raise exception 'Remote persistence smoke readback failed for marker %.', v_marker;
  end if;

  delete from public.games where id = v_game_id;
  delete from public.roster_imports where id = v_roster_import_id;
  delete from public.workout_sets where id = v_workout_set_id;
  delete from public.workout_sessions where id = v_workout_session_id;
  delete from public.hitting_events where id = v_hitting_event_id;
  delete from public.practice_sessions where id = v_session_id;
  delete from public.practice_attendance where id = v_attendance_id;
  delete from public.practices where id = v_practice_id;
  delete from public.player_team_memberships where player_id = v_player_id;
  delete from public.players where id = v_player_id;
end $$;

select 'remote write/read smoke test' as check_name, 'pass' as result, __SMOKE_MARKER_SQL_LITERAL__ as marker;
