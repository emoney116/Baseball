alter table public.exercises
  add column if not exists category text,
  add column if not exists equipment text,
  add column if not exists measurement_type text,
  add column if not exists performance_direction text,
  add column if not exists default_target_style text,
  add column if not exists archived_at timestamptz;

alter table public.weight_room_workout_stations
  add column if not exists target_value numeric,
  add column if not exists target_style text,
  add column if not exists performance_direction text;

alter table public.weight_room_workout_group_members
  add column if not exists id uuid default gen_random_uuid();

update public.weight_room_workout_group_members
set id = gen_random_uuid()
where id is null;

create unique index if not exists weight_room_workout_group_members_id_key
  on public.weight_room_workout_group_members(id);

create table if not exists public.weight_room_exercise_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_exercise_presets_name_key
  on public.weight_room_exercise_presets(organization_id, coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where archived_at is null;

create table if not exists public.weight_room_exercise_preset_items (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.weight_room_exercise_presets(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  display_order integer not null,
  target_sets integer,
  target_reps integer,
  target_weight numeric,
  target_value numeric,
  target_style text,
  measurement_type text,
  performance_direction text,
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_exercise_preset_items_order_key
  on public.weight_room_exercise_preset_items(preset_id, display_order);

create table if not exists public.weight_room_group_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_group_presets_name_key
  on public.weight_room_group_presets(organization_id, coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where archived_at is null;

create table if not exists public.weight_room_group_preset_groups (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.weight_room_group_presets(id) on delete cascade,
  name text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weight_room_group_preset_groups_order_key
  on public.weight_room_group_preset_groups(preset_id, display_order);

create unique index if not exists weight_room_group_preset_groups_preset_id_id_key
  on public.weight_room_group_preset_groups(preset_id, id);

create table if not exists public.weight_room_group_preset_members (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.weight_room_group_presets(id) on delete cascade,
  group_id uuid not null references public.weight_room_group_preset_groups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (preset_id, group_id) references public.weight_room_group_preset_groups(preset_id, id) on delete cascade
);

create unique index if not exists weight_room_group_preset_members_one_group_key
  on public.weight_room_group_preset_members(preset_id, player_id);

alter table public.weight_room_exercise_presets enable row level security;
alter table public.weight_room_exercise_preset_items enable row level security;
alter table public.weight_room_group_presets enable row level security;
alter table public.weight_room_group_preset_groups enable row level security;
alter table public.weight_room_group_preset_members enable row level security;

drop policy if exists weight_room_exercise_presets_staff on public.weight_room_exercise_presets;
create policy weight_room_exercise_presets_staff on public.weight_room_exercise_presets
  for all to authenticated
  using (team_id is null or public.is_team_staff(team_id))
  with check (team_id is null or public.is_team_staff(team_id));

drop policy if exists weight_room_exercise_preset_items_staff on public.weight_room_exercise_preset_items;
create policy weight_room_exercise_preset_items_staff on public.weight_room_exercise_preset_items
  for all to authenticated
  using (exists (
    select 1 from public.weight_room_exercise_presets preset
    where preset.id = preset_id and (preset.team_id is null or public.is_team_staff(preset.team_id))
  ))
  with check (exists (
    select 1 from public.weight_room_exercise_presets preset
    where preset.id = preset_id and (preset.team_id is null or public.is_team_staff(preset.team_id))
  ));

drop policy if exists weight_room_group_presets_staff on public.weight_room_group_presets;
create policy weight_room_group_presets_staff on public.weight_room_group_presets
  for all to authenticated
  using (team_id is null or public.is_team_staff(team_id))
  with check (team_id is null or public.is_team_staff(team_id));

drop policy if exists weight_room_group_preset_groups_staff on public.weight_room_group_preset_groups;
create policy weight_room_group_preset_groups_staff on public.weight_room_group_preset_groups
  for all to authenticated
  using (exists (
    select 1 from public.weight_room_group_presets preset
    where preset.id = preset_id and (preset.team_id is null or public.is_team_staff(preset.team_id))
  ))
  with check (exists (
    select 1 from public.weight_room_group_presets preset
    where preset.id = preset_id and (preset.team_id is null or public.is_team_staff(preset.team_id))
  ));

drop policy if exists weight_room_group_preset_members_staff on public.weight_room_group_preset_members;
create policy weight_room_group_preset_members_staff on public.weight_room_group_preset_members
  for all to authenticated
  using (exists (
    select 1
    from public.weight_room_group_preset_groups preset_group
    join public.weight_room_group_presets preset on preset.id = preset_group.preset_id
    where preset_group.id = group_id and (preset.team_id is null or public.is_team_staff(preset.team_id))
  ))
  with check (exists (
    select 1
    from public.weight_room_group_preset_groups preset_group
    join public.weight_room_group_presets preset on preset.id = preset_group.preset_id
    where preset_group.id = group_id and (preset.team_id is null or public.is_team_staff(preset.team_id))
  ));
