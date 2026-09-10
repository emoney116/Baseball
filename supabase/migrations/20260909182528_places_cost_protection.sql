-- Server-only reservations are shared by every deployment using this database.
create table public.places_request_reservations (
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  ip_hash text not null,
  query_hash text,
  environment text not null check (environment in ('production','preview','development')),
  operation text not null check (operation in ('autocomplete','details')),
  created_at timestamptz not null default clock_timestamp()
);
create index places_reservations_user_time on public.places_request_reservations(profile_id, created_at);
create index places_reservations_ip_time on public.places_request_reservations(ip_hash, created_at);
create index places_reservations_time on public.places_request_reservations(created_at);

create table public.places_search_sessions (
  token uuid primary key,
  profile_id uuid not null,
  environment text not null,
  created_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  selected_place_id text,
  requests integer not null default 0,
  place_ids text[] not null default '{}'
);
create index places_sessions_created on public.places_search_sessions(created_at);
alter table public.places_request_reservations enable row level security;
alter table public.places_search_sessions enable row level security;
revoke all on public.places_request_reservations, public.places_search_sessions from public, anon, authenticated;
grant all on public.places_request_reservations, public.places_search_sessions to service_role;
grant usage, select on sequence public.places_request_reservations_id_seq to service_role;

create function public.reserve_places_request(
  p_profile_id uuid, p_ip_hash text, p_query_hash text, p_environment text,
  p_operation text, p_token uuid, p_place_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  moment timestamptz := clock_timestamp();
  session_row public.places_search_sessions%rowtype;
  user_burst integer; ip_burst integer; user_minute integer; ip_minute integer;
  user_day integer; ip_day integer; environment_day integer; project_day integer;
  auto boolean := p_operation = 'autocomplete';
  environment_limit integer;
begin
  if p_profile_id is null or p_token is null or p_ip_hash !~ '^[a-f0-9]{64}$'
    or p_ip_hash is null or p_environment not in ('production','preview','development')
    or p_environment is null or p_operation not in ('autocomplete','details') or p_operation is null
    or (auto and (p_query_hash is null or p_query_hash !~ '^[a-f0-9]{64}$')) then
    raise exception 'Invalid Places reservation';
  end if;
  -- Low-volume V1: a single transaction lock makes all overlapping budgets atomic.
  perform pg_advisory_xact_lock(549091830);
  delete from public.places_request_reservations where created_at < moment - interval '48 hours';
  delete from public.places_search_sessions where created_at < moment - interval '48 hours';

  select * into session_row from public.places_search_sessions where token = p_token;
  if found and (session_row.profile_id <> p_profile_id or session_row.environment <> p_environment
    or session_row.ended_at is not null or session_row.created_at < moment - interval '20 minutes'
    or session_row.requests >= 24) then
    return jsonb_build_object('allowed',false,'retryAfter',60);
  end if;
  if not auto and (session_row.token is null or p_place_id is null
    or not (p_place_id = any(session_row.place_ids))) then
    return jsonb_build_object('allowed',false,'retryAfter',60);
  end if;
  if auto and exists (select 1 from public.places_request_reservations
    where profile_id = p_profile_id and query_hash = p_query_hash
      and created_at > moment - interval '10 seconds') then
    return jsonb_build_object('allowed',false,'retryAfter',10);
  end if;

  select
    count(*) filter (where profile_id=p_profile_id and created_at > moment-interval '10 seconds'),
    count(*) filter (where ip_hash=p_ip_hash and created_at > moment-interval '10 seconds'),
    count(*) filter (where profile_id=p_profile_id and created_at > moment-interval '1 minute'),
    count(*) filter (where ip_hash=p_ip_hash and created_at > moment-interval '1 minute'),
    count(*) filter (where profile_id=p_profile_id), count(*) filter (where ip_hash=p_ip_hash),
    count(*) filter (where environment=p_environment), count(*)
  into user_burst, ip_burst, user_minute, ip_minute, user_day, ip_day, environment_day, project_day
  from public.places_request_reservations where operation=p_operation and created_at > moment-interval '24 hours';

  if user_burst >= (case when auto then 8 else 2 end) or ip_burst >= (case when auto then 20 else 6 end)
    or user_minute >= (case when auto then 30 else 6 end) or ip_minute >= (case when auto then 90 else 20 end) then
    return jsonb_build_object('allowed',false,'retryAfter',60);
  end if;
  environment_limit := case p_environment when 'production' then 1000 when 'preview' then 200 else 100 end;
  if not auto then environment_limit := environment_limit / 5; end if;
  if user_day >= (case when auto then 150 else 30 end) or ip_day >= (case when auto then 400 else 100 end)
    or environment_day >= environment_limit or project_day >= (case when auto then 1300 else 260 end) then
    return jsonb_build_object('allowed',false,'retryAfter',86400);
  end if;

  insert into public.places_search_sessions(token,profile_id,environment) values(p_token,p_profile_id,p_environment)
    on conflict(token) do nothing;
  update public.places_search_sessions set requests=requests+1,
    ended_at=case when auto then null else moment end,
    selected_place_id=case when auto then null else p_place_id end where token=p_token;
  insert into public.places_request_reservations(profile_id,ip_hash,query_hash,environment,operation,created_at)
    values(p_profile_id,p_ip_hash,p_query_hash,p_environment,p_operation,moment);
  return jsonb_build_object('allowed',true,'retryAfter',0);
end;
$$;

create function public.record_places_predictions(p_token uuid, p_profile_id uuid, p_place_ids text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if cardinality(p_place_ids) > 5 then raise exception 'Too many Places predictions'; end if;
  update public.places_search_sessions set place_ids=array(
    select distinct item from unnest(place_ids || p_place_ids) item
    where item ~ '^[A-Za-z0-9_-]{5,255}$' limit 120
  ) where token=p_token and profile_id=p_profile_id and ended_at is null
    and created_at > clock_timestamp()-interval '20 minutes';
end;
$$;
revoke all on function public.reserve_places_request(uuid,text,text,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.record_places_predictions(uuid,uuid,text[]) from public, anon, authenticated;
grant execute on function public.reserve_places_request(uuid,text,text,text,text,uuid,text) to service_role;
grant execute on function public.record_places_predictions(uuid,uuid,text[]) to service_role;
