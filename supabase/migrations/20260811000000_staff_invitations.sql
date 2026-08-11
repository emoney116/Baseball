begin;

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  email text,
  first_name text,
  last_name text,
  display_name text not null,
  avatar_url text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_members_organization_id_idx on public.staff_members(organization_id);
create index if not exists staff_members_profile_id_idx on public.staff_members(profile_id);
create unique index if not exists staff_members_org_profile_key
  on public.staff_members(organization_id, profile_id)
  where profile_id is not null;
create unique index if not exists staff_members_org_email_key
  on public.staff_members(organization_id, lower(email))
  where email is not null;

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  invite_type text not null default 'STAFF' check (invite_type in ('STAFF', 'PLAYER')),
  staff_member_id uuid references public.staff_members(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  token_hash text not null unique,
  staff_role text not null default 'Assistant Coach',
  access_role text not null default 'COACH' check (access_role in ('ADMIN', 'COACH')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_invitations_organization_id_idx on public.team_invitations(organization_id);
create index if not exists team_invitations_staff_member_id_idx on public.team_invitations(staff_member_id);
create index if not exists team_invitations_email_idx on public.team_invitations(lower(email));
create index if not exists team_invitations_status_idx on public.team_invitations(status);

create table if not exists public.team_invitation_memberships (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.team_invitations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  staff_role text not null default 'Assistant Coach',
  access_role text not null default 'COACH' check (access_role in ('ADMIN', 'COACH')),
  created_at timestamptz not null default now(),
  unique(invitation_id, team_id, season_id)
);

create index if not exists team_invitation_memberships_invitation_id_idx on public.team_invitation_memberships(invitation_id);
create index if not exists team_invitation_memberships_team_id_idx on public.team_invitation_memberships(team_id);

create table if not exists public.staff_team_memberships (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  baseball_role text not null default 'Assistant Coach',
  access_role text not null default 'COACH' check (access_role in ('ADMIN', 'COACH')),
  active boolean not null default true,
  invitation_id uuid references public.team_invitations(id) on delete set null,
  start_date date,
  end_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_member_id, team_id, season_id)
);

create index if not exists staff_team_memberships_staff_member_id_idx on public.staff_team_memberships(staff_member_id);
create index if not exists staff_team_memberships_profile_id_idx on public.staff_team_memberships(profile_id);
create index if not exists staff_team_memberships_team_id_idx on public.staff_team_memberships(team_id);
create index if not exists staff_team_memberships_invitation_id_idx on public.staff_team_memberships(invitation_id);

alter table public.staff_members enable row level security;
alter table public.staff_team_memberships enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_invitation_memberships enable row level security;

create or replace function public.current_profile_can_admin_org(target_org_id uuid)
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
      and upper(om.role::text) = 'ADMIN'
  )
  or exists (
    select 1
    from public.profile_team_memberships ptm
    join public.teams t on t.id = ptm.team_id
    where t.organization_id = target_org_id
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
    join public.teams t on t.id = ptm.team_id
    where p.id = auth.uid()
      and upper(p.role::text) = 'ADMIN'
      and t.organization_id = target_org_id
      and ptm.active = true
  );
$$;

create or replace function public.current_profile_can_view_staff_member(target_staff_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members sm
    where sm.id = target_staff_member_id
      and public.current_profile_can_manage_org(sm.organization_id)
  )
  or exists (
    select 1
    from public.staff_team_memberships stm
    where stm.staff_member_id = target_staff_member_id
      and stm.active = true
      and public.current_profile_can_manage_team(stm.team_id)
  );
$$;

create or replace function public.current_profile_can_admin_invitation(target_invitation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_invitations ti
    where ti.id = target_invitation_id
      and public.current_profile_can_admin_org(ti.organization_id)
  )
  or (
    exists (
      select 1
      from public.team_invitation_memberships tim
      where tim.invitation_id = target_invitation_id
    )
    and not exists (
      select 1
      from public.team_invitation_memberships tim
      where tim.invitation_id = target_invitation_id
        and not public.current_profile_can_admin_team(tim.team_id)
    )
  );
$$;

drop policy if exists metrolina_staff_members_select on public.staff_members;
create policy metrolina_staff_members_select on public.staff_members
  for select to authenticated
  using (public.current_profile_can_view_staff_member(id));

drop policy if exists metrolina_staff_members_admin_insert on public.staff_members;
create policy metrolina_staff_members_admin_insert on public.staff_members
  for insert to authenticated
  with check (public.current_profile_can_admin_org(organization_id));

drop policy if exists metrolina_staff_members_admin_update on public.staff_members;
create policy metrolina_staff_members_admin_update on public.staff_members
  for update to authenticated
  using (public.current_profile_can_admin_org(organization_id) or public.current_profile_can_view_staff_member(id))
  with check (public.current_profile_can_admin_org(organization_id));

drop policy if exists metrolina_staff_members_admin_delete on public.staff_members;
create policy metrolina_staff_members_admin_delete on public.staff_members
  for delete to authenticated
  using (public.current_profile_can_admin_org(organization_id));

