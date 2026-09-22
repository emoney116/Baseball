begin;

alter table public.player_invitations
  add column delivery_mode text not null default 'EMAIL'
    check (delivery_mode in ('EMAIL','QR')),
  alter column invited_email drop not null,
  add constraint player_invitation_delivery_email check (
    (delivery_mode='EMAIL' and invited_email is not null) or
    (delivery_mode='QR' and invited_email is null)
  );
create unique index player_invitation_pending_qr
  on public.player_invitations(membership_id)
  where status='PENDING' and delivery_mode='QR';

create or replace function public.redeem_player_invitation(invite_hash text, account_id uuid, verified_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.player_invitations; association uuid;
begin
  -- Serialize claims by account as well as token/player. Two different QR codes
  -- must not let one account concurrently acquire incompatible identities.
  perform 1 from public.profiles where id=account_id for update;
  if not found then raise exception 'Sign in before joining.'; end if;
  select * into invitation from public.player_invitations where token_hash=invite_hash for update;
  if not found or invitation.status <> 'PENDING' or invitation.expires_at <= now() then
    raise exception 'This invitation is unavailable, already used, or expired.';
  end if;
  if verified_email is null or trim(verified_email)='' then
    raise exception 'Verify your email before accepting this invitation.';
  end if;
  if invitation.delivery_mode='EMAIL' and lower(trim(verified_email)) <> invitation.invited_email then
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
  if invitation.delivery_mode='QR' and exists(select 1 from public.profile_player_links
    where profile_id=account_id and relationship_type='PLAYER' and status='APPROVED'
      and player_id<>invitation.player_id) then
    raise exception 'This account is linked to a different player. Ask your coach for help.';
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
