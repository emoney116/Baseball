begin;

-- The claim RPC holds the account lock. Pinning participates in that same
-- transaction: a pin failure must not consume a QR or leave a partial claim.
create function public.pin_claimed_player_invitation_team()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.delivery_mode <> 'QR' or new.status <> 'ACCEPTED'
    or old.status = 'ACCEPTED' then return new; end if;
  if new.accepted_by is null then raise exception 'A claimed invitation needs an account.'; end if;
  perform 1 from public.profiles where id=new.accepted_by for update;
  if not exists(select 1 from public.profile_team_pins where profile_id=new.accepted_by
    and team_id=new.team_id and season_id is not distinct from new.season_id) then
    -- Preserve the existing three-pin cap. A deliberately accepted personal
    -- invite replaces the least recently pinned preference, never membership.
    if (select count(*) from public.profile_team_pins where profile_id=new.accepted_by) >= 3 then
      delete from public.profile_team_pins where id=(select id from public.profile_team_pins
        where profile_id=new.accepted_by order by updated_at,created_at,id limit 1);
    end if;
    insert into public.profile_team_pins(profile_id,team_id,season_id)
      values(new.accepted_by,new.team_id,new.season_id);
  else
    update public.profile_team_pins set updated_at=now() where profile_id=new.accepted_by
      and team_id=new.team_id and season_id is not distinct from new.season_id;
  end if;
  return new;
end;
$$;
revoke all on function public.pin_claimed_player_invitation_team() from public,anon,authenticated;
create trigger player_invitation_pin_after_claim
  after update of status on public.player_invitations
  for each row execute function public.pin_claimed_player_invitation_team();
commit;
