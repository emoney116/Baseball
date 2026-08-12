-- Allow users to follow a public organization while hiding individual teams
-- from that organization, and seed a larger public demo org for follow-card QA.

create table if not exists public.profile_follow_exclusions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists profile_follow_exclusions_profile_team_key
  on public.profile_follow_exclusions(profile_id, team_id);

create index if not exists profile_follow_exclusions_profile_id_idx
  on public.profile_follow_exclusions(profile_id);

create index if not exists profile_follow_exclusions_organization_id_idx
  on public.profile_follow_exclusions(organization_id);

create index if not exists profile_follow_exclusions_team_id_idx
  on public.profile_follow_exclusions(team_id);

alter table public.profile_follow_exclusions enable row level security;

drop policy if exists clubhouse_profile_follow_exclusions_select_own on public.profile_follow_exclusions;
drop policy if exists clubhouse_profile_follow_exclusions_insert_own on public.profile_follow_exclusions;
drop policy if exists clubhouse_profile_follow_exclusions_delete_own on public.profile_follow_exclusions;

create policy clubhouse_profile_follow_exclusions_select_own on public.profile_follow_exclusions
  for select
  using (profile_id = auth.uid());

create policy clubhouse_profile_follow_exclusions_insert_own on public.profile_follow_exclusions
  for insert
  with check (profile_id = auth.uid());

create policy clubhouse_profile_follow_exclusions_delete_own on public.profile_follow_exclusions
  for delete
  using (profile_id = auth.uid());

insert into public.organizations (id, name, slug, visibility, city, state)
values
  ('8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carolina Showcase Baseball', 'carolina-showcase-baseball', 'PUBLIC', 'Matthews', 'NC')
on conflict (slug) do update
set
  name = excluded.name,
  visibility = excluded.visibility,
  city = excluded.city,
  state = excluded.state,
  updated_at = now();

insert into public.teams (id, organization_id, name, level, active, visibility)
values
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2011', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carolina Showcase 18U', '18U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2012', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carolina Showcase 17U', '17U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2013', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carolina Showcase 16U', '16U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2014', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carolina Showcase 15U', '15U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carolina Showcase 14U', '14U', true, 'PUBLIC')
on conflict (organization_id, name) do update
set
  level = excluded.level,
  active = excluded.active,
  visibility = excluded.visibility,
  updated_at = now();

insert into public.seasons (id, organization_id, team_id, name, starts_on, ends_on, active)
values
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3011', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2011', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3012', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2012', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3013', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2013', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3014', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2014', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'Summer 2027', '2027-05-15', '2027-08-15', true)
on conflict (team_id, name) do update
set
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  active = excluded.active,
  updated_at = now();
