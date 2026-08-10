begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text,
  add column if not exists preferred_team_id uuid references public.teams(id) on delete set null;

update public.profiles
set
  first_name = coalesce(first_name, nullif(split_part(coalesce(display_name, email, ''), ' ', 1), '')),
  last_name = coalesce(last_name, nullif(trim(substr(coalesce(display_name, email, ''), length(split_part(coalesce(display_name, email, ''), ' ', 1)) + 1)), ''))
where first_name is null
   or last_name is null;

create table if not exists public.profile_team_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  role text not null default 'STAFF'
    check (role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH', 'PLAYER')),
  title text,
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_team_memberships_profile_team_season_key
  on public.profile_team_memberships(profile_id, team_id, season_id)
  where season_id is not null;

create unique index if not exists profile_team_memberships_profile_team_no_season_key
  on public.profile_team_memberships(profile_id, team_id)
  where season_id is null;

create index if not exists profile_team_memberships_profile_id_idx
  on public.profile_team_memberships(profile_id);
create index if not exists profile_team_memberships_team_id_idx
  on public.profile_team_memberships(team_id);
create index if not exists profile_team_memberships_season_id_idx
  on public.profile_team_memberships(season_id);

alter table public.profile_team_memberships enable row level security;

alter table public.player_team_memberships
  add column if not exists jersey_number integer,
  add column if not exists roster_role text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.player_team_memberships ptm
set jersey_number = coalesce(ptm.jersey_number, p.jersey_number)
from public.players p
where p.id = ptm.player_id
  and ptm.jersey_number is null;

alter table public.player_notes
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

alter table public.development_goals
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

update public.player_notes note
set team_id = coalesce(note.team_id, practice.team_id),
    season_id = coalesce(note.season_id, practice.season_id)
from public.practices practice
where note.practice_id = practice.id
  and (note.team_id is null or note.season_id is null);

with org as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
seed_teams as (
  insert into public.teams (organization_id, name, level, active)
  select org.id, team_name, team_level, true
  from org
  cross join (
    values
      ('Metrolina Varsity', 'Varsity'),
      ('Metrolina JV', 'JV')
  ) as seed(team_name, team_level)
  on conflict (organization_id, name) do update
    set level = excluded.level,
        active = true,
        updated_at = now()
  returning id, organization_id
),
all_seed_teams as (
  select id, organization_id from seed_teams
  union
  select teams.id, teams.organization_id
  from public.teams
  join org on org.id = teams.organization_id
  where teams.name in ('Baseball', 'Metrolina Varsity', 'Metrolina JV')
)
insert into public.seasons (organization_id, team_id, name, starts_on, ends_on, active)
select organization_id, id, 'Fall 2026', '2026-08-01'::date, '2026-11-30'::date, true
from all_seed_teams
on conflict (team_id, name) do update
  set starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      active = true,
      updated_at = now();

with org_members as (
  select om.profile_id,
         om.role,
         om.active,
         t.id as team_id,
         s.id as season_id
  from public.organization_memberships om
  join public.teams t on t.organization_id = om.organization_id and t.active = true
  left join public.seasons s on s.team_id = t.id and s.active = true and s.name = 'Fall 2026'
  join public.organizations org on org.id = om.organization_id
  where org.slug = 'metrolina-christian-academy'
    and om.active = true
)
insert into public.profile_team_memberships (profile_id, team_id, season_id, role, title, active)
select
  profile_id,
  team_id,
  season_id,
  case
    when role = 'ADMIN' then 'ADMIN'
    when role = 'COACH' then 'HEAD_COACH'
    else 'PLAYER'
  end,
  case
    when role = 'ADMIN' then 'Program Admin'
    when role = 'COACH' then 'Coach'
    else 'Player'
  end,
  active
from org_members
on conflict (profile_id, team_id, season_id) where season_id is not null do update
  set role = excluded.role,
      title = excluded.title,
      active = excluded.active,
      updated_at = now();

with org_members_no_season as (
  select om.profile_id,
         om.role,
         om.active,
         t.id as team_id
  from public.organization_memberships om
  join public.teams t on t.organization_id = om.organization_id and t.active = true
  join public.organizations org on org.id = om.organization_id
  where org.slug = 'metrolina-christian-academy'
    and om.active = true
    and not exists (
      select 1 from public.seasons s where s.team_id = t.id and s.active = true
    )
)
insert into public.profile_team_memberships (profile_id, team_id, role, title, active)
select
  profile_id,
  team_id,
  case
    when role = 'ADMIN' then 'ADMIN'
    when role = 'COACH' then 'HEAD_COACH'
    else 'PLAYER'
  end,
  case
    when role = 'ADMIN' then 'Program Admin'
    when role = 'COACH' then 'Coach'
    else 'Player'
  end,
  active
from org_members_no_season
on conflict (profile_id, team_id) where season_id is null do update
  set role = excluded.role,
      title = excluded.title,
      active = excluded.active,
      updated_at = now();

with existing_baseball as (
  select
    ptm.player_id,
    varsity.id as varsity_team_id,
    varsity_season.id as varsity_season_id,
    ptm.roster_status,
    coalesce(ptm.jersey_number, p.jersey_number) as jersey_number,
    ptm.active
  from public.player_team_memberships ptm
  join public.players p on p.id = ptm.player_id
  join public.teams baseball on baseball.id = ptm.team_id and baseball.name = 'Baseball'
  join public.teams varsity on varsity.organization_id = baseball.organization_id and varsity.name = 'Metrolina Varsity'
  join public.seasons varsity_season on varsity_season.team_id = varsity.id and varsity_season.name = 'Fall 2026'
)
insert into public.player_team_memberships (player_id, team_id, season_id, roster_status, jersey_number, active)
select player_id, varsity_team_id, varsity_season_id, roster_status, jersey_number, active
from existing_baseball
on conflict (player_id, team_id, season_id) do update
  set roster_status = excluded.roster_status,
      jersey_number = coalesce(public.player_team_memberships.jersey_number, excluded.jersey_number),
      active = excluded.active,
      updated_at = now();

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_team_memberships ptm
    where ptm.team_id = target_team_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
  )
  or exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and public.is_org_admin(t.organization_id)
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
    from public.profile_team_memberships ptm
    where ptm.team_id = target_team_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
  )
  or exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and public.is_org_admin(t.organization_id)
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_team_memberships ptm
    where ptm.team_id = target_team_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH')
  )
  or exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and public.is_org_admin(t.organization_id)
  );
