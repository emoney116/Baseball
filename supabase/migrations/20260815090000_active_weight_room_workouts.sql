create table if not exists public.weight_room_workouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  schedule_event_id uuid references public.schedule_events(id) on delete set null,
  title text not null,
  workout_date date not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_workouts_one_active_team_idx
  on public.weight_room_workouts(team_id, coalesce(season_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('ACTIVE', 'PAUSED');

create index if not exists weight_room_workouts_team_date_idx
  on public.weight_room_workouts(team_id, workout_date desc);

create table if not exists public.weight_room_workout_stations (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.weight_room_workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  display_order integer not null,
  target_sets integer,
  target_reps integer,
  target_weight numeric,
  measurement_type text,
  unit text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_workout_stations_order_key
  on public.weight_room_workout_stations(workout_id, display_order);

create table if not exists public.weight_room_workout_groups (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.weight_room_workouts(id) on delete cascade,
  name text not null,
  display_order integer not null,
  current_station_id uuid references public.weight_room_workout_stations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_workout_groups_order_key
  on public.weight_room_workout_groups(workout_id, display_order);

create unique index if not exists weight_room_workout_groups_workout_id_id_key
  on public.weight_room_workout_groups(workout_id, id);

create table if not exists public.weight_room_workout_group_members (
  workout_id uuid not null references public.weight_room_workouts(id) on delete cascade,
  group_id uuid not null references public.weight_room_workout_groups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  participant_status text not null default 'ASSIGNED' check (participant_status in ('ASSIGNED', 'MODIFIED', 'SKIPPED', 'NOT_ASSIGNED', 'NOT_PARTICIPATING')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workout_id, group_id, player_id),
  foreign key (workout_id, group_id) references public.weight_room_workout_groups(workout_id, id) on delete cascade
);

create unique index if not exists weight_room_workout_group_members_one_group_key
  on public.weight_room_workout_group_members(workout_id, player_id);

alter table public.workout_sets
  add column if not exists active_workout_id uuid references public.weight_room_workouts(id) on delete set null,
  add column if not exists workout_station_id uuid references public.weight_room_workout_stations(id) on delete set null,
  add column if not exists workout_group_id uuid references public.weight_room_workout_groups(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists idempotency_key text;

create unique index if not exists workout_sets_active_unique_set_key
  on public.workout_sets(active_workout_id, player_id, exercise_id, coalesce(set_number, 1))
  where active_workout_id is not null;

create unique index if not exists workout_sets_idempotency_key
  on public.workout_sets(idempotency_key)
  where idempotency_key is not null;

create table if not exists public.weight_room_weigh_ins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  workout_id uuid references public.weight_room_workouts(id) on delete set null,
  player_id uuid not null references public.players(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  weight numeric not null check (weight > 0),
  created_by uuid references public.profiles(id) on delete set null,
  entry_source text not null default 'COACH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_weigh_ins_workout_player_key
  on public.weight_room_weigh_ins(workout_id, player_id)
  where workout_id is not null;

create index if not exists weight_room_weigh_ins_player_recorded_idx
  on public.weight_room_weigh_ins(player_id, recorded_at desc);

alter table public.weight_room_workouts enable row level security;
alter table public.weight_room_workout_stations enable row level security;
alter table public.weight_room_workout_groups enable row level security;
alter table public.weight_room_workout_group_members enable row level security;
alter table public.weight_room_weigh_ins enable row level security;

drop policy if exists weight_room_workouts_staff on public.weight_room_workouts;
create policy weight_room_workouts_staff on public.weight_room_workouts
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id));

drop policy if exists weight_room_workout_stations_staff on public.weight_room_workout_stations;
create policy weight_room_workout_stations_staff on public.weight_room_workout_stations
  for all to authenticated
  using (exists (
    select 1 from public.weight_room_workouts wrw
    where wrw.id = workout_id and public.is_team_staff(wrw.team_id)
  ))
  with check (exists (
    select 1 from public.weight_room_workouts wrw
    where wrw.id = workout_id and public.is_team_staff(wrw.team_id)
  ));

drop policy if exists weight_room_workout_groups_staff on public.weight_room_workout_groups;
create policy weight_room_workout_groups_staff on public.weight_room_workout_groups
  for all to authenticated
  using (exists (
    select 1 from public.weight_room_workouts wrw
    where wrw.id = workout_id and public.is_team_staff(wrw.team_id)
  ))
  with check (exists (
    select 1 from public.weight_room_workouts wrw
    where wrw.id = workout_id and public.is_team_staff(wrw.team_id)
  ));

drop policy if exists weight_room_workout_group_members_staff on public.weight_room_workout_group_members;
create policy weight_room_workout_group_members_staff on public.weight_room_workout_group_members
  for all to authenticated
  using (exists (
    select 1
    from public.weight_room_workout_groups wrg
    join public.weight_room_workouts wrw on wrw.id = wrg.workout_id
    where wrg.id = group_id and public.is_team_staff(wrw.team_id)
  ))
  with check (exists (
    select 1
    from public.weight_room_workout_groups wrg
    join public.weight_room_workouts wrw on wrw.id = wrg.workout_id
    where wrg.id = group_id and public.is_team_staff(wrw.team_id)
  ));

drop policy if exists weight_room_weigh_ins_staff on public.weight_room_weigh_ins;
create policy weight_room_weigh_ins_staff on public.weight_room_weigh_ins
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id) and public.is_player_staff(player_id));
