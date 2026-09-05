begin;

create table public.player_invitations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  membership_id uuid not null references public.player_team_memberships(id),
  team_id uuid not null references public.teams(id),
  season_id uuid not null references public.seasons(id),
  invited_email text not null check(invited_email = lower(trim(invited_email))),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','REVOKED')),
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id)
);
create unique index player_invitation_pending on public.player_invitations(membership_id,invited_email) where status='PENDING';
alter table public.player_invitations enable row level security;
revoke all on public.player_invitations from public, anon, authenticated;
grant all on public.player_invitations to service_role;

-- Only the authenticated application server can supply the verified account.
-- Lock both the token and identity: concurrent invites cannot claim one player twice.
create function public.redeem_player_invitation(invite_hash text, account_id uuid, verified_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.player_invitations; association uuid;
begin
  select * into invitation from public.player_invitations where token_hash=invite_hash for update;
  if not found or invitation.status <> 'PENDING' or invitation.expires_at <= now() then
    raise exception 'This invitation is unavailable or expired.';
  end if;
  if verified_email is null or lower(trim(verified_email)) <> invitation.invited_email then
    raise exception 'Sign in with the invited email address.';
  end if;
  if account_id=invitation.invited_by then raise exception 'Self approval is not allowed.'; end if;
  if not exists(select 1 from public.profile_team_memberships m where m.profile_id=invitation.invited_by
    and m.team_id=invitation.team_id and m.active and m.role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'))
    and not exists(select 1 from public.organization_memberships m join public.teams t on t.organization_id=m.organization_id
      where m.profile_id=invitation.invited_by and t.id=invitation.team_id and m.active and m.role='ADMIN')
    and not exists(select 1 from public.account_entitlements e where e.profile_id=invitation.invited_by
      and e.entitlement_key='SUPER_USER' and e.enabled and (e.expires_at is null or e.expires_at>now())) then
    raise exception 'The inviting coach no longer has team authority.';
  end if;
  perform 1 from public.players where id=invitation.player_id and active for update;
  if not found or not exists(select 1 from public.player_team_memberships m
    join public.teams t on t.id=m.team_id join public.seasons s on s.id=m.season_id and s.team_id=t.id
    where m.id=invitation.membership_id and m.player_id=invitation.player_id and m.team_id=invitation.team_id
      and m.season_id=invitation.season_id and m.active and t.active and s.active) then
    raise exception 'This roster membership is no longer active.';
  end if;
  if exists(select 1 from public.profile_player_links where player_id=invitation.player_id
    and status='APPROVED' and relationship_type='PLAYER' and profile_id<>account_id) then
    raise exception 'This player already has an approved account.';
  end if;
  select id into association from public.profile_player_links where player_id=invitation.player_id
    and profile_id=account_id and relationship_type='PLAYER' and status in ('PENDING','APPROVED') for update;
  if association is null then
    insert into public.profile_player_links(profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,source)
      values(account_id,invitation.player_id,invitation.membership_id,invitation.team_id,invitation.season_id,'COACH_INVITE') returning id into association;
  end if;
  update public.profile_player_links set status='APPROVED',approved_by_profile_id=invitation.invited_by
    where id=association and status='PENDING';
  update public.player_invitations set status='ACCEPTED',accepted_by=account_id,accepted_at=now() where id=invitation.id;
  return association;
end;
$$;
revoke all on function public.redeem_player_invitation(text,uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_player_invitation(text,uuid,text) to service_role;
commit;
