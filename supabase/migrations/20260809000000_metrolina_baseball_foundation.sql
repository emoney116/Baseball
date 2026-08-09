create extension if not exists pgcrypto;

do $$ begin create type public.membership_role as enum ('ADMIN', 'COACH', 'PLAYER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.roster_status as enum ('Varsity', 'JV', 'Undecided', 'Cut'); exception when duplicate_object then null; end $$;
do $$ begin create type public.practice_status as enum ('scheduled', 'active', 'completed', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.practice_session_category as enum ('hitting', 'pitching', 'defense'); exception when duplicate_object then null; end $$;
do $$ begin create type public.game_status as enum ('scheduled', 'active', 'final', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.home_away as enum ('Home', 'Away'); exception when duplicate_object then null; end $$;
do $$ begin create type public.note_visibility as enum ('coach_only', 'player_visible'); exception when duplicate_object then null; end $$;
do $$ begin create type public.award_type as enum ('PLAYER_OF_WEEK', 'WEIGHT_ROOM_LEADER'); exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_bootstrap_reopen()
returns trigger
language plpgsql
as $$
begin
  if old.bootstrap_completed_at is not null
    and new.bootstrap_completed_at is distinct from old.bootstrap_completed_at then
    raise exception 'Organization bootstrap cannot be reopened.';
  end if;

  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  bootstrap_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  level text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);
create index if not exists teams_organization_id_idx on public.teams(organization_id);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, name)
);
create index if not exists seasons_team_id_idx on public.seasons(team_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.membership_role not null default 'COACH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, profile_id)
);
create index if not exists organization_memberships_profile_id_idx on public.organization_memberships(profile_id);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  jersey_number integer,
  graduation_year integer,
  primary_position text not null,
  secondary_position text,
  bats text not null,
  throws text not null,
  height text,
  weight integer,
  is_pitcher boolean not null default false,
  is_hitter boolean not null default true,
  photo_url text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_organization_id_idx on public.players(organization_id);

create table if not exists public.player_team_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  roster_status public.roster_status not null default 'Undecided',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, team_id, season_id)
);
create index if not exists player_team_memberships_team_id_idx on public.player_team_memberships(team_id);
create index if not exists player_team_memberships_season_id_idx on public.player_team_memberships(season_id);

create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  practice_date date not null,
  starts_at timestamptz,
  ended_at timestamptz,
  name text not null,
  practice_type text not null,
  location text,
  notes text,
  status public.practice_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists practices_season_id_idx on public.practices(season_id);

create table if not exists public.practice_attendance (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null,
  checked_in_at timestamptz not null default now(),
  unique(practice_id, player_id)
);
create index if not exists practice_attendance_player_id_idx on public.practice_attendance(player_id);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  category public.practice_session_category not null,
  session_type text not null,
  secondary_player_id uuid references public.players(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary_note text,
  session_grade text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists practice_sessions_practice_id_idx on public.practice_sessions(practice_id);
create index if not exists practice_sessions_player_id_idx on public.practice_sessions(player_id);

create table if not exists public.pitch_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  pitcher_id uuid not null references public.players(id) on delete cascade,
  hitter_id uuid references public.players(id) on delete set null,
  plate_appearance_id uuid,
  pitch_number integer not null,
  pitch_type text not null,
  outcome text not null,
  velocity numeric,
  is_strike boolean not null default false,
  is_swing boolean not null default false,
  is_zone boolean not null default false,
  is_chase boolean,
  is_whiff boolean,
  is_called_strike boolean,
  is_ball_in_play boolean,
  batted_ball text,
  contact_quality text,
  quality_rating integer,
  missed_intended_location boolean,
  intended_target jsonb,
  location jsonb,
  count_before jsonb,
  count_after jsonb,
  mechanical_note text,
  coach_note text,
  context text not null default 'practice',
  created_at timestamptz not null default now()
);
create index if not exists pitch_events_session_id_idx on public.pitch_events(session_id);
create index if not exists pitch_events_pitcher_id_idx on public.pitch_events(pitcher_id);

create table if not exists public.hitting_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  hitter_id uuid not null references public.players(id) on delete cascade,
  pitcher_id uuid references public.players(id) on delete set null,
  plate_appearance_id uuid,
  event_number integer not null,
  action text not null,
  contact_result text,
  contact_quality text,
  direction text,
  field_location jsonb,
  pitch_type text,
  velocity numeric,
  is_live_bp boolean not null default false,
  context text not null default 'practice',
  created_at timestamptz not null default now()
);
create index if not exists hitting_events_session_id_idx on public.hitting_events(session_id);
create index if not exists hitting_events_hitter_id_idx on public.hitting_events(hitter_id);

