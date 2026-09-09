-- Only independently supplied Clubhouse metadata and durable Google Place IDs.
-- Google names, addresses, address components and coordinates are NOT stored.
create table public.clubhouse_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  team_id uuid references public.teams(id),
  created_by_profile_id uuid not null references public.profiles(id),
  name text not null check (length(name) between 1 and 100),
  city text check (length(city) <= 80),
  state_region text check (length(state_region) <= 40),
  country_code text check (length(country_code) <= 2),
  address text check (length(address) <= 200),
  provider_place_id text check (provider_place_id ~ '^[A-Za-z0-9_-]{5,255}$'),
  created_at timestamptz not null default now()
);
create unique index clubhouse_locations_team_place on public.clubhouse_locations(team_id,provider_place_id)
  where team_id is not null and provider_place_id is not null;
create unique index clubhouse_locations_org_place on public.clubhouse_locations(organization_id,provider_place_id)
  where team_id is null and organization_id is not null and provider_place_id is not null;
create unique index clubhouse_locations_personal_place on public.clubhouse_locations(created_by_profile_id,provider_place_id)
  where organization_id is null and team_id is null and provider_place_id is not null;
create index clubhouse_locations_org on public.clubhouse_locations(organization_id);
create index clubhouse_locations_owner on public.clubhouse_locations(created_by_profile_id);
alter table public.clubhouse_locations enable row level security;
revoke all on public.clubhouse_locations from public, anon, authenticated;
grant all on public.clubhouse_locations to service_role;
comment on table public.clubhouse_locations is 'Customer-owned metadata only. Google Place IDs are permitted durable identifiers; other Google response content is transient.';

alter table public.practices add column location_id uuid references public.clubhouse_locations(id);
alter table public.games add column location_id uuid references public.clubhouse_locations(id);
create index practices_location_id on public.practices(location_id) where location_id is not null;
create index games_location_id on public.games(location_id) where location_id is not null;

create function public.validate_event_location_scope() returns trigger
language plpgsql security definer set search_path = '' as $$
declare venue public.clubhouse_locations%rowtype;
begin
  if new.location_id is null then return new; end if;
  select * into venue from public.clubhouse_locations where id=new.location_id;
  if not found or not coalesce((
    (venue.team_id is not null and venue.team_id=new.team_id)
    or (venue.team_id is null and venue.organization_id is not null and venue.organization_id=new.organization_id)
  ), false) then raise exception 'Location is outside this team scope' using errcode='42501'; end if;
  -- Canonical customer-owned label snapshot keeps existing player/coach displays identical.
  new.location := venue.name;
  return new;
end;
$$;
revoke all on function public.validate_event_location_scope() from public, anon, authenticated;
create trigger practices_location_scope before insert or update of location_id,team_id,organization_id,location on public.practices
  for each row execute function public.validate_event_location_scope();
create trigger games_location_scope before insert or update of location_id,team_id,organization_id,location on public.games
  for each row execute function public.validate_event_location_scope();
