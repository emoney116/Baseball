begin;

with metrolina_org as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
admin_profiles as (
  select p.id
  from public.profiles p
  cross join metrolina_org
  where p.role = 'ADMIN'
)
insert into public.organization_memberships (organization_id, profile_id, role, active)
select metrolina_org.id, admin_profiles.id, 'ADMIN', true
from metrolina_org
join admin_profiles on true
on conflict (organization_id, profile_id)
do update
  set role = 'ADMIN',
      active = true,
      updated_at = now();

with metrolina_org as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
admin_profiles as (
  select p.id
  from public.profiles p
  where p.role = 'ADMIN'
),
desired_team_memberships as (
  select
    admin_profiles.id as profile_id,
    team.id as team_id,
    season.id as season_id
  from public.teams team
  join public.seasons season on season.team_id = team.id
  join metrolina_org on metrolina_org.id = team.organization_id
  join admin_profiles on true
  where team.active = true
    and season.active = true
)
update public.profile_team_memberships ptm
set role = 'ADMIN',
    title = 'Program Admin',
    active = true,
    updated_at = now()
from desired_team_memberships desired
where ptm.profile_id = desired.profile_id
  and ptm.team_id = desired.team_id
  and ptm.season_id is not distinct from desired.season_id;

with metrolina_org as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
admin_profiles as (
  select p.id
  from public.profiles p
  where p.role = 'ADMIN'
),
desired_team_memberships as (
  select
    admin_profiles.id as profile_id,
    team.id as team_id,
    season.id as season_id
  from public.teams team
  join public.seasons season on season.team_id = team.id
  join metrolina_org on metrolina_org.id = team.organization_id
  join admin_profiles on true
  where team.active = true
    and season.active = true
)
insert into public.profile_team_memberships (profile_id, team_id, season_id, role, title, active)
select
  desired.profile_id,
  desired.team_id,
  desired.season_id,
  'ADMIN',
  'Program Admin',
  true
from desired_team_memberships desired
where not exists (
  select 1
  from public.profile_team_memberships ptm
  where ptm.profile_id = desired.profile_id
    and ptm.team_id = desired.team_id
    and ptm.season_id is not distinct from desired.season_id
);

commit;
