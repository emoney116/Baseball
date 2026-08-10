begin;

create or replace function public.current_profile_can_manage_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_team_memberships ptm
    where ptm.team_id = target_team_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and (
        upper(ptm.role::text) in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
        or upper(coalesce(ptm.title, '')) in ('PROGRAM ADMIN', 'HEAD COACH', 'ASSISTANT COACH', 'COACH', 'STAFF')
      )
  )
  or exists (
    select 1
    from public.teams t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = target_team_id
      and om.profile_id = auth.uid()
      and om.active = true
      and upper(om.role::text) in ('ADMIN', 'COACH')
  );
$$;

create or replace function public.current_profile_can_admin_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_team_memberships ptm
    where ptm.team_id = target_team_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and (
        upper(ptm.role::text) in ('OWNER', 'ADMIN', 'HEAD_COACH')
        or upper(coalesce(ptm.title, '')) in ('PROGRAM ADMIN', 'OWNER', 'HEAD COACH')
      )
  )
  or exists (
    select 1
    from public.teams t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = target_team_id
      and om.profile_id = auth.uid()
      and om.active = true
      and upper(om.role::text) = 'ADMIN'
  );
$$;

create or replace function public.current_profile_can_write_player_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_org_id
      and om.profile_id = auth.uid()
      and om.active = true
      and upper(om.role::text) in ('ADMIN', 'COACH', 'OWNER', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF')
  )
  or exists (
    select 1
    from public.profile_team_memberships ptm
    join public.teams t on t.id = ptm.team_id
    where t.organization_id = target_org_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and (
        upper(ptm.role::text) in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
        or upper(coalesce(ptm.title, '')) in ('PROGRAM ADMIN', 'HEAD COACH', 'ASSISTANT COACH', 'COACH', 'STAFF')
      )
  );
$$;

with metrolina_staff_titles as (
  select ptm.id,
    case
      when upper(coalesce(ptm.title, '')) in ('PROGRAM ADMIN', 'OWNER') then 'ADMIN'
      when upper(coalesce(ptm.title, '')) = 'HEAD COACH' then 'HEAD_COACH'
      when upper(coalesce(ptm.title, '')) = 'ASSISTANT COACH' then 'ASSISTANT_COACH'
      when upper(coalesce(ptm.title, '')) = 'COACH' then 'COACH'
      when upper(coalesce(ptm.title, '')) = 'STAFF' then 'STAFF'
      else ptm.role
    end as normalized_role
  from public.profile_team_memberships ptm
  join public.teams team on team.id = ptm.team_id
  join public.organizations org on org.id = team.organization_id
  where org.slug = 'metrolina-christian-academy'
    and ptm.active = true
    and upper(coalesce(ptm.title, '')) in ('PROGRAM ADMIN', 'OWNER', 'HEAD COACH', 'ASSISTANT COACH', 'COACH', 'STAFF')
)
update public.profile_team_memberships ptm
set role = metrolina_staff_titles.normalized_role,
    updated_at = now()
from metrolina_staff_titles
where ptm.id = metrolina_staff_titles.id
  and ptm.role is distinct from metrolina_staff_titles.normalized_role;

with metrolina_org as (
  select id
  from public.organizations
  where slug = 'metrolina-christian-academy'
),
metrolina_program_admins as (
  select distinct ptm.profile_id
  from public.profile_team_memberships ptm
  join public.teams team on team.id = ptm.team_id
  join metrolina_org on metrolina_org.id = team.organization_id
  where ptm.active = true
    and (
      ptm.role = 'ADMIN'
      or upper(coalesce(ptm.title, '')) = 'PROGRAM ADMIN'
    )
)
insert into public.organization_memberships (organization_id, profile_id, role, active)
select metrolina_org.id, metrolina_program_admins.profile_id, 'ADMIN', true
from metrolina_org
join metrolina_program_admins on true
on conflict (organization_id, profile_id)
do update
  set role = 'ADMIN',
      active = true,
      updated_at = now();

revoke all on function public.current_profile_can_manage_team(uuid) from public, anon;
revoke all on function public.current_profile_can_admin_team(uuid) from public, anon;
revoke all on function public.current_profile_can_write_player_org(uuid) from public, anon;

grant execute on function public.current_profile_can_manage_team(uuid) to authenticated;
grant execute on function public.current_profile_can_admin_team(uuid) to authenticated;
grant execute on function public.current_profile_can_write_player_org(uuid) to authenticated;

commit;
