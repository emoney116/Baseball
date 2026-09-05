begin;

alter table public.teams add column player_access_default text not null default 'VIEW_ONLY'
  check (player_access_default in ('VIEW_ONLY','TRACK_AND_VIEW','FULL_PLAYER'));
create table public.player_access_overrides (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  access_mode text not null check(access_mode in ('VIEW_ONLY','TRACK_AND_VIEW','FULL_PLAYER')),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(team_id,player_id)
);
create index player_access_overrides_player on public.player_access_overrides(player_id);
create table public.player_access_audit (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id),
  player_id uuid references public.players(id), changed_by uuid not null references public.profiles(id),
  previous_mode text, new_mode text, created_at timestamptz not null default now()
);
create index player_access_audit_team on public.player_access_audit(team_id,created_at);
alter table public.player_access_overrides enable row level security;
alter table public.player_access_audit enable row level security;
revoke all on public.player_access_overrides,public.player_access_audit from public,anon,authenticated;
grant all on public.player_access_overrides,public.player_access_audit to service_role;

alter table public.workout_sessions add column created_by_profile_id uuid references public.profiles(id),
  add column entry_source text;
alter table public.development_goals add column created_by_profile_id uuid references public.profiles(id),
  add column entry_source text;
create index workout_sessions_creator on public.workout_sessions(created_by_profile_id);
create index development_goals_creator on public.development_goals(created_by_profile_id);

-- Legacy null provenance is never inferred to be player-owned.
create function clubhouse_private.protect_self_entry_provenance() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.created_by_profile_id is distinct from old.created_by_profile_id
    or new.entry_source is distinct from old.entry_source) then
    raise exception 'Entry ownership is immutable.';
  end if;
  if tg_op='INSERT' and new.entry_source='PLAYER_SELF' and current_user in ('anon','authenticated') then
    raise exception 'Use the authorized self-entry endpoint.';
  end if;
  return new;
end; $$;
create trigger protect_self_entry_provenance before insert or update on public.workout_sessions
  for each row execute function clubhouse_private.protect_self_entry_provenance();
create trigger protect_self_entry_provenance before insert or update on public.development_goals
  for each row execute function clubhouse_private.protect_self_entry_provenance();

