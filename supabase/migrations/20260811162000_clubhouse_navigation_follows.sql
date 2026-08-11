-- Clubhouse 9 global navigation support for visibility-aware browsing and follows.

alter table public.organizations
  add column if not exists visibility text not null default 'PRIVATE';

alter table public.teams
  add column if not exists visibility text not null default 'PRIVATE';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_visibility_check'
  ) then
    alter table public.organizations
      add constraint organizations_visibility_check check (visibility in ('PUBLIC', 'UNLISTED', 'PRIVATE'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'teams_visibility_check'
  ) then
    alter table public.teams
      add constraint teams_visibility_check check (visibility in ('PUBLIC', 'UNLISTED', 'PRIVATE'));
  end if;
end $$;

create table if not exists public.profile_follows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    ((organization_id is not null)::integer + (team_id is not null)::integer) = 1
  )
);

create unique index if not exists profile_follows_profile_organization_key
  on public.profile_follows(profile_id, organization_id)
  where organization_id is not null and team_id is null;

create unique index if not exists profile_follows_profile_team_key
  on public.profile_follows(profile_id, team_id)
  where team_id is not null;

create index if not exists profile_follows_profile_id_idx
  on public.profile_follows(profile_id);

create index if not exists profile_follows_organization_id_idx
  on public.profile_follows(organization_id);

create index if not exists profile_follows_team_id_idx
  on public.profile_follows(team_id);

alter table public.profile_follows enable row level security;

drop policy if exists clubhouse_profile_follows_select_own on public.profile_follows;
drop policy if exists clubhouse_profile_follows_insert_own on public.profile_follows;
drop policy if exists clubhouse_profile_follows_delete_own on public.profile_follows;

create policy clubhouse_profile_follows_select_own on public.profile_follows
  for select
  using (profile_id = auth.uid());

create policy clubhouse_profile_follows_insert_own on public.profile_follows
  for insert
  with check (profile_id = auth.uid());

create policy clubhouse_profile_follows_delete_own on public.profile_follows
  for delete
  using (profile_id = auth.uid());
