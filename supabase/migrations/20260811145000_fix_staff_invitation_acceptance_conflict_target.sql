begin;

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

revoke all on function public.accept_staff_invitation(text) from public, anon;
grant execute on function public.accept_staff_invitation(text) to authenticated;

commit;
