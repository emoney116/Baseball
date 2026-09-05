begin;

-- Claims are authenticated server operations. Browser database access is read
-- only, so rate limits, exact identity validation and reviewer checks cannot
-- be bypassed by calling the Data API directly.
revoke insert, update, delete on public.profile_player_links from authenticated, anon;
grant all on public.profile_player_links to service_role;
drop policy if exists player_links_create_self_claim on public.profile_player_links;
drop policy if exists player_links_manage_claim_transitions on public.profile_player_links;

create or replace function public.enforce_profile_player_link_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING'
      or new.approved_at is not null or new.approved_by_profile_id is not null
      or new.rejected_at is not null or new.rejected_by_profile_id is not null
      or new.revoked_at is not null or new.revoked_by_profile_id is not null then
      raise exception 'Player links must start pending without review fields.';
    end if;
    if new.source = 'SELF_CLAIM' and new.relationship_type <> 'PLAYER' then
      raise exception 'Self claims must use the PLAYER relationship.';
    end if;
    new.requested_at := now();
    new.created_at := now();
    return new;
  end if;
  if (to_jsonb(new) - array['status','approved_at','approved_by_profile_id','rejected_at','rejected_by_profile_id','revoked_at','revoked_by_profile_id','updated_at'])
    is distinct from (to_jsonb(old) - array['status','approved_at','approved_by_profile_id','rejected_at','rejected_by_profile_id','revoked_at','revoked_by_profile_id','updated_at']) then
    raise exception 'Player link identity and claim context are immutable.';
  end if;
  if new.status = old.status then
    if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'Review fields require a status transition.';
    end if;
  elsif old.status = 'PENDING' and new.status = 'APPROVED' then
    if not exists (
      select 1 from public.player_team_memberships m
      join public.players p on p.id=m.player_id
      join public.teams t on t.id=m.team_id
      join public.seasons s on s.id=m.season_id and s.team_id=t.id
      where m.id=new.claim_player_team_membership_id and m.player_id=new.player_id
        and m.team_id=new.claim_team_id and m.season_id=new.claim_season_id
        and m.active and p.active and t.active and s.active
    ) then
      raise exception 'The claimed roster context is no longer active.';
    end if;
    if new.approved_by_profile_id is null or new.approved_by_profile_id = new.profile_id then
      raise exception 'An independent approval actor is required.';
    end if;
    new.approved_at := now();
    new.rejected_at := old.rejected_at;
    new.rejected_by_profile_id := old.rejected_by_profile_id;
    new.revoked_at := old.revoked_at;
    new.revoked_by_profile_id := old.revoked_by_profile_id;
  elsif old.status = 'PENDING' and new.status = 'REJECTED' then
    if new.rejected_by_profile_id is null or new.rejected_by_profile_id = new.profile_id then
      raise exception 'An independent rejection actor is required.';
    end if;
    new.rejected_at := now();
    new.approved_at := old.approved_at;
    new.approved_by_profile_id := old.approved_by_profile_id;
    new.revoked_at := old.revoked_at;
    new.revoked_by_profile_id := old.revoked_by_profile_id;
  elsif old.status = 'APPROVED' and new.status = 'REVOKED' then
    if new.revoked_by_profile_id is null or new.revoked_by_profile_id = new.profile_id then
      raise exception 'An independent revocation actor is required.';
    end if;
    new.revoked_at := now();
    new.approved_at := old.approved_at;
    new.approved_by_profile_id := old.approved_by_profile_id;
    new.rejected_at := old.rejected_at;
    new.rejected_by_profile_id := old.rejected_by_profile_id;
  else
    raise exception 'Invalid player link status transition.';
  end if;
  return new;
end;
$$;

commit;
