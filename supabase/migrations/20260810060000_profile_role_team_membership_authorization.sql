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
    from public.profiles p
    join public.profile_team_memberships ptm on ptm.profile_id = p.id
    where p.id = auth.uid()
      and upper(p.role::text) in ('ADMIN', 'COACH')
      and ptm.team_id = target_team_id
      and ptm.active = true
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
    from public.profiles p
    join public.profile_team_memberships ptm on ptm.profile_id = p.id
    where p.id = auth.uid()
      and upper(p.role::text) = 'ADMIN'
      and ptm.team_id = target_team_id
      and ptm.active = true
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
  )
  or exists (
    select 1
    from public.profiles p
    join public.profile_team_memberships ptm on ptm.profile_id = p.id
    join public.teams t on t.id = ptm.team_id
    where p.id = auth.uid()
      and upper(p.role::text) in ('ADMIN', 'COACH')
      and t.organization_id = target_org_id
      and ptm.active = true
  );
$$;

create or replace function public.current_profile_can_manage_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_can_write_player_org(target_org_id);
$$;

create or replace function public.is_org_team_staff(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_can_write_player_org(target_org_id);
$$;

create or replace function public.is_team_staff(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_can_manage_team(target_team_id);
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_can_admin_team(target_team_id);
$$;

revoke all on function public.current_profile_can_manage_team(uuid) from public, anon;
revoke all on function public.current_profile_can_admin_team(uuid) from public, anon;
revoke all on function public.current_profile_can_write_player_org(uuid) from public, anon;
revoke all on function public.current_profile_can_manage_org(uuid) from public, anon;
revoke all on function public.is_org_team_staff(uuid) from public, anon;
revoke all on function public.is_team_staff(uuid) from public, anon;
revoke all on function public.is_team_admin(uuid) from public, anon;

grant execute on function public.current_profile_can_manage_team(uuid) to authenticated;
grant execute on function public.current_profile_can_admin_team(uuid) to authenticated;
grant execute on function public.current_profile_can_write_player_org(uuid) to authenticated;
grant execute on function public.current_profile_can_manage_org(uuid) to authenticated;
grant execute on function public.is_org_team_staff(uuid) to authenticated;
grant execute on function public.is_team_staff(uuid) to authenticated;
grant execute on function public.is_team_admin(uuid) to authenticated;

commit;
