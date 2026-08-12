-- Remove the legacy Metrolina "Baseball / Program" seed team from the
-- organization workspace and backfill identity defaults used by Clubhouse 9.

update public.organizations
set
  city = coalesce(nullif(city, ''), 'Indian Trail'),
  state = coalesce(nullif(state, ''), 'NC'),
  logo_url = coalesce(nullif(logo_url, ''), '/brand/metrolina-baseball-alpha.png'),
  visibility = 'PUBLIC',
  updated_at = now()
where slug = 'metrolina-christian-academy';

with metrolina as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
)
update public.teams team
set
  city = coalesce(nullif(team.city, ''), 'Indian Trail'),
  state = coalesce(nullif(team.state, ''), 'NC'),
  logo_url = coalesce(nullif(team.logo_url, ''), '/brand/metrolina-baseball-alpha.png'),
  updated_at = now()
from metrolina
where team.organization_id = metrolina.id
  and team.name in ('Metrolina Varsity', 'Metrolina JV');

with metrolina as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
program_teams as (
  select team.id
  from public.teams team
  join metrolina on metrolina.id = team.organization_id
  where lower(team.name) = 'baseball'
     or lower(coalesce(team.level, '')) = 'program'
     or lower(coalesce(team.team_type, '')) = 'program'
)
update public.seasons season
set
  organization_id = null,
  active = false,
  updated_at = now()
from program_teams
where season.team_id = program_teams.id;

with metrolina as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
program_teams as (
  select team.id
  from public.teams team
  join metrolina on metrolina.id = team.organization_id
  where lower(team.name) = 'baseball'
     or lower(coalesce(team.level, '')) = 'program'
     or lower(coalesce(team.team_type, '')) = 'program'
)
update public.teams team
set
  organization_id = null,
  active = false,
  name = 'Legacy Metrolina Program',
  visibility = 'PRIVATE',
  updated_at = now()
from program_teams
where team.id = program_teams.id;
