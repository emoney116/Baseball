\set ON_ERROR_STOP on
\pset pager off

\echo Remote staff invitation acceptance RPC regression verification

begin;

create temp table staff_invitation_acceptance_fixture (
  invitation_id uuid,
  staff_member_id uuid,
  token_hash text,
  organization_id uuid not null,
  team_id uuid not null,
  season_id uuid,
  accepting_profile_id uuid not null,
  accepting_email text not null
);

insert into staff_invitation_acceptance_fixture (
  invitation_id,
  staff_member_id,
  token_hash,
  organization_id,
  team_id,
  season_id,
  accepting_profile_id,
  accepting_email
)
select
  gen_random_uuid(),
  existing_staff_member.id,
  'codex-staff-invite-regression-' || gen_random_uuid()::text,
  org.id,
  team.id,
  season.id,
  profile.id,
  lower(profile.email)
from public.organizations as org
join public.teams as team
  on team.organization_id = org.id
 and team.name = 'Metrolina Varsity'
join public.seasons as season
  on season.team_id = team.id
 and season.name = 'Fall 2026'
join public.profile_team_memberships as ptm
  on ptm.team_id = team.id
 and ptm.active = true
 and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
join public.profiles as profile
  on profile.id = ptm.profile_id
 and profile.email is not null
left join lateral (
  select sm.id
  from public.staff_members as sm
  where sm.organization_id = org.id
    and (
      sm.profile_id = profile.id
      or lower(sm.email) = lower(profile.email)
    )
  order by case when sm.profile_id = profile.id then 0 else 1 end, sm.created_at
  limit 1
) as existing_staff_member on true
where org.slug = 'metrolina-christian-academy'
order by
  case ptm.role
    when 'OWNER' then 0
    when 'ADMIN' then 1
    when 'HEAD_COACH' then 2
    else 3
  end,
  ptm.created_at
limit 1;

do $$
declare
  v_fixture staff_invitation_acceptance_fixture%rowtype;
  v_created_staff_member_id uuid;
begin
  select fixture.*
  into v_fixture
  from staff_invitation_acceptance_fixture as fixture
  limit 1;

  if v_fixture.accepting_profile_id is null then
    raise exception 'No existing staff profile fixture found for staff invitation acceptance verification.';
  end if;

  if v_fixture.staff_member_id is null then
    insert into public.staff_members (
      organization_id,
      profile_id,
      email,
      display_name,
      active
    )
    values (
      v_fixture.organization_id,
      v_fixture.accepting_profile_id,
      v_fixture.accepting_email,
      'Codex Staff Invite Regression',
      true
    )
    returning id into v_created_staff_member_id;

    update staff_invitation_acceptance_fixture as fixture
    set staff_member_id = v_created_staff_member_id;
  end if;
end $$;

insert into public.team_invitations (
  id,
  organization_id,
  email,
  invited_by_profile_id,
  invite_type,
  staff_member_id,
  status,
  token_hash,
  staff_role,
  access_role,
  org_role,
  expires_at
)
select
  fixture.invitation_id,
  fixture.organization_id,
  fixture.accepting_email,
  fixture.accepting_profile_id,
  'STAFF',
  fixture.staff_member_id,
  'PENDING',
  fixture.token_hash,
  'Assistant Coach',
  'COACH',
  'ADMIN',
  now() + interval '7 days'
from staff_invitation_acceptance_fixture as fixture;

insert into public.team_invitation_memberships (
  invitation_id,
  team_id,
  season_id,
  staff_role,
  access_role
)
select
  fixture.invitation_id,
  fixture.team_id,
  fixture.season_id,
  'Assistant Coach',
  'COACH'
from staff_invitation_acceptance_fixture as fixture;

grant select on staff_invitation_acceptance_fixture to authenticated;

set local role authenticated;

select set_config('request.jwt.claim.sub', fixture.accepting_profile_id::text, true)
from staff_invitation_acceptance_fixture as fixture;
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_fixture staff_invitation_acceptance_fixture%rowtype;
  v_result record;
  v_profile_memberships integer;
  v_staff_memberships integer;
  v_org_admin_memberships integer;
  v_invitation_status text;
begin
  select fixture.*
  into v_fixture
  from staff_invitation_acceptance_fixture as fixture
  limit 1;

  select accepted.*
  into v_result
  from public.accept_staff_invitation(v_fixture.token_hash) as accepted;

  if v_result.invitation_id <> v_fixture.invitation_id then
    raise exception 'accept_staff_invitation returned invitation %, expected %.', v_result.invitation_id, v_fixture.invitation_id;
  end if;

  if v_result.staff_member_id <> v_fixture.staff_member_id then
    raise exception 'accept_staff_invitation returned staff member %, expected %.', v_result.staff_member_id, v_fixture.staff_member_id;
  end if;

  if coalesce(v_result.memberships_created, 0) < 1 then
    raise exception 'accept_staff_invitation did not report any membership assignments.';
  end if;

  select ti.status
  into v_invitation_status
  from public.team_invitations as ti
  where ti.id = v_fixture.invitation_id;

  if v_invitation_status <> 'ACCEPTED' then
    raise exception 'Invitation status after acceptance was %, expected ACCEPTED.', v_invitation_status;
  end if;

  select count(*)
  into v_profile_memberships
  from public.profile_team_memberships as ptm
  where ptm.profile_id = v_fixture.accepting_profile_id
    and ptm.team_id = v_fixture.team_id
    and (
      ptm.season_id = v_fixture.season_id
      or (ptm.season_id is null and v_fixture.season_id is null)
    )
    and ptm.active = true
    and ptm.role = 'COACH'
    and ptm.title = 'Assistant Coach';

  if v_profile_memberships <> 1 then
    raise exception 'Expected one accepted profile_team_memberships row, found %.', v_profile_memberships;
  end if;

  select count(*)
  into v_staff_memberships
  from public.staff_team_memberships as stm
  where stm.staff_member_id = v_fixture.staff_member_id
    and stm.profile_id = v_fixture.accepting_profile_id
    and stm.team_id = v_fixture.team_id
    and (
      stm.season_id = v_fixture.season_id
      or (stm.season_id is null and v_fixture.season_id is null)
    )
    and stm.active = true
    and stm.invitation_id = v_fixture.invitation_id;

  if v_staff_memberships <> 1 then
    raise exception 'Expected one accepted staff_team_memberships row, found %.', v_staff_memberships;
  end if;

  select count(*)
  into v_org_admin_memberships
  from public.organization_memberships as om
  where om.organization_id = v_fixture.organization_id
    and om.profile_id = v_fixture.accepting_profile_id
    and om.active = true
    and om.role = 'ADMIN';

  if v_org_admin_memberships <> 1 then
    raise exception 'Expected accepted invitation to create/promote one organization admin membership, found %.', v_org_admin_memberships;
  end if;
end $$;

reset role;

rollback;

select 'staff invitation acceptance RPC regression' as check_name, 'pass' as result;
