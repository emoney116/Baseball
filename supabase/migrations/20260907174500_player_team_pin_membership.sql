begin;

-- Player links are not staff memberships. Pins remain preferences, not access grants.
create or replace function public.enforce_profile_team_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = new.profile_id for update;

  if not exists (
    select 1 from public.profile_team_memberships m
    where m.profile_id = new.profile_id and m.team_id = new.team_id and m.active
      and (new.season_id is null or m.season_id = new.season_id or m.season_id is null)
  ) and not exists (
    select 1 from public.profile_player_links l
    join public.player_team_memberships m on m.player_id = l.player_id and m.active
    join public.players p on p.id = m.player_id and p.active
    join public.teams t on t.id = m.team_id and t.active
    join public.seasons s on s.id = m.season_id and s.team_id = t.id and s.active
    where l.profile_id = new.profile_id and l.relationship_type = 'PLAYER'
      and l.status = 'APPROVED' and m.team_id = new.team_id
      and m.season_id = new.season_id
  ) then
    raise exception 'Only team members can pin this team.';
  end if;

  if (select count(*) from public.profile_team_pins p
      where p.profile_id = new.profile_id and p.id <> new.id) >= 3 then
    raise exception 'You can pin up to 3 teams.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- Existing own-profile SELECT/DELETE and staff INSERT/UPDATE RLS are unchanged.
-- Approved player pin creation uses the authenticated application's server route.
commit;
