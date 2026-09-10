alter table public.organizations add column location_id uuid references public.clubhouse_locations(id);
alter table public.teams add column default_location_id uuid references public.clubhouse_locations(id);
create index organizations_location_id on public.organizations(location_id) where location_id is not null;
create index teams_default_location_id on public.teams(default_location_id) where default_location_id is not null;

-- Only the coordinate exception under Google Places standard terms is cached.
create table public.places_coordinate_cache (
  place_id text primary key,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  expires_at timestamptz not null default (now() + interval '29 days')
);
create index places_coordinate_cache_expiry on public.places_coordinate_cache(expires_at);
alter table public.places_coordinate_cache enable row level security;
revoke all on public.places_coordinate_cache from public, anon, authenticated;
grant all on public.places_coordinate_cache to service_role;

create function public.validate_default_location_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare venue public.clubhouse_locations%rowtype; selected uuid;
begin
  selected := case when tg_table_name='teams' then (to_jsonb(new)->>'default_location_id')::uuid else (to_jsonb(new)->>'location_id')::uuid end;
  if selected is null then return new; end if;
  select * into venue from public.clubhouse_locations where id=selected;
  if not found then raise exception 'Location not found' using errcode='42501'; end if;
  if tg_table_name='teams' then
    if not coalesce((venue.team_id=new.id or (venue.team_id is null and venue.organization_id=new.organization_id)),false)
      then raise exception 'Location is outside this team scope' using errcode='42501'; end if;
  else
    if venue.team_id is not null or venue.organization_id is distinct from new.id then
      raise exception 'Location is outside this organization scope' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_default_location_scope() from public,anon,authenticated;
create trigger teams_default_location_scope before insert or update of default_location_id,organization_id on public.teams
  for each row execute function public.validate_default_location_scope();
create trigger organizations_location_scope before insert or update of location_id on public.organizations
  for each row execute function public.validate_default_location_scope();