create table if not exists public.defense_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  station text not null,
  event_number integer not null,
  outcome text not null,
  throw_quality text,
  footwork text,
  decision text,
  range text,
  error_type text,
  coach_note text,
  created_at timestamptz not null default now()
);
create index if not exists defense_events_session_id_idx on public.defense_events(session_id);
create index if not exists defense_events_player_id_idx on public.defense_events(player_id);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null,
  unit text,
  built_in boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workouts_organization_id_idx on public.workouts(organization_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  player_id uuid not null references public.players(id) on delete cascade,
  session_date date not null,
  week_of date,
  day_name text,
  completed boolean not null default false,
  effort_score integer,
  body_weight numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, session_date)
);
create index if not exists workout_sessions_player_id_idx on public.workout_sessions(player_id);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number integer,
  weight numeric,
  reps integer,
  sets integer,
  value numeric,
  unit text,
  rpe numeric,
  prior_value numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workout_sets_session_id_idx on public.workout_sets(workout_session_id);
create index if not exists workout_sets_player_id_idx on public.workout_sets(player_id);

create table if not exists public.player_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  measured_at timestamptz not null default now(),
  metric_type text not null,
  value numeric not null,
  unit text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists player_measurements_player_id_idx on public.player_measurements(player_id);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  opponent text not null,
  starts_at timestamptz,
  game_date date not null,
  home_away public.home_away not null,
  location text,
  game_type text not null,
  status public.game_status not null default 'scheduled',
  our_score integer not null default 0,
  opponent_score integer not null default 0,
  inning integer not null default 1,
  half text not null default 'Top',
  outs integer not null default 0,
  balls integer not null default 0,
  strikes integer not null default 0,
  runners jsonb not null default '{}'::jsonb,
  result text,
  current_pitcher_id uuid references public.players(id) on delete set null,
  current_batter_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_season_id_idx on public.games(season_id);

create table if not exists public.game_lineups (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  batting_order integer,
  position text,
  is_starting_pitcher boolean not null default false,
  primary key(game_id, player_id)
);

