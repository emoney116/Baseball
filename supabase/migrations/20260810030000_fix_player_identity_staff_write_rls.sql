begin;

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
      and upper(ptm.role::text) in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
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
      and public.current_profile_can_write_player_org(p.organization_id)
  );
$$;

revoke all on function public.current_profile_can_write_player_org(uuid) from public, anon;
revoke all on function public.current_profile_can_manage_org(uuid) from public, anon;
revoke all on function public.is_org_team_staff(uuid) from public, anon;
revoke all on function public.is_player_staff(uuid) from public, anon;

grant execute on function public.current_profile_can_write_player_org(uuid) to authenticated;
grant execute on function public.current_profile_can_manage_org(uuid) to authenticated;
grant execute on function public.is_org_team_staff(uuid) to authenticated;
grant execute on function public.is_player_staff(uuid) to authenticated;

drop policy if exists metrolina_players_staff_insert on public.players;
drop policy if exists metrolina_players_staff_update on public.players;
drop policy if exists metrolina_players_staff_delete on public.players;

create policy metrolina_players_staff_insert on public.players
  for insert to authenticated
  with check (public.current_profile_can_write_player_org(organization_id));

create policy metrolina_players_staff_update on public.players
  for update to authenticated
  using (public.current_profile_can_write_player_org(organization_id))
  with check (public.current_profile_can_write_player_org(organization_id));

create policy metrolina_players_staff_delete on public.players
  for delete to authenticated
  using (public.current_profile_can_write_player_org(organization_id));

commit;
