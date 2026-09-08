begin;

-- Reviewed identity repairs, not a name-based authorization shortcut. Tombstones
-- prevent stale clients from reintroducing retired IDs. Snapshots are staff-private.
create table clubhouse_private.player_identity_merges (
  retired_player_id uuid primary key,
  canonical_player_id uuid not null references public.players(id) on delete restrict,
  retired_player jsonb not null,
  canonical_player_before jsonb not null,
  merged_at timestamptz not null default now(),
  reason text not null,
  check (retired_player_id <> canonical_player_id)
);
create table clubhouse_private.player_identity_merge_rows (
  id bigint generated always as identity primary key,
  retired_player_id uuid not null references clubhouse_private.player_identity_merges(retired_player_id),
  table_name text not null,
  row_before jsonb not null
);
alter table clubhouse_private.player_identity_merges enable row level security;
alter table clubhouse_private.player_identity_merge_rows enable row level security;
revoke all on clubhouse_private.player_identity_merges, clubhouse_private.player_identity_merge_rows from public, anon, authenticated, service_role;

-- Compare whole JSON values, never replace substrings inside notes or names.
create function clubhouse_private.remap_player_json(value jsonb, old_id uuid, new_id uuid)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; item record;
begin
  if value = to_jsonb(old_id::text) then return to_jsonb(new_id::text); end if;
  if jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for item in select * from jsonb_each(value) loop
      result := result || jsonb_build_object(case when item.key=old_id::text then new_id::text else item.key end,
        clubhouse_private.remap_player_json(item.value,old_id,new_id));
    end loop;
    return result;
  elsif jsonb_typeof(value) = 'array' then
    result := '[]'::jsonb;
    for item in select * from jsonb_array_elements(value) loop
      -- Only collapse a repeated canonical ID, not repeated events or metric values.
      if item.value in (to_jsonb(old_id::text),to_jsonb(new_id::text)) and result @> jsonb_build_array(new_id::text) then continue; end if;
      result := result || jsonb_build_array(clubhouse_private.remap_player_json(item.value,old_id,new_id));
    end loop;
    return result;
  end if;
  return value;
end; $$;
revoke all on function clubhouse_private.remap_player_json(jsonb,uuid,uuid) from public,anon,authenticated,service_role;

