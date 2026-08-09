with org as (
  insert into public.organizations (name, slug)
  values ('Metrolina Christian Academy', 'metrolina-christian-academy')
  on conflict (slug) do update
    set name = excluded.name,
        updated_at = now()
  returning id
),
team as (
  insert into public.teams (organization_id, name, level, active)
  select id, 'Baseball', 'Program', true
  from org
  on conflict (organization_id, name) do update
    set level = excluded.level,
        active = true,
        updated_at = now()
  returning id, organization_id
),
selected_team as (
  select id, organization_id from team
  union all
  select t.id, t.organization_id
  from public.teams t
  join org on org.id = t.organization_id
  where t.name = 'Baseball'
  limit 1
)
insert into public.seasons (organization_id, team_id, name, starts_on, ends_on, active)
select organization_id, id, 'Fall 2026', '2026-08-01'::date, '2026-11-30'::date, true
from selected_team
on conflict (team_id, name) do update
  set starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      active = true,
      updated_at = now();

insert into public.exercises (organization_id, name, kind, unit, built_in, active)
select org.id, exercise.name, exercise.kind, exercise.unit, true, true
from public.organizations org
cross join (
  values
    ('Back Squat', 'Lift', 'lb'),
    ('Front Squat', 'Lift', 'lb'),
    ('Bench Press', 'Lift', 'lb'),
    ('Incline Bench', 'Lift', 'lb'),
    ('Deadlift', 'Lift', 'lb'),
    ('Trap Bar Deadlift', 'Lift', 'lb'),
    ('Power Clean', 'Lift', 'lb'),
    ('Hang Clean', 'Lift', 'lb'),
    ('Push Press', 'Lift', 'lb'),
    ('Pull Ups', 'Lift', 'reps'),
    ('DB Bench', 'Lift', 'lb'),
    ('Bulgarian Split Squat', 'Lift', 'lb'),
    ('Sprint', 'Speed', 'sec'),
    ('Broad Jump', 'Jump', 'in'),
    ('Vertical Jump', 'Jump', 'in')
) as exercise(name, kind, unit)
where org.slug = 'metrolina-christian-academy'
on conflict (organization_id, name) do update
  set kind = excluded.kind,
      unit = excluded.unit,
      built_in = true,
      active = true,
      updated_at = now();
