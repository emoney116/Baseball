begin;

do $$ begin
  create type public.player_link_relationship_type as enum ('PLAYER', 'PARENT', 'GUARDIAN');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.player_link_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.player_link_source as enum ('SELF_CLAIM', 'COACH_INVITE');
exception when duplicate_object then null;
end $$;

create table if not exists public.profile_player_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  claim_player_team_membership_id uuid not null references public.player_team_memberships(id) on delete restrict,
  claim_team_id uuid not null references public.teams(id) on delete restrict,
  claim_season_id uuid references public.seasons(id) on delete set null,
  relationship_type public.player_link_relationship_type not null default 'PLAYER',
  status public.player_link_status not null default 'PENDING',
  source public.player_link_source not null default 'SELF_CLAIM',
  request_message text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  rejected_by_profile_id uuid references public.profiles(id) on delete set null,
  revoked_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(coalesce(request_message, '')) <= 500)
);

create index if not exists profile_player_links_profile_id_idx
  on public.profile_player_links(profile_id);
create index if not exists profile_player_links_player_id_idx
  on public.profile_player_links(player_id);
create index if not exists profile_player_links_claim_team_status_idx
  on public.profile_player_links(claim_team_id, status, requested_at desc);
create index if not exists profile_player_links_claim_membership_idx
  on public.profile_player_links(claim_player_team_membership_id);

create unique index if not exists profile_player_links_one_open_request_idx
  on public.profile_player_links(profile_id, player_id, relationship_type)
  where status in ('PENDING', 'APPROVED');

create unique index if not exists profile_player_links_one_active_self_account_idx
  on public.profile_player_links(player_id)
  where relationship_type = 'PLAYER' and status = 'APPROVED';

create or replace function public.player_link_claim_target_is_valid(
  target_player_id uuid,
  target_membership_id uuid,
  target_team_id uuid,
  target_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.player_team_memberships membership
    join public.players player on player.id = membership.player_id
    join public.teams team on team.id = membership.team_id
    join public.organizations organization on organization.id = team.organization_id
    left join public.seasons season on season.id = membership.season_id
    where membership.id = target_membership_id
      and membership.player_id = target_player_id
      and membership.team_id = target_team_id
      and membership.season_id is not distinct from target_season_id
      and membership.active = true
      and player.active = true
      and team.active = true
      and coalesce(season.active, true) = true
      and organization.visibility in ('PUBLIC', 'UNLISTED')
  );
$$;

revoke all on function public.player_link_claim_target_is_valid(uuid, uuid, uuid, uuid) from public;
grant execute on function public.player_link_claim_target_is_valid(uuid, uuid, uuid, uuid) to authenticated;

create or replace function public.current_profile_can_review_player_link_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_team_memberships membership
    where membership.profile_id = auth.uid()
      and membership.team_id = target_team_id
      and membership.active = true
      and membership.role in ('OWNER', 'ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'STAFF', 'COACH')
  )
  or exists (
    select 1
    from public.teams team
    join public.organization_memberships organization_membership
      on organization_membership.organization_id = team.organization_id
    where team.id = target_team_id
      and organization_membership.profile_id = auth.uid()
      and organization_membership.active = true
      and organization_membership.role = 'ADMIN'
  );
$$;

revoke all on function public.current_profile_can_review_player_link_team(uuid) from public, anon;
grant execute on function public.current_profile_can_review_player_link_team(uuid) to authenticated;

create or replace function public.enforce_profile_player_link_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING' then
      raise exception 'Player links must start pending.';
    end if;
    if new.source = 'SELF_CLAIM' and new.relationship_type <> 'PLAYER' then
      raise exception 'Self claims must use the PLAYER relationship.';
    end if;
    return new;
  end if;

  if new.profile_id is distinct from old.profile_id
    or new.player_id is distinct from old.player_id
    or new.claim_player_team_membership_id is distinct from old.claim_player_team_membership_id
    or new.claim_team_id is distinct from old.claim_team_id
    or new.claim_season_id is distinct from old.claim_season_id
    or new.relationship_type is distinct from old.relationship_type
    or new.source is distinct from old.source
    or new.requested_at is distinct from old.requested_at
    or new.request_message is distinct from old.request_message
    or new.metadata is distinct from old.metadata then
    raise exception 'Player link identity and claim context are immutable.';
  end if;

  if old.status = 'PENDING' and new.status = 'APPROVED' then
    if new.approved_at is null or new.approved_by_profile_id is null then
      raise exception 'Approval actor and timestamp are required.';
    end if;
    if auth.uid() is not null and new.approved_by_profile_id <> auth.uid() then
      raise exception 'Approval actor must be the authenticated reviewer.';
    end if;
  elsif old.status = 'PENDING' and new.status = 'REJECTED' then
    if new.rejected_at is null or new.rejected_by_profile_id is null then
      raise exception 'Rejection actor and timestamp are required.';
    end if;
    if auth.uid() is not null and new.rejected_by_profile_id <> auth.uid() then
      raise exception 'Rejection actor must be the authenticated reviewer.';
    end if;
  elsif old.status = 'APPROVED' and new.status = 'REVOKED' then
    if new.revoked_at is null or new.revoked_by_profile_id is null then
      raise exception 'Revocation actor and timestamp are required.';
    end if;
    if auth.uid() is not null and new.revoked_by_profile_id <> auth.uid() then
      raise exception 'Revocation actor must be the authenticated reviewer.';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'Invalid player link status transition.';
  elsif new.approved_at is distinct from old.approved_at
    or new.rejected_at is distinct from old.rejected_at
    or new.revoked_at is distinct from old.revoked_at
    or new.approved_by_profile_id is distinct from old.approved_by_profile_id
    or new.rejected_by_profile_id is distinct from old.rejected_by_profile_id
    or new.revoked_by_profile_id is distinct from old.revoked_by_profile_id then
    raise exception 'Player link review fields can only change with a status transition.';
  end if;

  return new;
end;
$$;

drop trigger if exists profile_player_links_lifecycle on public.profile_player_links;
create trigger profile_player_links_lifecycle
before insert or update on public.profile_player_links
for each row execute function public.enforce_profile_player_link_lifecycle();

drop trigger if exists profile_player_links_updated_at on public.profile_player_links;
create trigger profile_player_links_updated_at
before update on public.profile_player_links
for each row execute function public.set_updated_at();

alter table public.profile_player_links enable row level security;

revoke all on table public.profile_player_links from anon;
revoke all on table public.profile_player_links from authenticated;
grant select, insert, update on table public.profile_player_links to authenticated;

drop policy if exists player_links_select_own_or_team_manager on public.profile_player_links;
create policy player_links_select_own_or_team_manager
on public.profile_player_links
for select to authenticated
using (
  profile_id = (select auth.uid())
  or public.current_profile_can_review_player_link_team(claim_team_id)
);

drop policy if exists player_links_create_self_claim on public.profile_player_links;
create policy player_links_create_self_claim
on public.profile_player_links
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and relationship_type = 'PLAYER'
  and status = 'PENDING'
  and source = 'SELF_CLAIM'
  and public.player_link_claim_target_is_valid(player_id, claim_player_team_membership_id, claim_team_id, claim_season_id)
);

drop policy if exists player_links_manage_claim_transitions on public.profile_player_links;
create policy player_links_manage_claim_transitions
on public.profile_player_links
for update to authenticated
using (public.current_profile_can_review_player_link_team(claim_team_id))
with check (public.current_profile_can_review_player_link_team(claim_team_id));

commit;
