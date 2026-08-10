begin;

create or replace function public.current_profile_can_read_team(target_team_id uuid)
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
  )
  or exists (
    select 1
    from public.teams t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = target_team_id
      and om.profile_id = auth.uid()
      and om.active = true
      and om.role in ('ADMIN', 'COACH')
  );
$$;

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
      and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
  )
  or exists (
    select 1
    from public.teams t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = target_team_id
      and om.profile_id = auth.uid()
      and om.active = true
      and om.role in ('ADMIN', 'COACH')
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
      and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH')
  )
  or exists (
    select 1
    from public.teams t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = target_team_id
      and om.profile_id = auth.uid()
      and om.active = true
      and om.role = 'ADMIN'
  );
$$;

create or replace function public.current_profile_can_access_org(target_org_id uuid)
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
  )
  or exists (
    select 1
    from public.profile_team_memberships ptm
    join public.teams t on t.id = ptm.team_id
    where t.organization_id = target_org_id
      and ptm.profile_id = auth.uid()
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
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_org_id
      and om.profile_id = auth.uid()
      and om.active = true
      and om.role in ('ADMIN', 'COACH')
  )
  or exists (
    select 1
    from public.profile_team_memberships ptm
    join public.teams t on t.id = ptm.team_id
    where t.organization_id = target_org_id
      and ptm.profile_id = auth.uid()
      and ptm.active = true
      and ptm.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
  );
$$;

create or replace function public.player_matches_team_context(target_player_id uuid, target_team_id uuid, target_season_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    join public.teams t on t.id = target_team_id
    left join public.seasons s on s.id = target_season_id
    where p.id = target_player_id
      and p.organization_id = t.organization_id
      and (
        target_season_id is null
        or (s.team_id = target_team_id and s.organization_id = t.organization_id)
      )
  );
$$;

create or replace function public.current_profile_can_read_player(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and public.current_profile_can_manage_org(p.organization_id)
  )
  or exists (
    select 1
    from public.player_team_memberships player_membership
    join public.profile_team_memberships staff_membership
      on staff_membership.team_id = player_membership.team_id
    where player_membership.player_id = target_player_id
      and player_membership.active = true
      and staff_membership.profile_id = auth.uid()
      and staff_membership.active = true
  );
$$;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_can_read_team(target_team_id);
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

create or replace function public.is_org_team_staff(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_can_manage_org(target_org_id);
$$;

create or replace function public.is_player_staff(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and public.current_profile_can_manage_org(p.organization_id)
  );
$$;

revoke all on function public.current_profile_can_read_team(uuid) from public, anon;
revoke all on function public.current_profile_can_manage_team(uuid) from public, anon;
revoke all on function public.current_profile_can_admin_team(uuid) from public, anon;
revoke all on function public.current_profile_can_access_org(uuid) from public, anon;
revoke all on function public.current_profile_can_manage_org(uuid) from public, anon;
revoke all on function public.player_matches_team_context(uuid, uuid, uuid) from public, anon;
revoke all on function public.current_profile_can_read_player(uuid) from public, anon;
revoke all on function public.is_team_member(uuid) from public, anon;
revoke all on function public.is_team_staff(uuid) from public, anon;
revoke all on function public.is_team_admin(uuid) from public, anon;
revoke all on function public.is_org_team_staff(uuid) from public, anon;
revoke all on function public.is_player_staff(uuid) from public, anon;

grant execute on function public.current_profile_can_read_team(uuid) to authenticated;
grant execute on function public.current_profile_can_manage_team(uuid) to authenticated;
grant execute on function public.current_profile_can_admin_team(uuid) to authenticated;
grant execute on function public.current_profile_can_access_org(uuid) to authenticated;
grant execute on function public.current_profile_can_manage_org(uuid) to authenticated;
grant execute on function public.player_matches_team_context(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_profile_can_read_player(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_staff(uuid) to authenticated;
grant execute on function public.is_team_admin(uuid) to authenticated;
grant execute on function public.is_org_team_staff(uuid) to authenticated;
grant execute on function public.is_player_staff(uuid) to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('players', 'player_team_memberships', 'profile_team_memberships')
      and policyname like 'metrolina_%'
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy metrolina_players_select_authorized on public.players
  for select to authenticated
  using (public.current_profile_can_read_player(id));

create policy metrolina_players_staff_insert on public.players
  for insert to authenticated
  with check (public.current_profile_can_manage_org(organization_id));

create policy metrolina_players_staff_update on public.players
  for update to authenticated
  using (public.current_profile_can_manage_org(organization_id))
  with check (public.current_profile_can_manage_org(organization_id));

create policy metrolina_players_staff_delete on public.players
  for delete to authenticated
  using (public.current_profile_can_manage_org(organization_id));

create policy metrolina_profile_team_memberships_select_authorized on public.profile_team_memberships
  for select to authenticated
  using (profile_id = auth.uid() or public.current_profile_can_manage_team(team_id));

create policy metrolina_profile_team_memberships_insert_admin on public.profile_team_memberships
  for insert to authenticated
  with check (public.current_profile_can_admin_team(team_id));

create policy metrolina_profile_team_memberships_update_admin on public.profile_team_memberships
  for update to authenticated
  using (public.current_profile_can_admin_team(team_id))
  with check (public.current_profile_can_admin_team(team_id));

create policy metrolina_profile_team_memberships_delete_admin on public.profile_team_memberships
  for delete to authenticated
  using (public.current_profile_can_admin_team(team_id));

create policy metrolina_player_team_memberships_select_authorized on public.player_team_memberships
  for select to authenticated
  using (public.current_profile_can_read_team(team_id));

create policy metrolina_player_team_memberships_insert_staff on public.player_team_memberships
  for insert to authenticated
  with check (
    public.current_profile_can_manage_team(team_id)
    and public.player_matches_team_context(player_id, team_id, season_id)
  );

create policy metrolina_player_team_memberships_update_staff on public.player_team_memberships
  for update to authenticated
  using (public.current_profile_can_manage_team(team_id))
  with check (
    public.current_profile_can_manage_team(team_id)
    and public.player_matches_team_context(player_id, team_id, season_id)
  );

create policy metrolina_player_team_memberships_delete_staff on public.player_team_memberships
  for delete to authenticated
  using (public.current_profile_can_manage_team(team_id));

commit;