$$;

create or replace function public.is_org_team_staff(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_staff(target_org_id)
  or exists (
    select 1
    from public.profile_team_memberships ptm
    join public.teams t on t.id = ptm.team_id
    where t.organization_id = target_org_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
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
      and public.is_team_staff(s.team_id)
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
    from public.player_team_memberships ptm
    where ptm.player_id = target_player_id
      and ptm.active = true
      and public.is_team_staff(ptm.team_id)
  )
  or exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and public.is_org_admin(p.organization_id)
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
      and public.is_team_staff(p.team_id)
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
      and public.is_team_staff(p.team_id)
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
      and public.is_team_staff(g.team_id)
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
      and public.is_team_staff(ws.team_id)
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
  split_first_name text;
  split_last_name text;
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

  split_first_name := nullif(split_part(coalesce(target_display_name, target_email), ' ', 1), '');
  split_last_name := nullif(trim(substr(coalesce(target_display_name, target_email), length(split_part(coalesce(target_display_name, target_email), ' ', 1)) + 1)), '');

  insert into public.profiles (id, email, display_name, first_name, last_name, role)
  values (
    target_profile_id,
    lower(trim(target_email)),
    coalesce(nullif(trim(target_display_name), ''), lower(trim(target_email))),
    split_first_name,
    split_last_name,
    'ADMIN'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        first_name = coalesce(public.profiles.first_name, excluded.first_name),
        last_name = coalesce(public.profiles.last_name, excluded.last_name),
        role = 'ADMIN',
        updated_at = now();

  insert into public.organization_memberships (organization_id, profile_id, role, active)
  values (target_org_id, target_profile_id, 'ADMIN', true)
  on conflict (organization_id, profile_id) do update
    set role = 'ADMIN',
        active = true,
        updated_at = now();

  insert into public.profile_team_memberships (profile_id, team_id, season_id, role, title, active)
  select target_profile_id, t.id, s.id, 'ADMIN', 'Program Admin', true
  from public.teams t
  left join public.seasons s on s.team_id = t.id and s.active = true
  where t.organization_id = target_org_id
    and t.active = true
  on conflict (profile_id, team_id, season_id) where season_id is not null do update
    set role = 'ADMIN',
        title = 'Program Admin',
        active = true,
        updated_at = now();

  update public.organizations
  set bootstrap_completed_at = now(),
      updated_at = now()
  where id = target_org_id;

  return target_org_id;
end;
$$;

do $$
declare
  trigger_table text;
begin
  foreach trigger_table in array array[
    'profiles', 'profile_team_memberships', 'player_team_memberships', 'player_notes', 'development_goals'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || trigger_table || '_updated_at', trigger_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || trigger_table || '_updated_at',
      trigger_table
    );
  end loop;
end $$;

drop policy if exists metrolina_profiles_select on public.profiles;
create policy metrolina_profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.profile_team_memberships mine
      join public.profile_team_memberships theirs on theirs.team_id = mine.team_id
      where mine.profile_id = auth.uid()
        and mine.active = true
        and mine.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
        and theirs.profile_id = profiles.id
        and theirs.active = true
    )
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

drop policy if exists metrolina_organizations_staff on public.organizations;
create policy metrolina_organizations_select_member on public.organizations
  for select to authenticated
  using (
    public.is_org_member(id)
    or exists (
      select 1
      from public.profile_team_memberships ptm
      join public.teams t on t.id = ptm.team_id
      where t.organization_id = organizations.id
        and ptm.profile_id = auth.uid()
        and ptm.active = true
    )
  );
create policy metrolina_organizations_admin_write on public.organizations
  for all to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop policy if exists metrolina_teams_staff on public.teams;
create policy metrolina_teams_select_member on public.teams
  for select to authenticated
  using (public.is_team_member(id) or public.is_org_staff(organization_id));
create policy metrolina_teams_admin_write on public.teams
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists metrolina_seasons_staff on public.seasons;
create policy metrolina_seasons_select_member on public.seasons
  for select to authenticated
  using (public.is_team_member(team_id) or public.is_org_staff(organization_id));
create policy metrolina_seasons_admin_write on public.seasons
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy metrolina_profile_team_memberships_select on public.profile_team_memberships
  for select to authenticated
  using (profile_id = auth.uid() or public.is_team_staff(team_id));
create policy metrolina_profile_team_memberships_admin_write on public.profile_team_memberships
  for all to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

drop policy if exists metrolina_players_staff on public.players;
create policy metrolina_players_select_team on public.players
  for select to authenticated
  using (
    public.is_org_staff(organization_id)
    or exists (
      select 1
      from public.player_team_memberships ptm
      where ptm.player_id = players.id
        and ptm.active = true
        and public.is_team_member(ptm.team_id)
    )
  );
create policy metrolina_players_staff_write on public.players
  for all to authenticated
  using (public.is_org_team_staff(organization_id) or public.is_org_admin(organization_id))
  with check (public.is_org_team_staff(organization_id) or public.is_org_admin(organization_id));

drop policy if exists metrolina_player_memberships_staff on public.player_team_memberships;
create policy metrolina_player_memberships_select_team on public.player_team_memberships
  for select to authenticated
  using (public.is_team_member(team_id) or public.is_player_staff(player_id));
create policy metrolina_player_memberships_staff_write on public.player_team_memberships
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (
    public.is_team_staff(team_id)
    and exists (
      select 1
      from public.players p
      join public.teams t on t.id = player_team_memberships.team_id
      where p.id = player_team_memberships.player_id
        and p.organization_id = t.organization_id
    )
  );

drop policy if exists metrolina_practices_staff on public.practices;
create policy metrolina_practices_staff on public.practices
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id));