create table if not exists public.plate_appearances (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  practice_id uuid references public.practices(id) on delete cascade,
  pitcher_id uuid not null references public.players(id) on delete cascade,
  hitter_id uuid not null references public.players(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome text,
  balls integer not null default 0,
  strikes integer not null default 0,
  context text not null default 'live_bp'
);

create table if not exists public.game_pitch_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  inning integer not null,
  half text not null,
  pitcher_id uuid references public.players(id) on delete set null,
  batter_id uuid references public.players(id) on delete set null,
  pitch_type text,
  pitch_outcome text,
  ball_in_play_outcome text,
  velocity numeric,
  location jsonb,
  outs_before integer not null,
  outs_after integer not null,
  our_runs_before integer not null,
  our_runs_after integer not null,
  opponent_runs_before integer not null,
  opponent_runs_after integer not null,
  situations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists game_pitch_events_game_id_idx on public.game_pitch_events(game_id);

create table if not exists public.player_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  practice_id uuid references public.practices(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  visibility public.note_visibility not null default 'coach_only',
  tags jsonb not null default '[]'::jsonb,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.development_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  title text not null,
  tags jsonb not null default '[]'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  award_type public.award_type not null,
  week_start date not null,
  week_end date not null,
  score numeric,
  summary text,
  manual_override boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(season_id, player_id, award_type, week_start)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships',
    'players', 'player_team_memberships', 'practices', 'practice_attendance',
    'practice_sessions', 'pitch_events', 'hitting_events', 'defense_events',
    'exercises', 'workouts', 'workout_sessions', 'workout_sets',
    'player_measurements', 'games', 'game_lineups', 'plate_appearances',
    'game_pitch_events', 'player_notes', 'development_goals', 'weekly_awards'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_org_id
      and om.profile_id = auth.uid()
      and om.active = true
  );
$$;

create or replace function public.is_org_staff(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_org_id
      and om.profile_id = auth.uid()
      and om.active = true
      and om.role in ('ADMIN', 'COACH')
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_org_id
      and om.profile_id = auth.uid()
      and om.active = true
      and om.role = 'ADMIN'
  );
$$;

create or replace function public.is_team_staff(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and public.is_org_staff(t.organization_id)
  );
$$;

create or replace function public.is_season_staff(target_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.seasons s
    where s.id = target_season_id
      and public.is_org_staff(s.organization_id)
  );
$$;

create or replace function public.is_player_staff(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and public.is_org_staff(p.organization_id)
  );
$$;

create or replace function public.is_practice_staff(target_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.practices p
    where p.id = target_practice_id
      and public.is_org_staff(p.organization_id)
  );
$$;

create or replace function public.is_session_staff(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.practice_sessions ps
    join public.practices p on p.id = ps.practice_id
    where ps.id = target_session_id
      and public.is_org_staff(p.organization_id)
  );
$$;

create or replace function public.is_game_staff(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games g
    where g.id = target_game_id
      and public.is_org_staff(g.organization_id)
  );
$$;

create or replace function public.is_workout_session_staff(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_sessions ws
    where ws.id = target_session_id
      and public.is_org_staff(ws.organization_id)
  );
$$;

create or replace function public.bootstrap_metrolina_admin(
  target_profile_id uuid,
  target_email text,
  target_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
  bootstrap_completed timestamptz;
begin
  if target_profile_id is null then
    raise exception 'A profile id is required.';
  end if;

  if nullif(trim(target_email), '') is null then
    raise exception 'An email address is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('metrolina-initial-admin-bootstrap'));

  select id, bootstrap_completed_at into target_org_id, bootstrap_completed
  from public.organizations
  where slug = 'metrolina-christian-academy'
  for update;

  if target_org_id is null then
    raise exception 'Metrolina organization seed is missing.';
  end if;

  if bootstrap_completed is not null then
    raise exception 'Initial admin bootstrap is already closed.';
  end if;

  if exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org_id
      and active = true
      and role = 'ADMIN'
  ) then
    raise exception 'Initial admin bootstrap is already closed.';
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (target_profile_id, lower(trim(target_email)), coalesce(nullif(trim(target_display_name), ''), lower(trim(target_email))), 'ADMIN')
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        role = 'ADMIN',
        updated_at = now();

  insert into public.organization_memberships (organization_id, profile_id, role, active)
  values (target_org_id, target_profile_id, 'ADMIN', true)
  on conflict (organization_id, profile_id) do update
    set role = 'ADMIN',
        active = true,
        updated_at = now();

  update public.organizations
  set bootstrap_completed_at = now(),
      updated_at = now()
  where id = target_org_id;

  return target_org_id;
end;
$$;

revoke all on function public.bootstrap_metrolina_admin(uuid, text, text) from public;
grant execute on function public.bootstrap_metrolina_admin(uuid, text, text) to service_role;

do $$
declare
  trigger_table text;
begin
  foreach trigger_table in array array[
    'organizations', 'teams', 'seasons', 'profiles', 'organization_memberships',
    'players', 'player_team_memberships', 'practices', 'exercises', 'workouts',
    'workout_sessions', 'games', 'player_notes', 'development_goals'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || trigger_table || '_updated_at', trigger_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || trigger_table || '_updated_at',
      trigger_table,
      trigger_table
    );
  end loop;
end $$;

drop trigger if exists prevent_organizations_bootstrap_reopen on public.organizations;
create trigger prevent_organizations_bootstrap_reopen
  before update on public.organizations
  for each row
  execute function public.prevent_bootstrap_reopen();

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname like 'metrolina_%'
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy metrolina_profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships mine
      join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
      where mine.profile_id = auth.uid()
        and mine.active = true
        and mine.role in ('ADMIN', 'COACH')
        and theirs.profile_id = profiles.id
        and theirs.active = true
    )
  );
create policy metrolina_profiles_upsert_own on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy metrolina_organizations_staff on public.organizations
  for all to authenticated
  using (public.is_org_staff(id))
  with check (public.is_org_staff(id));

create policy metrolina_memberships_select on public.organization_memberships
  for select to authenticated
  using (profile_id = auth.uid() or public.is_org_staff(organization_id));
create policy metrolina_memberships_admin_write on public.organization_memberships
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy metrolina_teams_staff on public.teams
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_seasons_staff on public.seasons
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_players_staff on public.players
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_player_memberships_staff on public.player_team_memberships
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id));

create policy metrolina_practices_staff on public.practices
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_practice_attendance_staff on public.practice_attendance
  for all to authenticated
  using (public.is_practice_staff(practice_id))
  with check (public.is_practice_staff(practice_id));

create policy metrolina_practice_sessions_staff on public.practice_sessions
  for all to authenticated
  using (public.is_practice_staff(practice_id))
  with check (public.is_practice_staff(practice_id) and public.is_player_staff(player_id));

