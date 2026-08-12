alter table public.teams
  alter column organization_id drop not null;

alter table public.seasons
  alter column organization_id drop not null;

alter table public.teams
  add column if not exists team_type text,
  add column if not exists age_group text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists logo_url text;

create index if not exists teams_location_idx on public.teams (state, city);
