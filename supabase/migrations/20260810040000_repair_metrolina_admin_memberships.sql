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
),
inserted_org_memberships as (
  insert into public.organization_memberships (organization_id, profile_id, role, active)
  select metrolina_org.id, admin_profiles.id, 'ADMIN', true
  from metrolina_org
  join admin_profiles on true
  on conflict (organization_id, profile_id)
  do update
    set role = 'ADMIN',
        active = true,
        updated_at = now()
  returning profile_id, organization_id
),
active_team_seasons as (
  select
    team.id as team_id,
    season.id as season_id,
    team.organization_id
  from public.teams team
  join public.seasons season on season.team_id = team.id
  join metrolina_org on metrolina_org.id = team.organization_id
  where team.active = true
    and season.active = true
)
insert into public.profile_team_memberships (profile_id, team_id, season_id, role, title, active)
select
  inserted_org_memberships.profile_id,
  active_team_seasons.team_id,
  active_team_seasons.season_id,
  'ADMIN',
  'Program Admin',
  true
from inserted_org_memberships
join active_team_seasons
  on active_team_seasons.organization_id = inserted_org_memberships.organization_id
on conflict (profile_id, team_id, season_id)
do update
  set role = 'ADMIN',
      title = 'Program Admin',
      active = true,
      updated_at = now();

commit;