create policy metrolina_pitch_events_staff on public.pitch_events
  for all to authenticated
  using (public.is_player_staff(pitcher_id))
  with check (public.is_player_staff(pitcher_id));

create policy metrolina_hitting_events_staff on public.hitting_events
  for all to authenticated
  using (public.is_player_staff(hitter_id))
  with check (public.is_player_staff(hitter_id));

create policy metrolina_defense_events_staff on public.defense_events
  for all to authenticated
  using (public.is_player_staff(player_id))
  with check (public.is_player_staff(player_id));

create policy metrolina_exercises_staff on public.exercises
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_workouts_staff on public.workouts
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_workout_sessions_staff on public.workout_sessions
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id) and public.is_player_staff(player_id));

create policy metrolina_workout_sets_staff on public.workout_sets
  for all to authenticated
  using (public.is_workout_session_staff(workout_session_id))
  with check (public.is_workout_session_staff(workout_session_id) and public.is_player_staff(player_id));

create policy metrolina_player_measurements_staff on public.player_measurements
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id) and public.is_player_staff(player_id));

create policy metrolina_games_staff on public.games
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_game_lineups_staff on public.game_lineups
  for all to authenticated
  using (public.is_game_staff(game_id))
  with check (public.is_game_staff(game_id) and public.is_player_staff(player_id));

create policy metrolina_plate_appearances_staff on public.plate_appearances
  for all to authenticated
  using (
    public.is_player_staff(pitcher_id)
    or public.is_player_staff(hitter_id)
    or (game_id is not null and public.is_game_staff(game_id))
    or (practice_id is not null and public.is_practice_staff(practice_id))
  )
  with check (
    public.is_player_staff(pitcher_id)
    and public.is_player_staff(hitter_id)
  );

create policy metrolina_game_pitch_events_staff on public.game_pitch_events
  for all to authenticated
  using (public.is_game_staff(game_id))
  with check (public.is_game_staff(game_id));

create policy metrolina_player_notes_staff on public.player_notes
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id));

create policy metrolina_development_goals_staff on public.development_goals
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id) and public.is_player_staff(player_id));

create policy metrolina_weekly_awards_staff on public.weekly_awards
  for all to authenticated
  using (public.is_org_staff(organization_id))
  with check (public.is_org_staff(organization_id) and public.is_player_staff(player_id));

with org as (
  insert into public.organizations (name, slug)
  values ('Metrolina Christian Academy', 'metrolina-christian-academy')
  on conflict (slug) do update set name = excluded.name, updated_at = now()
  returning id
),
team as (
  insert into public.teams (organization_id, name, level)
  select id, 'Baseball', 'Program' from org
  on conflict (organization_id, name) do update set level = excluded.level, active = true, updated_at = now()
  returning id, organization_id
),
selected_team as (
  select t.id, t.organization_id
  from public.teams t
  join org on org.id = t.organization_id
  where t.name = 'Baseball'
  limit 1
)
insert into public.seasons (organization_id, team_id, name, starts_on, ends_on, active)
select organization_id, id, 'Fall 2026', '2026-08-01'::date, '2026-11-30'::date, true
from selected_team
on conflict (team_id, name) do update
  set starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      active = true,
      updated_at = now();

insert into public.exercises (organization_id, name, kind, unit, built_in)
select org.id, exercise.name, exercise.kind, exercise.unit, true
from public.organizations org
cross join (
  values
    ('Back Squat', 'Lift', 'lb'),
    ('Front Squat', 'Lift', 'lb'),
    ('Bench Press', 'Lift', 'lb'),
    ('Incline Bench', 'Lift', 'lb'),
    ('Deadlift', 'Lift', 'lb'),
    ('Trap Bar Deadlift', 'Lift', 'lb'),
    ('Power Clean', 'Lift', 'lb'),
    ('Hang Clean', 'Lift', 'lb'),
    ('Push Press', 'Lift', 'lb'),
    ('Pull Ups', 'Lift', 'reps'),
    ('DB Bench', 'Lift', 'lb'),
    ('Bulgarian Split Squat', 'Lift', 'lb'),
    ('Sprint', 'Speed', 'sec'),
    ('Broad Jump', 'Jump', 'in'),
    ('Vertical Jump', 'Jump', 'in')
) as exercise(name, kind, unit)
where org.slug = 'metrolina-christian-academy'
on conflict (organization_id, name) do update
  set kind = excluded.kind,
      unit = excluded.unit,
      built_in = true,
      active = true,
      updated_at = now();