drop policy if exists metrolina_staff_team_memberships_select on public.staff_team_memberships;
create policy metrolina_staff_team_memberships_select on public.staff_team_memberships
  for select to authenticated
  using (public.current_profile_can_manage_team(team_id));

drop policy if exists metrolina_staff_team_memberships_admin_insert on public.staff_team_memberships;
create policy metrolina_staff_team_memberships_admin_insert on public.staff_team_memberships
  for insert to authenticated
  with check (public.current_profile_can_admin_team(team_id));

drop policy if exists metrolina_staff_team_memberships_admin_update on public.staff_team_memberships;
create policy metrolina_staff_team_memberships_admin_update on public.staff_team_memberships
  for update to authenticated
  using (public.current_profile_can_admin_team(team_id))
  with check (public.current_profile_can_admin_team(team_id));

drop policy if exists metrolina_staff_team_memberships_admin_delete on public.staff_team_memberships;
create policy metrolina_staff_team_memberships_admin_delete on public.staff_team_memberships
  for delete to authenticated
  using (public.current_profile_can_admin_team(team_id));

drop policy if exists metrolina_team_invitations_select on public.team_invitations;
create policy metrolina_team_invitations_select on public.team_invitations
  for select to authenticated
  using (public.current_profile_can_admin_invitation(id));

drop policy if exists metrolina_team_invitations_admin_insert on public.team_invitations;
create policy metrolina_team_invitations_admin_insert on public.team_invitations
  for insert to authenticated
  with check (public.current_profile_can_admin_org(organization_id));

drop policy if exists metrolina_team_invitations_admin_update on public.team_invitations;
create policy metrolina_team_invitations_admin_update on public.team_invitations
  for update to authenticated
  using (public.current_profile_can_admin_invitation(id))
  with check (public.current_profile_can_admin_org(organization_id));

drop policy if exists metrolina_team_invitation_memberships_select on public.team_invitation_memberships;
create policy metrolina_team_invitation_memberships_select on public.team_invitation_memberships
  for select to authenticated
  using (public.current_profile_can_admin_team(team_id));

drop policy if exists metrolina_team_invitation_memberships_admin_insert on public.team_invitation_memberships;
create policy metrolina_team_invitation_memberships_admin_insert on public.team_invitation_memberships
  for insert to authenticated
  with check (public.current_profile_can_admin_team(team_id));

drop policy if exists metrolina_team_invitation_memberships_admin_update on public.team_invitation_memberships;
create policy metrolina_team_invitation_memberships_admin_update on public.team_invitation_memberships
  for update to authenticated
  using (public.current_profile_can_admin_team(team_id))
  with check (public.current_profile_can_admin_team(team_id));

drop policy if exists metrolina_team_invitation_memberships_admin_delete on public.team_invitation_memberships;
create policy metrolina_team_invitation_memberships_admin_delete on public.team_invitation_memberships
  for delete to authenticated
  using (public.current_profile_can_admin_team(team_id));