-- Service-only invoker RPCs use current server-authenticated profile IDs. No browser grants.
create function public.set_player_access_mode(actor uuid,target_team uuid,target_player uuid,new_mode text)
returns void language plpgsql security invoker set search_path='' as $$
declare old_mode text;
begin
  perform 1 from public.teams where id=target_team and active for update;
  if not found then raise exception 'Team unavailable.'; end if;
  if not exists(select 1 from public.profile_team_memberships where profile_id=actor and team_id=target_team and active
      and role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'))
    and not exists(select 1 from public.organization_memberships m join public.teams t on t.organization_id=m.organization_id
      where m.profile_id=actor and m.active and m.role='ADMIN' and t.id=target_team)
    and not exists(select 1 from public.account_entitlements where profile_id=actor and entitlement_key='SUPER_USER'
      and enabled and (expires_at is null or expires_at>now())) then raise exception 'Team authority required.'; end if;
  if new_mode is not null and new_mode not in ('VIEW_ONLY','TRACK_AND_VIEW','FULL_PLAYER') then raise exception 'Invalid access mode.'; end if;
  if target_player is null then
    if new_mode is null then raise exception 'Team default is required.'; end if;
    select player_access_default into old_mode from public.teams where id=target_team;
    update public.teams set player_access_default=new_mode where id=target_team;
  else
    if not exists(select 1 from public.player_team_memberships m join public.players p on p.id=m.player_id
      where m.team_id=target_team and m.player_id=target_player and m.active and p.active) then raise exception 'Active roster identity required.'; end if;
    select access_mode into old_mode from public.player_access_overrides where team_id=target_team and player_id=target_player;
    if new_mode is null then delete from public.player_access_overrides where team_id=target_team and player_id=target_player;
    else insert into public.player_access_overrides(team_id,player_id,access_mode,updated_by)
      values(target_team,target_player,new_mode,actor) on conflict(team_id,player_id)
      do update set access_mode=excluded.access_mode,updated_by=excluded.updated_by,updated_at=now(); end if;
  end if;
  insert into public.player_access_audit(team_id,player_id,changed_by,previous_mode,new_mode)
    values(target_team,target_player,actor,old_mode,new_mode);
end; $$;

create function public.write_player_self_entry(actor uuid,target_membership uuid,entry_kind text,operation text,
  entry_id uuid,entry_date date,body_weight_value numeric,goal_title text,goal_completed boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships; t public.teams; effective_mode text; result_id uuid;
begin
  select * into m from public.player_team_memberships where id=target_membership and active for share;
  if not found then raise exception 'Approved player context required.'; end if;
  select * into t from public.teams where id=m.team_id and active for share;
  if not found then raise exception 'Team unavailable.'; end if;
  perform 1 from public.seasons where id=m.season_id and team_id=m.team_id and active for share;
  if not found then raise exception 'Season unavailable.'; end if;
  perform 1 from public.players where id=m.player_id and active for share;
  if not found then raise exception 'Player unavailable.'; end if;
  perform 1 from public.profile_player_links where profile_id=actor and player_id=m.player_id
    and status='APPROVED' and relationship_type='PLAYER' for share;
  if not found then raise exception 'Approved player link required.'; end if;
  select coalesce((select access_mode from public.player_access_overrides where team_id=m.team_id and player_id=m.player_id),t.player_access_default) into effective_mode;
  if effective_mode not in ('TRACK_AND_VIEW','FULL_PLAYER') then raise exception 'Self tracking is not permitted.'; end if;
  if entry_kind not in ('body_weight','goal') or operation not in ('create','update','delete') or operation is null or entry_kind is null then raise exception 'Unsupported self entry.'; end if;
  if operation<>'create' and entry_id is null then raise exception 'Entry ID required.'; end if;
  if entry_kind='body_weight' then
    if operation<>'delete' and (body_weight_value is null or body_weight_value::text in ('NaN','Infinity','-Infinity') or body_weight_value<30 or body_weight_value>700) then raise exception 'Body weight must be 30-700 lb.'; end if;
    if operation='create' then
      if entry_date is null or entry_date>current_date or entry_date<current_date-366 then raise exception 'Choose a date within the past year.'; end if;
      -- Never upsert into the unique player/day slot: it may belong to a coach or another team.
      insert into public.workout_sessions(organization_id,team_id,season_id,player_id,session_date,week_of,body_weight,created_by_profile_id,entry_source)
        values(t.organization_id,m.team_id,m.season_id,m.player_id,entry_date,date_trunc('week',entry_date)::date,body_weight_value,actor,'PLAYER_SELF') returning id into result_id;
    else
      perform 1 from public.workout_sessions w where w.id=entry_id and w.player_id=m.player_id and w.team_id=m.team_id
        and w.season_id=m.season_id and w.created_by_profile_id=actor and w.entry_source='PLAYER_SELF' for update;
      if not found then raise exception 'Only your personal body-weight entries can be changed.'; end if;
      -- Check attachments after obtaining the parent lock, using a fresh statement snapshot.
      if exists(select 1 from public.workout_sessions where id=entry_id and workout_id is not null)
        or exists(select 1 from public.workout_sets where workout_session_id=entry_id) then
        raise exception 'Only isolated body-weight entries can be changed.';
      end if;
      if operation='delete' then delete from public.workout_sessions where id=entry_id;
      else update public.workout_sessions set body_weight=body_weight_value,updated_at=now() where id=entry_id; end if;
      result_id:=entry_id;
    end if;
  else
    if operation<>'delete' and (goal_title is null or length(trim(goal_title))<1 or length(goal_title)>200 or goal_completed is null) then raise exception 'A goal title and completion state are required.'; end if;
    if operation='create' then
      insert into public.development_goals(organization_id,team_id,season_id,player_id,title,completed,player_visible,created_by_profile_id,entry_source)
        values(t.organization_id,m.team_id,m.season_id,m.player_id,trim(goal_title),goal_completed,true,actor,'PLAYER_SELF') returning id into result_id;
    else
      perform 1 from public.development_goals where id=entry_id and player_id=m.player_id and team_id=m.team_id
        and season_id=m.season_id and created_by_profile_id=actor and entry_source='PLAYER_SELF' for update;
      if not found then raise exception 'Only your personal goals can be changed.'; end if;
      if operation='delete' then delete from public.development_goals where id=entry_id;
      else update public.development_goals set title=trim(goal_title),completed=goal_completed,updated_at=now() where id=entry_id; end if;
      result_id:=entry_id;
    end if;
  end if;
  return result_id;
end; $$;
revoke all on function public.set_player_access_mode(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.write_player_self_entry(uuid,uuid,text,text,uuid,date,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.set_player_access_mode(uuid,uuid,uuid,text) to service_role;
grant execute on function public.write_player_self_entry(uuid,uuid,text,text,uuid,date,numeric,text,boolean) to service_role;
commit;
