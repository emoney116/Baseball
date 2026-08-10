begin;

create table if not exists public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  imported_by uuid references public.profiles(id) on delete set null,
  file_names jsonb not null default '[]'::jsonb,
  teams jsonb not null default '[]'::jsonb,
  modes jsonb not null default '[]'::jsonb,
  rows_processed integer not null default 0,
  players_created integer not null default 0,
  players_updated integer not null default 0,
  memberships_added integer not null default 0,
  memberships_updated integer not null default 0,
  memberships_removed integer not null default 0,
  rows_skipped integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roster_imports_team_id_idx on public.roster_imports(team_id);
create index if not exists roster_imports_season_id_idx on public.roster_imports(season_id);
create index if not exists roster_imports_imported_by_idx on public.roster_imports(imported_by);

alter table public.roster_imports enable row level security;

drop policy if exists metrolina_roster_imports_staff on public.roster_imports;
create policy metrolina_roster_imports_staff on public.roster_imports
  for all to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id));

drop trigger if exists set_roster_imports_updated_at on public.roster_imports;
create trigger set_roster_imports_updated_at
  before update on public.roster_imports
  for each row execute function public.set_updated_at();

commit;