-- Owner-only maintenance primitive. Not exposed as a browser/admin RPC. Any
-- unhandled uniqueness/identity conflict aborts the entire transaction.
create function clubhouse_private.merge_reviewed_roster_player(old_id uuid, new_id uuid, target_team uuid, target_season uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare old_player public.players; new_player public.players; m record; ref record; cfg record;
  survivor_membership uuid;
begin
  if exists(select 1 from clubhouse_private.player_identity_merges where retired_player_id=old_id and canonical_player_id=new_id) then return; end if;
  select * into old_player from public.players where id=old_id for update;
  select * into new_player from public.players where id=new_id for update;
  if old_player.id is null or new_player.id is null then raise exception 'Reviewed player pair is missing.'; end if;
  if old_player.organization_id <> new_player.organization_id or old_player.first_name <> new_player.first_name
    or old_player.last_name <> new_player.last_name or old_player.graduation_year is distinct from new_player.graduation_year
    or old_player.jersey_number is distinct from new_player.jersey_number or old_player.created_at >= new_player.created_at then
    raise exception 'Reviewed identity evidence changed; repair aborted.';
  end if;
  if not exists(select 1 from public.player_team_memberships a join public.player_team_memberships b
    on a.team_id=b.team_id and a.season_id=b.season_id and a.jersey_number is not distinct from b.jersey_number
    where a.player_id=old_id and b.player_id=new_id and a.team_id=target_team and a.season_id=target_season) then
    raise exception 'Reviewed roster context changed; repair aborted.';
  end if;
  -- These require a separate identity/access review, never silently transfer accounts.
  if exists(select 1 from public.profile_player_links where player_id=old_id)
    or exists(select 1 from public.player_invitations where player_id=old_id)
    or exists(select 1 from public.player_access_overrides where player_id=old_id) then
    raise exception 'Retired identity has account/access history requiring review.';
  end if;
  insert into clubhouse_private.player_identity_merges values(old_id,new_id,to_jsonb(old_player),to_jsonb(new_player),now(),'Reviewed duplicate Metrolina roster import; newest created identity retained');

  for m in select * from public.player_team_memberships where player_id=old_id for update loop
    select id into survivor_membership from public.player_team_memberships
      where player_id=new_id and team_id=m.team_id and season_id=m.season_id for update;
    if survivor_membership is not null then
      insert into clubhouse_private.player_identity_merge_rows(retired_player_id,table_name,row_before)
        select old_id,'player_team_memberships',to_jsonb(x) from public.player_team_memberships x where id in (m.id,survivor_membership);
      for ref in select c.conrelid::regclass tbl,a.attname col from pg_constraint c
        join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
        where c.contype='f' and c.confrelid='public.player_team_memberships'::regclass loop
        execute format('update %s set %I=$1 where %I=$2',ref.tbl,ref.col,ref.col) using survivor_membership,m.id;
      end loop;
      update public.player_team_memberships set metadata=m.metadata || metadata where id=survivor_membership;
      delete from public.player_team_memberships where id=m.id;
    end if;
  end loop;

  -- Single-slot rows collapse to the retained roster's row, with both originals
  -- archived. Actual swings, pitches, reps, measurements and sets are never deleted.
  for cfg in select * from (values
    ('practice_attendance','a.practice_id=b.practice_id'),
    ('game_lineups','a.game_id=b.game_id'),
    ('weight_room_workout_group_members','a.workout_id=b.workout_id'),
    ('weight_room_group_preset_members','a.preset_id=b.preset_id'),
    ('weekly_awards','a.season_id=b.season_id and a.award_type=b.award_type and a.week_start=b.week_start')
  ) x(tbl,predicate) loop
    execute format('insert into clubhouse_private.player_identity_merge_rows(retired_player_id,table_name,row_before)
      select $1,$3,to_jsonb(a) from public.%I a where a.player_id in ($1,$2)',cfg.tbl) using old_id,new_id,cfg.tbl;
    execute format('delete from public.%I a using public.%I b where a.player_id=$1 and b.player_id=$2 and %s',cfg.tbl,cfg.tbl,cfg.predicate) using old_id,new_id;
  end loop;

  -- Catalog-derived FK coverage includes every actual relational player reference.
  -- New constraints fail closed rather than cascading away historical data.
  for ref in select c.conrelid::regclass tbl,a.attname col from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.players'::regclass and c.connamespace='public'::regnamespace loop
    execute format('insert into clubhouse_private.player_identity_merge_rows(retired_player_id,table_name,row_before)
      select $1,$2,to_jsonb(x) from %s x where %I=$1',ref.tbl,ref.col) using old_id,ref.tbl::text;
    execute format('update %s set %I=$1 where %I=$2',ref.tbl,ref.col,ref.col) using new_id,old_id;
  end loop;
  for ref in select table_name,column_name from information_schema.columns
    where table_schema='public' and data_type='jsonb' and table_name in
      ('games','game_pitch_events','plate_appearances','practice_sessions','player_live_entry_receipts','ai_conversations') loop
    execute format('insert into clubhouse_private.player_identity_merge_rows(retired_player_id,table_name,row_before)
      select $1,$3,to_jsonb(x) from public.%I x where %I is distinct from clubhouse_private.remap_player_json(%I,$1,$2)',ref.table_name,ref.column_name,ref.column_name)
      using old_id,new_id,ref.table_name;
    execute format('update public.%I set %I=clubhouse_private.remap_player_json(%I,$1,$2)
      where %I is distinct from clubhouse_private.remap_player_json(%I,$1,$2)',ref.table_name,ref.column_name,ref.column_name,ref.column_name,ref.column_name) using old_id,new_id;
  end loop;
  update public.players set metadata=old_player.metadata || metadata where id=new_id;
  delete from public.players where id=old_id;
end; $$;
revoke all on function clubhouse_private.merge_reviewed_roster_player(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Explicit reviewed IDs from the two August 11 import batches. Clean databases
-- have none of these records; a partial/different batch stops instead of guessing.
do $$
declare pair record;
begin
  lock table public.players,public.player_team_memberships in access exclusive mode;
  for pair in select * from (values
    ('14ef618e-7242-4b52-852d-e417877a1df7','b92a21e9-73a7-4836-b473-d04e9ac0f792'),
    ('c7ff92a3-f264-4cbe-b704-e563817beb02','c3dc33d4-3b32-4779-940e-0172951e7498'),
    ('43128dc5-a27f-4606-8dce-4612b6bc6561','cbf550e1-5bea-48f4-8a66-38bf2da5a740'),
    ('e0fb4935-3c0a-49cb-b807-7ef9fcb341fa','955a5ddb-d80f-4421-8988-80093bda5b11'),
    ('83b9e07b-e9b5-4e1e-8647-39ab9ff237cb','f49bbf7a-c35c-488a-805e-8f60f4190a58'),
    ('df9a7a39-e58e-43b8-8281-253f07ed6d95','d0897a9c-983e-40c3-9e1d-7ed141dcf7a9'),
    ('4fc59fd5-0d62-4b01-a9ad-6dcbb08c94b8','bfaa2730-a78b-4ed0-b7a1-76abc5eeaec2'),
    ('99754596-2c14-419a-bfd0-3e4eb37b57f6','8b4ce07a-dd52-4fe5-a6ee-32d3ad0bfc18'),
    ('c00dbe23-57e2-4474-9502-c1d348ca5259','064cfbef-6252-47db-bcd5-20123880a99d'),
    ('6e51ee9a-0b57-4eb1-8001-6625e499c419','b1fdccdb-eae0-4df8-a2d8-1123b5697267'),
    ('b7bd738d-75a0-4612-9ca8-1b7114a9f3cb','8b62fca3-df69-4104-b985-27fafa865e75'),
    ('3bebf387-50c6-40bd-b950-fe510c9dae51','3dd2b3a7-5c25-4edc-993a-5ec4bd383c32'),
    ('f21ea3f8-e6be-4d14-8f4c-f2591a8510ff','62a5ebf3-af8b-4018-a59a-8eac05697533'),
    ('ceb3c397-6791-4249-9f9e-e85b99de1ba4','65714494-1f96-4551-9033-55079d6cd2b8'),
    ('fe72cf59-ccaf-42b2-83fd-2d7001ba26b3','012b5ecd-806f-4aa9-8c24-e3bcd8a3c26a'),
    ('9f990c98-1dd0-4e62-9b3a-81019f0bae91','e58fc1d2-8202-4000-9603-8432f20e5dfd'),
    ('8be27364-4125-4b4b-8d1b-44e20d7501b3','61013ac1-5137-4cd1-bdbe-bd72dae6ed6a'),
    ('917d7301-f28a-46c1-bcb9-713663a68286','fe777256-253b-4a06-9bee-3ae4eb458d28'),
    ('b4be994c-5a7d-447b-88b9-bf873eb370fe','bd4ba363-f01d-4b17-899f-73542773c28f'),
    ('11c86984-f42d-4094-a40b-93f205fdf2b9','1a891c26-12e0-4d24-9260-ba5cc461dd46')
  ) x(old_id,new_id) loop
    if not exists(select 1 from public.players where id in (pair.old_id::uuid,pair.new_id::uuid)) then continue; end if;
    if not exists(select 1 from public.players where id=pair.old_id::uuid and created_at='2026-08-11 00:06:34.96+00')
      or not exists(select 1 from public.players where id=pair.new_id::uuid and created_at='2026-08-11 13:12:32.156+00') then
      raise exception 'Reviewed import batch changed; repair aborted.';
    end if;
    perform clubhouse_private.merge_reviewed_roster_player(pair.old_id::uuid,pair.new_id::uuid,
      '113d2159-421c-424d-8fe4-af2d2e9ca1a9','8ff199c0-453e-42ac-83b9-4b735ef84b8b');
  end loop;
end; $$;

-- A stable, scoped collision key prevents concurrent/repeated duplicate imports.
-- Missing evidence is not a match; names are never globally unique.
alter table public.player_team_memberships add column roster_identity_key text;
create function clubhouse_private.roster_identity_key(p public.players, jersey integer)
returns text language sql immutable set search_path='' as $$
  select case when p.graduation_year is not null and jersey is not null
    and length(regexp_replace(lower(p.first_name || ' ' || p.last_name),'[^a-z0-9]','','g')) >= 3
    then regexp_replace(lower(p.first_name || ' ' || p.last_name),'[^a-z0-9]','','g') || ':' || p.graduation_year || ':' || jersey end;
$$;
create function clubhouse_private.set_roster_identity_key() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.players;
begin
  select * into p from public.players where id=new.player_id for share;
  new.roster_identity_key := clubhouse_private.roster_identity_key(p,coalesce(new.jersey_number,p.jersey_number));
  return new;
end; $$;
create trigger set_roster_identity_key before insert or update on public.player_team_memberships
  for each row execute function clubhouse_private.set_roster_identity_key();
update public.player_team_memberships m set roster_identity_key=clubhouse_private.roster_identity_key(p,coalesce(m.jersey_number,p.jersey_number))
  from public.players p where p.id=m.player_id;
create unique index player_team_memberships_identity_unique on public.player_team_memberships(team_id,season_id,roster_identity_key)
  where roster_identity_key is not null;

create function clubhouse_private.protect_roster_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from clubhouse_private.player_identity_merges where retired_player_id=new.id) then
    raise exception 'This roster record was merged. Refresh Clubhouse before saving.' using errcode='23505';
  end if;
  if tg_op='UPDATE' then new.created_at := old.created_at; end if;
  return new;
end; $$;
create trigger protect_roster_identity before insert or update on public.players for each row execute function clubhouse_private.protect_roster_identity();
create function clubhouse_private.refresh_roster_identity_keys() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.player_team_memberships set roster_identity_key=roster_identity_key where player_id=new.id;
  return new;
end; $$;
create trigger refresh_roster_identity_keys after update of first_name,last_name,graduation_year,jersey_number on public.players
  for each row when (old.first_name is distinct from new.first_name or old.last_name is distinct from new.last_name
    or old.graduation_year is distinct from new.graduation_year or old.jersey_number is distinct from new.jersey_number)
  execute function clubhouse_private.refresh_roster_identity_keys();
revoke all on function clubhouse_private.roster_identity_key(public.players,integer), clubhouse_private.set_roster_identity_key(),
  clubhouse_private.protect_roster_identity(),clubhouse_private.refresh_roster_identity_keys() from public,anon,authenticated,service_role;

-- The server authorizes the submitted context before this service-only atomic
-- write. A membership collision rolls back player creation too (no orphan rows).
create function public.sync_roster_rows(player_rows jsonb, membership_rows jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; p public.players; m public.player_team_memberships;
begin
  if jsonb_typeof(player_rows)<>'array' or jsonb_typeof(membership_rows)<>'array' then raise exception 'Roster arrays required.'; end if;
  for item in select * from jsonb_array_elements(player_rows) loop
    p := jsonb_populate_record(null::public.players,item);
    if exists(select 1 from public.players where id=p.id and organization_id<>p.organization_id) then
      raise exception 'Player belongs to another organization.' using errcode='42501';
    end if;
    insert into public.players(id,organization_id,first_name,last_name,jersey_number,graduation_year,primary_position,secondary_position,
      bats,throws,height,weight,is_pitcher,is_hitter,photo_url,active,metadata,created_at,updated_at)
    values(p.id,p.organization_id,p.first_name,p.last_name,p.jersey_number,p.graduation_year,p.primary_position,p.secondary_position,
      p.bats,p.throws,p.height,p.weight,p.is_pitcher,p.is_hitter,p.photo_url,p.active,coalesce(p.metadata,'{}'),coalesce(p.created_at,now()),now())
    on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,jersey_number=excluded.jersey_number,
      graduation_year=excluded.graduation_year,primary_position=excluded.primary_position,secondary_position=excluded.secondary_position,
      bats=excluded.bats,throws=excluded.throws,height=excluded.height,weight=excluded.weight,is_pitcher=excluded.is_pitcher,is_hitter=excluded.is_hitter,
      photo_url=excluded.photo_url,active=excluded.active,metadata=public.players.metadata || excluded.metadata,updated_at=now();
  end loop;
  for item in select * from jsonb_array_elements(membership_rows) loop
    m := jsonb_populate_record(null::public.player_team_memberships,item);
    if not exists(select 1 from public.players roster_player join public.teams t on t.organization_id=roster_player.organization_id
      join public.seasons s on s.team_id=t.id and s.organization_id=t.organization_id
      where roster_player.id=m.player_id and t.id=m.team_id and s.id=m.season_id) then
      raise exception 'Invalid roster context.' using errcode='42501';
    end if;
    insert into public.player_team_memberships(player_id,team_id,season_id,roster_status,jersey_number,roster_role,active,start_date,end_date,metadata)
    values(m.player_id,m.team_id,m.season_id,m.roster_status,m.jersey_number,m.roster_role,m.active,m.start_date,m.end_date,coalesce(m.metadata,'{}'))
    on conflict(player_id,team_id,season_id) do update set roster_status=excluded.roster_status,jersey_number=excluded.jersey_number,
      roster_role=excluded.roster_role,active=excluded.active,start_date=excluded.start_date,end_date=excluded.end_date,
      metadata=public.player_team_memberships.metadata || excluded.metadata;
  end loop;
end; $$;
revoke all on function public.sync_roster_rows(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_roster_rows(jsonb,jsonb) to service_role;

commit;
