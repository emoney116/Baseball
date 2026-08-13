create table if not exists public.profile_team_pins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_team_pins_profile_team_season_key
  on public.profile_team_pins (
    profile_id,
    team_id,
    coalesce(season_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists profile_team_pins_profile_id_idx
  on public.profile_team_pins(profile_id);

create index if not exists profile_team_pins_team_id_idx
  on public.profile_team_pins(team_id);

create or replace function public.enforce_profile_team_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    select count(*)
    from public.profile_team_pins ptp
    where ptp.profile_id = new.profile_id
      and ptp.id <> new.id
      and exists (
        select 1
        from public.profile_team_memberships ptm
        where ptm.profile_id = new.profile_id
          and ptm.team_id = ptp.team_id
          and ptm.active = true
          and (
            ptp.season_id is null
            or ptm.season_id = ptp.season_id
            or ptm.season_id is null
          )
      )
  ) >= 3 then
    raise exception 'You can pin up to 3 teams.';
  end if;

  if not exists (
    select 1
    from public.profile_team_memberships ptm
    where ptm.profile_id = new.profile_id
      and ptm.team_id = new.team_id
      and ptm.active = true
      and (
        new.season_id is null
        or ptm.season_id = new.season_id
        or ptm.season_id is null
      )
  ) then
    raise exception 'Only team members can pin this team.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profile_team_pins_limit_before_write on public.profile_team_pins;
create trigger profile_team_pins_limit_before_write
  before insert or update on public.profile_team_pins
  for each row
  execute function public.enforce_profile_team_pin_limit();

alter table public.profile_team_pins enable row level security;

drop policy if exists clubhouse_profile_team_pins_select_own on public.profile_team_pins;
drop policy if exists clubhouse_profile_team_pins_insert_own on public.profile_team_pins;
drop policy if exists clubhouse_profile_team_pins_update_own on public.profile_team_pins;
drop policy if exists clubhouse_profile_team_pins_insert_member_team on public.profile_team_pins;
drop policy if exists clubhouse_profile_team_pins_update_member_team on public.profile_team_pins;
drop policy if exists clubhouse_profile_team_pins_delete_own on public.profile_team_pins;

create policy clubhouse_profile_team_pins_select_own on public.profile_team_pins
  for select
  using (profile_id = auth.uid());

create policy clubhouse_profile_team_pins_insert_member_team on public.profile_team_pins
  for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.profile_team_memberships ptm
      where ptm.profile_id = auth.uid()
        and ptm.team_id = profile_team_pins.team_id
        and ptm.active = true
        and (
          profile_team_pins.season_id is null
          or ptm.season_id = profile_team_pins.season_id
          or ptm.season_id is null
        )
    )
  );

create policy clubhouse_profile_team_pins_update_member_team on public.profile_team_pins
  for update
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.profile_team_memberships ptm
      where ptm.profile_id = auth.uid()
        and ptm.team_id = profile_team_pins.team_id
        and ptm.active = true
        and (
          profile_team_pins.season_id is null
          or ptm.season_id = profile_team_pins.season_id
          or ptm.season_id is null
        )
    )
  );

create policy clubhouse_profile_team_pins_delete_own on public.profile_team_pins
  for delete
  using (profile_id = auth.uid());
