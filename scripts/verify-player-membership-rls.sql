\set ON_ERROR_STOP on
\pset pager off

\echo Remote player-team membership RLS regression verification

begin;

create temp table rls_membership_fixture as
select
  gen_random_uuid() as authorized_player_id,
  gen_random_uuid() as blocked_player_id,
  gen_random_uuid() as unauthorized_player_id,
  gen_random_uuid() as anon_player_id,
  gen_random_uuid() as unauthorized_profile_id,
  gen_random_uuid() as organization_id,
  gen_random_uuid() as team_id,
  gen_random_uuid() as season_id,
  gen_random_uuid() as staff_profile_id,
  gen_random_uuid() as staff_membership_id;

-- Disposable identities only. The transaction rolls everything back, including
-- on psql failure/connection close; no existing account or membership is edited.
insert into auth.users(id,email)
select staff_profile_id, 'rls-staff-' || staff_profile_id || '@clubhouse9.invalid' from rls_membership_fixture
union all
select unauthorized_profile_id, 'rls-outsider-' || unauthorized_profile_id || '@clubhouse9.invalid' from rls_membership_fixture;

insert into public.profiles(id,role)
select staff_profile_id,'COACH'::public.membership_role from rls_membership_fixture
union all
select unauthorized_profile_id,'COACH'::public.membership_role from rls_membership_fixture
on conflict (id) do update set role=excluded.role;

insert into public.organizations(id,name,slug)
select organization_id,'Transactional RLS QA','rls-qa-' || organization_id from rls_membership_fixture;
insert into public.teams(id,organization_id,name)
select team_id,organization_id,'Transactional RLS QA' from rls_membership_fixture;
insert into public.seasons(id,organization_id,team_id,name)
select season_id,organization_id,team_id,'Transactional QA' from rls_membership_fixture;
insert into public.profile_team_memberships(id,profile_id,team_id,role,active)
select staff_membership_id,staff_profile_id,team_id,'HEAD_COACH',true from rls_membership_fixture;

grant select on rls_membership_fixture to authenticated, anon;

insert into public.players (
  id, organization_id, first_name, last_name, jersey_number, graduation_year,
  primary_position, secondary_position, bats, throws, height, weight,
  is_pitcher, is_hitter, metadata, created_at, updated_at
)
select
  blocked_player_id,
  organization_id,
  'RLS',
  'Blocked',
  97,
  2027,
  'OF',
  null,
  'R',
  'R',
  '5-11',
  175,
  false,
  true,
  jsonb_build_object('rlsRegression', true),
  now(),
  now()
from rls_membership_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', staff_profile_id::text, true)
from rls_membership_fixture;
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.players (
  id, organization_id, first_name, last_name, jersey_number, graduation_year,
  primary_position, secondary_position, bats, throws, height, weight,
  is_pitcher, is_hitter, metadata, created_at, updated_at
)
select
  authorized_player_id,
  organization_id,
  'RLS',
  'Membership',
  98,
  2027,
  'SS',
  'RHP',
  'R',
  'R',
  '6-0',
  180,
  true,
  true,
  jsonb_build_object('rlsRegression', true),
  now(),
  now()
from rls_membership_fixture;

do $$
declare
  inserted_count integer;
begin
  select count(*)
  into inserted_count
  from public.players p
  join rls_membership_fixture fixture on fixture.authorized_player_id = p.id;

  if inserted_count <> 1 then
    raise exception 'Authorized staff could not insert/read a player identity through RLS.';
  end if;
end $$;

do $$
declare
  visible_count integer;
begin
  select count(*)
  into visible_count
  from public.player_team_memberships ptm
  join rls_membership_fixture fixture on fixture.team_id = ptm.team_id;

  if visible_count < 0 then
    raise exception 'Authorized SELECT unexpectedly failed.';
  end if;
end $$;

insert into public.player_team_memberships (player_id, team_id, season_id, roster_status, jersey_number)
select authorized_player_id, team_id, season_id, 'Undecided', 98
from rls_membership_fixture;

update public.player_team_memberships ptm
set roster_status = 'Varsity',
    jersey_number = 56
from rls_membership_fixture fixture
where ptm.player_id = fixture.authorized_player_id
  and ptm.team_id = fixture.team_id
  and ptm.season_id = fixture.season_id;

do $$
declare
  updated_count integer;
begin
  select count(*)
  into updated_count
  from public.player_team_memberships ptm
  join rls_membership_fixture fixture on fixture.authorized_player_id = ptm.player_id
  where ptm.roster_status = 'Varsity'
    and ptm.jersey_number = 56;

  if updated_count <> 1 then
    raise exception 'Authorized UPDATE did not persist through RLS.';
  end if;
