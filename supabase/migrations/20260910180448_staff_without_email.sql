create or replace function public.create_staff_without_invitation(
  staff_first_name text,
  staff_last_name text,
  staff_email text,
  staff_role text,
  staff_access_role text,
  staff_team_ids uuid[],
  staff_season_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  team_org uuid;
  member_id uuid;
  i integer;
  email_value text := nullif(lower(trim(staff_email)), '');
  name_value text := nullif(trim(concat_ws(' ', staff_first_name, staff_last_name)), '');
begin
  if auth.uid() is null then raise exception 'Sign in before adding staff.'; end if;
  if name_value is null then raise exception 'Enter a staff name.'; end if;
  if email_value is not null and email_value !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email or leave it blank.';
  end if;
  if staff_access_role is null or staff_access_role not in ('ADMIN', 'COACH') then raise exception 'Invalid access role.'; end if;
  if coalesce(array_length(staff_team_ids, 1), 0) = 0 then raise exception 'Choose at least one team.'; end if;
  for i in 1..array_length(staff_team_ids, 1) loop
    select organization_id into team_org from public.teams where id = staff_team_ids[i] and active;
    if team_org is null then raise exception 'Team not found.'; end if;
    if not public.current_profile_can_admin_team(staff_team_ids[i]) then raise exception 'You do not have permission to manage staff for this team.'; end if;
    if org_id is not null and org_id <> team_org then raise exception 'Staff must stay inside one organization.'; end if;
    org_id := team_org;
    if staff_season_ids[i] is not null and not exists (select 1 from public.seasons where id = staff_season_ids[i] and team_id = staff_team_ids[i]) then
      raise exception 'Season does not belong to this team.';
    end if;
  end loop;
  if email_value is not null and exists (select 1 from public.staff_members where organization_id = org_id and lower(email) = email_value) then
    raise exception 'This email already belongs to a staff member. Edit that staff member instead.';
  end if;
  insert into public.staff_members (organization_id, first_name, last_name, display_name, email)
    values (org_id, nullif(trim(staff_first_name), ''), nullif(trim(staff_last_name), ''), name_value, email_value) returning id into member_id;
  for i in 1..array_length(staff_team_ids, 1) loop
    insert into public.staff_team_memberships (staff_member_id, team_id, season_id, baseball_role, access_role)
      values (member_id, staff_team_ids[i], staff_season_ids[i], coalesce(nullif(trim(staff_role), ''), 'Assistant Coach'), staff_access_role)
      on conflict (staff_member_id, team_id, season_id) do nothing;
  end loop;
  return member_id;
end;
$$;
revoke all on function public.create_staff_without_invitation(text,text,text,text,text,uuid[],uuid[]) from public, anon;
grant execute on function public.create_staff_without_invitation(text,text,text,text,text,uuid[],uuid[]) to authenticated;
