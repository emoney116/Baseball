begin;

alter table public.team_invitations
  add column if not exists org_role text not null default 'MEMBER';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_invitations_org_role_check'
  ) then
    alter table public.team_invitations
      add constraint team_invitations_org_role_check check (org_role in ('ADMIN', 'MEMBER'));
  end if;
end $$;

drop function if exists public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[]);

create or replace function public.create_staff_invitation(
  invite_email text,
  invite_first_name text,
  invite_last_name text,
  invite_staff_role text,
  invite_access_role text,
  invite_token_hash text,
  invite_expires_at timestamptz,
  invite_team_ids uuid[],
  invite_season_ids uuid[] default array[]::uuid[],
  invite_org_role text default 'MEMBER'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter_id uuid := auth.uid();
  normalized_email text := lower(trim(coalesce(invite_email, '')));
  normalized_staff_role text := coalesce(nullif(trim(invite_staff_role), ''), 'Assistant Coach');
  normalized_access_role text := upper(coalesce(nullif(trim(invite_access_role), ''), 'COACH'));
  normalized_org_role text := upper(coalesce(nullif(trim(invite_org_role), ''), 'MEMBER'));
  team_count int := coalesce(array_length(invite_team_ids, 1), 0);
  season_count int := coalesce(array_length(invite_season_ids, 1), 0);
  idx int;
  target_org_id uuid;
  team_org_id uuid;
  assignment_season_id uuid;
  existing_staff_id uuid;
  new_invitation_id uuid;
  display_name_value text;
begin
  if inviter_id is null then
    raise exception 'Sign in before inviting staff.';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid staff email.';
  end if;

  if normalized_access_role not in ('ADMIN', 'COACH') then
    raise exception 'Application access must be ADMIN or COACH.';
  end if;

  if normalized_org_role not in ('ADMIN', 'MEMBER') then
    raise exception 'Organization access must be ADMIN or MEMBER.';
  end if;

  if team_count = 0 then
    raise exception 'Choose at least one team.';
  end if;

  for idx in 1..team_count loop
    select t.organization_id into team_org_id
    from public.teams as t
    where t.id = invite_team_ids[idx]
      and t.active = true;

    if team_org_id is null then
      raise exception 'One invited team was not found.';
    end if;

    if target_org_id is null then
      target_org_id := team_org_id;
    elsif target_org_id <> team_org_id then
      raise exception 'Invitations must stay inside one organization.';
    end if;

    if not public.current_profile_can_admin_team(invite_team_ids[idx]) then
      raise exception 'You do not have permission to invite staff for this team.';
    end if;

    if season_count >= idx and invite_season_ids[idx] is not null then
      assignment_season_id := invite_season_ids[idx];
      if not exists (
        select 1
        from public.seasons as s
        where s.id = assignment_season_id
          and s.team_id = invite_team_ids[idx]
          and (
            s.organization_id = team_org_id
            or (s.organization_id is null and team_org_id is null)
          )
      ) then
        raise exception 'One invited season does not belong to its team.';
      end if;
    end if;
  end loop;

  display_name_value := nullif(trim(concat_ws(' ', invite_first_name, invite_last_name)), '');
  if display_name_value is null then
    display_name_value := normalized_email;
  end if;

  select sm.id into existing_staff_id
  from public.staff_members as sm
  where sm.organization_id = target_org_id
    and lower(sm.email) = normalized_email
  limit 1;

  if existing_staff_id is null then
    insert into public.staff_members (
      organization_id,
      email,
      first_name,
      last_name,
      display_name,
      active
    )
    values (
      target_org_id,
      normalized_email,
      nullif(trim(invite_first_name), ''),
      nullif(trim(invite_last_name), ''),
      display_name_value,
      true
    )
    returning id into existing_staff_id;
  else
    update public.staff_members as sm
    set
      email = normalized_email,
      first_name = coalesce(nullif(trim(invite_first_name), ''), sm.first_name),
      last_name = coalesce(nullif(trim(invite_last_name), ''), sm.last_name),
      display_name = case when sm.display_name = sm.email or sm.display_name is null then display_name_value else sm.display_name end,
      active = true,
      updated_at = now()
    where sm.id = existing_staff_id;
  end if;

  insert into public.team_invitations (
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
  values (
    target_org_id,
    normalized_email,
    inviter_id,
    'STAFF',
    existing_staff_id,
    'PENDING',
    invite_token_hash,
    normalized_staff_role,
    normalized_access_role,
    normalized_org_role,
    invite_expires_at
  )
  returning id into new_invitation_id;

  for idx in 1..team_count loop
    assignment_season_id := null;
    if season_count >= idx then
      assignment_season_id := invite_season_ids[idx];
    end if;

    insert into public.team_invitation_memberships (
      invitation_id,
      team_id,
      season_id,
      staff_role,
      access_role
    )
    values (
      new_invitation_id,
      invite_team_ids[idx],
      assignment_season_id,
      normalized_staff_role,
      normalized_access_role
    );

    insert into public.staff_team_memberships (
      staff_member_id,
      team_id,
      season_id,
      baseball_role,
      access_role,
      active,
      invitation_id
    )
    values (
      existing_staff_id,
      invite_team_ids[idx],
      assignment_season_id,
      normalized_staff_role,
      normalized_access_role,
      true,
      new_invitation_id
    )
    on conflict (staff_member_id, team_id, season_id)
    do update set
      baseball_role = excluded.baseball_role,
      access_role = excluded.access_role,
      active = true,
      invitation_id = excluded.invitation_id,
      updated_at = now();
  end loop;

  return new_invitation_id;
end;
$$;

create or replace function public.accept_staff_invitation(invite_token_hash text)
returns table(invitation_id uuid, staff_member_id uuid, memberships_created integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepting_profile_id uuid := auth.uid();
  v_invitation public.team_invitations%rowtype;
  v_accepting_email text;
  v_linked_staff_member_id uuid;
  v_memberships_created integer := 0;
  v_assignment record;
  v_org_membership_role public.membership_role;
begin
  if v_accepting_profile_id is null then
    raise exception 'Sign in before accepting this invitation.';
  end if;

  select ti.*
  into v_invitation
  from public.team_invitations as ti
  where ti.token_hash = invite_token_hash
  for update;

  if not found then
    raise exception 'This invitation link is invalid.';
  end if;

  if v_invitation.status in ('ACCEPTED', 'REVOKED') then
    raise exception 'This invitation is no longer available.';
  end if;

  if v_invitation.expires_at <= now() then
    update public.team_invitations as ti
    set status = 'EXPIRED',
        updated_at = now()
    where ti.id = v_invitation.id;

    raise exception 'This invitation has expired.';
  end if;

  select lower(p.email)
  into v_accepting_email
  from public.profiles as p
  where p.id = v_accepting_profile_id;

  if v_accepting_email is null then
    raise exception 'Create your profile before accepting this invitation.';
  end if;

  if lower(v_invitation.email) <> v_accepting_email then
    raise exception 'Sign in with the invited email address to accept this invitation.';
  end if;

  v_org_membership_role := case
    when upper(coalesce(v_invitation.org_role, 'MEMBER')) = 'ADMIN' then 'ADMIN'::public.membership_role
    else 'COACH'::public.membership_role
  end;

  insert into public.organization_memberships (
    organization_id,
    profile_id,
    role,
    active
  )
  values (
    v_invitation.organization_id,
    v_accepting_profile_id,
    v_org_membership_role,
    true
  )
  on conflict (organization_id, profile_id)
  do update set
    role = case
      when public.organization_memberships.role = 'ADMIN'::public.membership_role
        or excluded.role = 'ADMIN'::public.membership_role
      then 'ADMIN'::public.membership_role
      else excluded.role
    end,
    active = true,
    updated_at = now();

  select sm.id
  into v_linked_staff_member_id
  from public.staff_members as sm
  where sm.organization_id = v_invitation.organization_id
    and sm.profile_id = v_accepting_profile_id
  limit 1;

  if v_linked_staff_member_id is null then
    v_linked_staff_member_id := v_invitation.staff_member_id;

    if v_linked_staff_member_id is null then
      raise exception 'This invitation is missing its staff record.';
    end if;

    update public.staff_members as sm
    set profile_id = v_accepting_profile_id,
        email = v_accepting_email,
        active = true,
        updated_at = now()
    where sm.id = v_linked_staff_member_id;
  else
    update public.staff_members as sm
    set email = v_accepting_email,
        active = true,
        updated_at = now()
    where sm.id = v_linked_staff_member_id;

    if v_invitation.staff_member_id is not null and v_invitation.staff_member_id <> v_linked_staff_member_id then
      update public.staff_members as sm
      set active = false,
          updated_at = now()
      where sm.id = v_invitation.staff_member_id
        and sm.profile_id is null;
    end if;
  end if;

  for v_assignment in
    select
      tim.team_id,
      tim.season_id,
      tim.staff_role,
      tim.access_role
    from public.team_invitation_memberships as tim
    where tim.invitation_id = v_invitation.id
  loop
    update public.profile_team_memberships as ptm
    set role = v_assignment.access_role,
        title = v_assignment.staff_role,
        active = true,
        updated_at = now()
    where ptm.profile_id = v_accepting_profile_id
      and ptm.team_id = v_assignment.team_id
      and (
        ptm.season_id = v_assignment.season_id
        or (ptm.season_id is null and v_assignment.season_id is null)
      );

    if not found then
      insert into public.profile_team_memberships (
        profile_id,
        team_id,
        season_id,
        role,
        title,
        active
      )
      values (
        v_accepting_profile_id,
        v_assignment.team_id,
        v_assignment.season_id,
        v_assignment.access_role,
        v_assignment.staff_role,
        true
      );
    end if;

    update public.staff_team_memberships as stm
    set profile_id = v_accepting_profile_id,
        baseball_role = v_assignment.staff_role,
        access_role = v_assignment.access_role,
        active = true,
        invitation_id = v_invitation.id,
        updated_at = now()
    where stm.staff_member_id = v_linked_staff_member_id
      and stm.team_id = v_assignment.team_id
      and (
        stm.season_id = v_assignment.season_id
        or (stm.season_id is null and v_assignment.season_id is null)
      );

    if not found then
      insert into public.staff_team_memberships (
        staff_member_id,
        profile_id,
        team_id,
        season_id,
        baseball_role,
        access_role,
        active,
        invitation_id
      )
      values (
        v_linked_staff_member_id,
        v_accepting_profile_id,
        v_assignment.team_id,
        v_assignment.season_id,
        v_assignment.staff_role,
        v_assignment.access_role,
        true,
        v_invitation.id
      );
    end if;

    v_memberships_created := v_memberships_created + 1;
  end loop;

  update public.team_invitations as ti
  set staff_member_id = v_linked_staff_member_id,
      status = 'ACCEPTED',
      accepted_at = now(),
      updated_at = now()
  where ti.id = v_invitation.id;

  return query
  select
    v_invitation.id::uuid,
    v_linked_staff_member_id::uuid,
    v_memberships_created::integer;
end;
$$;

revoke all on function public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[], text) from public, anon;
grant execute on function public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[], text) to authenticated;
revoke all on function public.accept_staff_invitation(text) from public, anon;
grant execute on function public.accept_staff_invitation(text) to authenticated;

commit;
