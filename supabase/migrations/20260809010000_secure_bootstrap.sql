alter table if exists public.organizations
  add column if not exists bootstrap_completed_at timestamptz;

create or replace function public.prevent_bootstrap_reopen()
returns trigger
language plpgsql
as $$
begin
  if old.bootstrap_completed_at is not null
    and new.bootstrap_completed_at is distinct from old.bootstrap_completed_at then
    raise exception 'Organization bootstrap cannot be reopened.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_organizations_bootstrap_reopen on public.organizations;
create trigger prevent_organizations_bootstrap_reopen
  before update on public.organizations
  for each row
  execute function public.prevent_bootstrap_reopen();

drop function if exists public.claim_initial_metrolina_admin();

create or replace function public.bootstrap_metrolina_admin(
  target_profile_id uuid,
  target_email text,
  target_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
  bootstrap_completed timestamptz;
begin
  if target_profile_id is null then
    raise exception 'A profile id is required.';
  end if;

  if nullif(trim(target_email), '') is null then
    raise exception 'An email address is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('metrolina-initial-admin-bootstrap'));

  select id, bootstrap_completed_at into target_org_id, bootstrap_completed
  from public.organizations
  where slug = 'metrolina-christian-academy'
  for update;

  if target_org_id is null then
    raise exception 'Metrolina organization seed is missing.';
  end if;

  if bootstrap_completed is not null then
    raise exception 'Initial admin bootstrap is already closed.';
  end if;

  if exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org_id
      and active = true
      and role = 'ADMIN'
  ) then
    raise exception 'Initial admin bootstrap is already closed.';
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (target_profile_id, lower(trim(target_email)), coalesce(nullif(trim(target_display_name), ''), lower(trim(target_email))), 'ADMIN')
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        role = 'ADMIN',
        updated_at = now();

  insert into public.organization_memberships (organization_id, profile_id, role, active)
  values (target_org_id, target_profile_id, 'ADMIN', true)
  on conflict (organization_id, profile_id) do update
    set role = 'ADMIN',
        active = true,
        updated_at = now();

  update public.organizations
  set bootstrap_completed_at = now(),
      updated_at = now()
  where id = target_org_id;

  return target_org_id;
end;
$$;

revoke all on function public.bootstrap_metrolina_admin(uuid, text, text) from public;
grant execute on function public.bootstrap_metrolina_admin(uuid, text, text) to service_role;

create or replace function public.is_org_admin(target_org_id uuid)
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
      and om.role = 'ADMIN'
  );
$$;

drop policy if exists metrolina_memberships_staff_write on public.organization_memberships;
drop policy if exists metrolina_memberships_admin_write on public.organization_memberships;
create policy metrolina_memberships_admin_write on public.organization_memberships
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