drop policy if exists metrolina_exercises_staff on public.exercises;
create policy metrolina_exercises_select_member on public.exercises
  for select to authenticated
  using (public.is_org_team_staff(organization_id));
create policy metrolina_exercises_staff_write on public.exercises
  for all to authenticated
  using (public.is_org_team_staff(organization_id))
  with check (public.is_org_team_staff(organization_id));

drop policy if exists metrolina_workouts_staff on public.workouts;
create policy metrolina_workouts_select_member on public.workouts
  for select to authenticated
  using (public.is_org_team_staff(organization_id));
create policy metrolina_workouts_staff_write on public.workouts
  for all to authenticated
  using (public.is_org_team_staff(organization_id))
  with check (public.is_org_team_staff(organization_id));

drop policy if exists metrolina_workout_sessions_staff on public.workout_sessions;
create policy metrolina_workout_sessions_staff on public.workout_sessions
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id) and public.is_player_staff(player_id));

drop policy if exists metrolina_player_measurements_staff on public.player_measurements;
create policy metrolina_player_measurements_staff on public.player_measurements
  for all to authenticated
  using (public.is_org_team_staff(organization_id))
  with check (public.is_org_team_staff(organization_id) and public.is_player_staff(player_id));

drop policy if exists metrolina_games_staff on public.games;
create policy metrolina_games_staff on public.games
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id));

drop policy if exists metrolina_player_notes_staff on public.player_notes;
create policy metrolina_player_notes_staff on public.player_notes
  for all to authenticated
  using (
    (team_id is not null and public.is_team_staff(team_id))
    or (team_id is null and public.is_org_admin(organization_id))
    or (player_id is not null and public.is_player_staff(player_id))
  )
  with check (
    (team_id is not null and public.is_team_staff(team_id))
    or (team_id is null and public.is_org_admin(organization_id))
  );

drop policy if exists metrolina_development_goals_staff on public.development_goals;
create policy metrolina_development_goals_staff on public.development_goals
  for all to authenticated
  using (
    (team_id is not null and public.is_team_staff(team_id))
    or (team_id is null and public.is_org_admin(organization_id))
    or public.is_player_staff(player_id)
  )
  with check (
    public.is_player_staff(player_id)
    and (
      (team_id is not null and public.is_team_staff(team_id))
      or (team_id is null and public.is_org_admin(organization_id))
    )
  );

drop policy if exists metrolina_weekly_awards_staff on public.weekly_awards;
create policy metrolina_weekly_awards_staff on public.weekly_awards
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id) and public.is_player_staff(player_id));

commit;
