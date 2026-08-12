-- Organization visibility controls teams inside the organization. Backfill the
-- real Metrolina competitive teams so the public org page reflects the org.

with metrolina as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
)
update public.teams team
set
  active = true,
  visibility = 'PUBLIC',
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
metrolina_teams as (
  select team.id
  from public.teams team
  join metrolina on metrolina.id = team.organization_id
  where team.name in ('Metrolina Varsity', 'Metrolina JV')
)
update public.seasons season
set
  active = true,
  updated_at = now()
from metrolina_teams
where season.team_id = metrolina_teams.id
  and season.name = 'Fall 2026';
