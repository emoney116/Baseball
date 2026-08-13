-- Unified team schedule shell. Practices, games, and lifts keep their richer
-- domain tables; this table stores shared calendar metadata and generic events.

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  team_ids uuid[] not null default '{}',
  event_type text not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  address text,
  notes text,
  visibility text not null default 'TEAM_ONLY',
  status text not null default 'Scheduled',
  practice_id uuid references public.practices(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  workout_session_id uuid references public.workout_sessions(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_events_type_check check (event_type in ('Practice', 'Game', 'Lift', 'Scrimmage', 'Meeting', 'Team Event', 'Tournament', 'Other')),
  constraint schedule_events_visibility_check check (visibility in ('PUBLIC', 'TEAM_ONLY', 'PRIVATE')),
  constraint schedule_events_status_check check (status in ('Scheduled', 'Completed', 'Cancelled', 'Postponed'))
);

create index if not exists schedule_events_team_start_idx
  on public.schedule_events(team_id, start_at);

create index if not exists schedule_events_season_start_idx
  on public.schedule_events(season_id, start_at);

create index if not exists schedule_events_org_start_idx
  on public.schedule_events(organization_id, start_at);

create unique index if not exists schedule_events_practice_id_key
  on public.schedule_events(practice_id)
  where practice_id is not null;

create unique index if not exists schedule_events_game_id_key
  on public.schedule_events(game_id)
  where game_id is not null;

create unique index if not exists schedule_events_workout_session_id_key
  on public.schedule_events(workout_session_id)
  where workout_session_id is not null;

drop trigger if exists set_schedule_events_updated_at on public.schedule_events;
create trigger set_schedule_events_updated_at
  before update on public.schedule_events
  for each row execute function public.set_updated_at();

alter table public.schedule_events enable row level security;

drop policy if exists clubhouse_schedule_events_select_authorized on public.schedule_events;
drop policy if exists clubhouse_schedule_events_staff_write on public.schedule_events;

create policy clubhouse_schedule_events_select_authorized on public.schedule_events
  for select to authenticated
  using (
    (team_id is not null and public.is_team_staff(team_id))
    or (organization_id is not null and public.is_org_admin(organization_id))
    or visibility = 'PUBLIC'
  );

create policy clubhouse_schedule_events_staff_write on public.schedule_events
  for all to authenticated
  using (
    (team_id is not null and public.is_team_staff(team_id))
    or (organization_id is not null and public.is_org_admin(organization_id))
  )
  with check (
    (team_id is not null and public.is_team_staff(team_id))
    or (organization_id is not null and public.is_org_admin(organization_id))
  );

insert into public.schedule_events (
  id,
  organization_id,
  team_id,
  season_id,
  team_ids,
  event_type,
  title,
  start_at,
  end_at,
  location,
  notes,
  visibility,
  status,
  practice_id,
  created_at,
  updated_at
)
select
  p.id,
  p.organization_id,
  p.team_id,
  p.season_id,
  array[p.team_id],
  'Practice',
  coalesce(nullif(p.name, ''), 'Practice'),
  coalesce(p.starts_at, (p.practice_date::text || 'T12:00:00Z')::timestamptz),
  p.ended_at,
  p.location,
  p.notes,
  'TEAM_ONLY',
  case when p.ended_at is not null then 'Completed' else 'Scheduled' end,
  p.id,
  p.created_at,
  p.updated_at
from public.practices p
where not exists (
  select 1
  from public.schedule_events se
  where se.practice_id = p.id
);

insert into public.schedule_events (
  id,
  organization_id,
  team_id,
  season_id,
  team_ids,
  event_type,
  title,
  start_at,
  location,
  visibility,
  status,
  game_id,
  created_at,
  updated_at
)
select
  g.id,
  g.organization_id,
  g.team_id,
  g.season_id,
  array[g.team_id],
  'Game',
  case when g.home_away = 'Away' then '@ ' || g.opponent else 'vs. ' || g.opponent end,
  coalesce(g.starts_at, (g.game_date::text || 'T12:00:00Z')::timestamptz),
  g.location,
  case
    when coalesce(o.visibility, 'PRIVATE') = 'PUBLIC' then 'PUBLIC'
    when coalesce(t.visibility, 'PRIVATE') = 'PUBLIC' then 'PUBLIC'
    else 'TEAM_ONLY'
  end,
  case
    when g.result is not null or lower(coalesce(g.status::text, '')) = 'final' then 'Completed'
    else 'Scheduled'
  end,
  g.id,
  g.created_at,
  g.updated_at
from public.games g
left join public.teams t on t.id = g.team_id
left join public.organizations o on o.id = g.organization_id
where not exists (
  select 1
  from public.schedule_events se
  where se.game_id = g.id
);