create or replace function public.create_staff_invitation(
  invite_email text,
  invite_first_name text,
  invite_last_name text,
  invite_staff_role text,
  invite_access_role text,
  invite_token_hash text,
  invite_expires_at timestamptz,
  invite_team_ids uuid[],
  invite_season_ids uuid[] default array[]::uuid[]
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

  if team_count = 0 then
    raise exception 'Choose at least one team.';
  end if;

  for idx in 1..team_count loop
    select t.organization_id into team_org_id
    from public.teams t
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
        from public.seasons s
        where s.id = assignment_season_id
          and s.team_id = invite_team_ids[idx]
          and s.organization_id = team_org_id
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
  from public.staff_members sm
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
    update public.staff_members
    set
      email = normalized_email,
      first_name = coalesce(nullif(trim(invite_first_name), ''), first_name),
      last_name = coalesce(nullif(trim(invite_last_name), ''), last_name),
      display_name = case when display_name = email or display_name is null then display_name_value else display_name end,
      active = true,
      updated_at = now()
    where id = existing_staff_id;
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
  accepting_profile_id uuid := auth.uid();
  invitation_row public.team_invitations%rowtype;
  accepting_email text;
  linked_staff_id uuid;
  created_count integer := 0;
  assignment record;
begin
  if accepting_profile_id is null then
    raise exception 'Sign in before accepting this invitation.';
  end if;

  select * into invitation_row
  from public.team_invitations
  where token_hash = invite_token_hash
  for update;

  if not found then
    raise exception 'This invitation link is invalid.';
  end if;

  if invitation_row.status in ('ACCEPTED', 'REVOKED') then
    raise exception 'This invitation is no longer available.';
  end if;

  if invitation_row.expires_at <= now() then
    update public.team_invitations
    set status = 'EXPIRED', updated_at = now()
    where id = invitation_row.id;
    raise exception 'This invitation has expired.';
  end if;

  select lower(email) into accepting_email
  from public.profiles
  where id = accepting_profile_id;

  if accepting_email is null then
    raise exception 'Create your profile before accepting this invitation.';
  end if;

  if lower(invitation_row.email) <> accepting_email then
    raise exception 'Sign in with the invited email address to accept this invitation.';
  end if;

  select sm.id into linked_staff_id
  from public.staff_members sm
  where sm.organization_id = invitation_row.organization_id
    and sm.profile_id = accepting_profile_id
  limit 1;

  if linked_staff_id is null then
    linked_staff_id := invitation_row.staff_member_id;
    update public.staff_members
    set
      profile_id = accepting_profile_id,
      email = accepting_email,
      active = true,
      updated_at = now()
    where id = linked_staff_id;
  else
    update public.staff_members
    set
      email = accepting_email,
      active = true,
      updated_at = now()
    where id = linked_staff_id;

    if invitation_row.staff_member_id is not null and invitation_row.staff_member_id <> linked_staff_id then
      update public.staff_members
      set active = false, updated_at = now()
      where id = invitation_row.staff_member_id
        and profile_id is null;
    end if;
  end if;

  for assignment in
    select team_id, season_id, staff_role, access_role
    from public.team_invitation_memberships
    where invitation_id = invitation_row.id
  loop
    update public.profile_team_memberships
    set
      role = assignment.access_role,
      title = assignment.staff_role,
      active = true,
      updated_at = now()
    where profile_id = accepting_profile_id
      and team_id = assignment.team_id
      and (
        season_id = assignment.season_id
        or (season_id is null and assignment.season_id is null)
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
        accepting_profile_id,
        assignment.team_id,
        assignment.season_id,
        assignment.access_role,
        assignment.staff_role,
        true
      );
    end if;

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
      linked_staff_id,
      accepting_profile_id,
      assignment.team_id,
      assignment.season_id,
      assignment.staff_role,
      assignment.access_role,
      true,
      invitation_row.id
    )
    on conflict (staff_member_id, team_id, season_id)
    do update set
      profile_id = excluded.profile_id,
      baseball_role = excluded.baseball_role,
      access_role = excluded.access_role,
      active = true,
      invitation_id = excluded.invitation_id,
      updated_at = now();

    created_count := created_count + 1;
  end loop;

  update public.team_invitations
  set
    staff_member_id = linked_staff_id,
    status = 'ACCEPTED',
    accepted_at = now(),
    updated_at = now()
  where id = invitation_row.id;

  return query select invitation_row.id, linked_staff_id, created_count;
end;
$$;

create or replace function public.revoke_staff_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before changing invitations.';
  end if;

  if not public.current_profile_can_admin_invitation(target_invitation_id) then
    raise exception 'You do not have permission to change this invitation.';
  end if;

  update public.team_invitations
  set status = 'REVOKED', updated_at = now()
  where id = target_invitation_id
    and status in ('PENDING', 'EXPIRED');

  update public.staff_team_memberships
  set invitation_id = null, updated_at = now()
  where invitation_id = target_invitation_id
    and profile_id is null;
end;
$$;

create or replace function public.refresh_staff_invitation(
  target_invitation_id uuid,
  new_token_hash text,
  new_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before changing invitations.';
  end if;

  if not public.current_profile_can_admin_invitation(target_invitation_id) then
    raise exception 'You do not have permission to change this invitation.';
  end if;

  update public.team_invitations
  set
    status = 'PENDING',
    token_hash = new_token_hash,
    expires_at = new_expires_at,
    accepted_at = null,
    updated_at = now()
  where id = target_invitation_id
    and status in ('PENDING', 'EXPIRED', 'REVOKED');
end;
$$;

do $$
declare
  trigger_table text;
begin
  foreach trigger_table in array array[
    'staff_members',
    'staff_team_memberships',
    'team_invitations'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || trigger_table || '_updated_at', trigger_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || trigger_table || '_updated_at',
      trigger_table
    );
  end loop;
end $$;

revoke all on function public.current_profile_can_admin_org(uuid) from public, anon;
revoke all on function public.current_profile_can_view_staff_member(uuid) from public, anon;
revoke all on function public.current_profile_can_admin_invitation(uuid) from public, anon;
revoke all on function public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[]) from public, anon;
revoke all on function public.accept_staff_invitation(text) from public, anon;
revoke all on function public.revoke_staff_invitation(uuid) from public, anon;
revoke all on function public.refresh_staff_invitation(uuid, text, timestamptz) from public, anon;

grant execute on function public.current_profile_can_admin_org(uuid) to authenticated;
grant execute on function public.current_profile_can_view_staff_member(uuid) to authenticated;
grant execute on function public.current_profile_can_admin_invitation(uuid) to authenticated;
grant execute on function public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[]) to authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;
grant execute on function public.revoke_staff_invitation(uuid) to authenticated;
grant execute on function public.refresh_staff_invitation(uuid, text, timestamptz) to authenticated;

commit;