end $$;

delete from public.player_team_memberships ptm
using rls_membership_fixture fixture
where ptm.player_id = fixture.authorized_player_id
  and ptm.team_id = fixture.team_id
  and ptm.season_id = fixture.season_id;

do $$
declare
  remaining_count integer;
begin
  select count(*)
  into remaining_count
  from public.player_team_memberships ptm
  join rls_membership_fixture fixture on fixture.authorized_player_id = ptm.player_id;

  if remaining_count <> 0 then
    raise exception 'Authorized DELETE did not remove the membership through RLS.';
  end if;
end $$;

reset role;

insert into public.player_team_memberships (player_id, team_id, season_id, roster_status, jersey_number)
select authorized_player_id, team_id, season_id, 'JV', 44
from rls_membership_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', unauthorized_profile_id::text, true)
from rls_membership_fixture;
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  visible_count integer;
  touched_count integer;
begin
  select count(*)
  into visible_count
  from public.player_team_memberships ptm
  join rls_membership_fixture fixture on fixture.authorized_player_id = ptm.player_id;

  if visible_count <> 0 then
    raise exception 'Unauthorized user could read player_team_memberships.';
  end if;

  begin
    insert into public.players (
      id, organization_id, first_name, last_name, jersey_number, graduation_year,
      primary_position, secondary_position, bats, throws, height, weight,
      is_pitcher, is_hitter, metadata, created_at, updated_at
    )
    select
      unauthorized_player_id,
      organization_id,
      'RLS',
      'Unauthorized',
      96,
      2027,
      'SS',
      null,
      'R',
      'R',
      '6-0',
      180,
      false,
      true,
      jsonb_build_object('rlsRegression', true),
      now(),
      now()
    from rls_membership_fixture;

    raise exception 'Unauthorized player INSERT unexpectedly succeeded.';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  update public.players p
  set jersey_number = 1
  from rls_membership_fixture fixture
  where p.id = fixture.authorized_player_id;

  get diagnostics touched_count = row_count;
  if touched_count <> 0 then
    raise exception 'Unauthorized player UPDATE unexpectedly touched rows.';
  end if;

  begin
    insert into public.player_team_memberships (player_id, team_id, season_id, roster_status, jersey_number)
    select blocked_player_id, team_id, season_id, 'Undecided', 97
    from rls_membership_fixture;

    raise exception 'Unauthorized INSERT unexpectedly succeeded.';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  update public.player_team_memberships ptm
  set roster_status = 'Cut',
      jersey_number = 1
  from rls_membership_fixture fixture
  where ptm.player_id = fixture.authorized_player_id;

  get diagnostics touched_count = row_count;
  if touched_count <> 0 then
    raise exception 'Unauthorized UPDATE unexpectedly touched rows.';
  end if;

  delete from public.player_team_memberships ptm
  using rls_membership_fixture fixture
  where ptm.player_id = fixture.authorized_player_id;

  get diagnostics touched_count = row_count;
  if touched_count <> 0 then
    raise exception 'Unauthorized DELETE unexpectedly touched rows.';
  end if;
end $$;

reset role;

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);

do $$
declare
  visible_count integer;
begin
  select count(*)
  into visible_count
  from public.player_team_memberships ptm
  join rls_membership_fixture fixture on fixture.authorized_player_id = ptm.player_id;

  if visible_count <> 0 then
    raise exception 'Anonymous user could read player_team_memberships.';
  end if;

  begin
    insert into public.players (
      id, organization_id, first_name, last_name, jersey_number, graduation_year,
      primary_position, secondary_position, bats, throws, height, weight,
      is_pitcher, is_hitter, metadata, created_at, updated_at
    )
    select
      anon_player_id,
      organization_id,
      'RLS',
      'Anonymous',
      95,
      2027,
      'OF',
      null,
      'R',
      'R',
      '5-11',
      175,
      false,
      true,
      jsonb_build_object('rlsRegression', true),
      now(),
      now()
    from rls_membership_fixture;

    raise exception 'Anonymous player INSERT unexpectedly succeeded.';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  begin
    insert into public.player_team_memberships (player_id, team_id, season_id, roster_status, jersey_number)
    select blocked_player_id, team_id, season_id, 'Undecided', 97
    from rls_membership_fixture;

    raise exception 'Anonymous INSERT unexpectedly succeeded.';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;
end $$;

reset role;

rollback;

select 'player_team_memberships RLS regression' as check_name, 'pass' as result;
