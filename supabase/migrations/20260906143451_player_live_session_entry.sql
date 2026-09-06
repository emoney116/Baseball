begin;

alter table public.weight_room_workouts add column player_entry_enabled boolean not null default false;

-- Receipts survive undo/deletion, so a reconnect cannot resurrect a removed rep.
create table public.player_live_entry_receipts (
  request_id uuid primary key,
  actor uuid not null references public.profiles(id),
  membership_id uuid not null references public.player_team_memberships(id),
  domain text not null check(domain in ('hitting','pitching','defense','workout')),
  session_id uuid not null,
  operation text not null check(operation in ('create','update','delete')),
  payload jsonb not null,
  entry_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.player_live_entry_receipts enable row level security;
revoke all on public.player_live_entry_receipts from public,anon,authenticated;
grant all on public.player_live_entry_receipts to service_role;
create index player_live_receipts_context on public.player_live_entry_receipts(membership_id,created_at);

-- Reuse the same team lock acquired by access-mode updates, and association locks
-- acquired by revocation. Permission changes cannot race a checked write.
create function clubhouse_private.require_live_player(actor uuid, target_membership uuid, writing boolean)
returns public.player_team_memberships language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships; t public.teams; mode text;
begin
  select * into m from public.player_team_memberships where id=target_membership and active for share;
  if not found then raise exception 'Approved player context required.' using errcode='42501'; end if;
  select * into t from public.teams where id=m.team_id and active for share;
  if not found then raise exception 'Team unavailable.' using errcode='42501'; end if;
  perform 1 from public.seasons where id=m.season_id and team_id=m.team_id and active for share;
  if not found then raise exception 'Season unavailable.' using errcode='42501'; end if;
  perform 1 from public.players where id=m.player_id and active for share;
  if not found then raise exception 'Player unavailable.' using errcode='42501'; end if;
  perform 1 from public.profiles where id=actor for share;
  if not found then raise exception 'Profile unavailable.' using errcode='42501'; end if;
  perform 1 from public.profile_player_links where profile_id=actor and player_id=m.player_id
    and relationship_type='PLAYER' and status='APPROVED' for share;
  if not found then raise exception 'Approved player link required.' using errcode='42501'; end if;
  select coalesce((select access_mode from public.player_access_overrides where team_id=m.team_id and player_id=m.player_id),t.player_access_default) into mode;
  if writing and mode not in ('TRACK_AND_VIEW','FULL_PLAYER') then
    raise exception 'Your access is read-only.' using errcode='42501';
  end if;
  return m;
end; $$;
revoke all on function clubhouse_private.require_live_player(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function clubhouse_private.require_live_player(uuid,uuid,boolean) to service_role;

create function clubhouse_private.protect_live_entry_identity() returns trigger
language plpgsql set search_path='' as $$
declare old_row jsonb; new_row jsonb; k text; keys text[];
begin
  new_row:=to_jsonb(new);
  if tg_op='INSERT' then
    if new_row->>'entry_source'='PLAYER' and current_user in ('anon','authenticated') then
      -- Staff upsert runs INSERT triggers before its conflict UPDATE. Only an existing
      -- player row may take that path; the UPDATE trigger still checks immutable keys.
      execute format('select to_jsonb(e) from public.%I e where id=$1 and entry_source=''PLAYER''',tg_table_name)
        into old_row using new.id;
      if old_row is null then raise exception 'Use the authorized player live-entry endpoint.' using errcode='42501'; end if;
    end if;
    return new;
  end if;
  old_row:=to_jsonb(old);
  keys:=case when tg_table_name='workout_sets' then
    array['created_by','entry_source','player_id','workout_session_id','active_workout_id','workout_station_id','workout_group_id','exercise_id','set_number','idempotency_key','created_at']
    else array['created_by_profile_id','entry_source','practice_id','session_id','pitcher_id','hitter_id','player_id','idempotency_key','created_at'] end;
  if old_row->>'entry_source'='PLAYER' or new_row->>'entry_source'='PLAYER' then
    foreach k in array keys loop
      if new_row->k is distinct from old_row->k then
        raise exception 'Live-entry identity and ownership are immutable.' using errcode='42501';
      end if;
    end loop;
  end if;
  return new;
end; $$;
create trigger protect_live_entry_identity before insert or update on public.hitting_events for each row execute function clubhouse_private.protect_live_entry_identity();
create trigger protect_live_entry_identity before insert or update on public.pitch_events for each row execute function clubhouse_private.protect_live_entry_identity();
create trigger protect_live_entry_identity before insert or update on public.defense_events for each row execute function clubhouse_private.protect_live_entry_identity();
create trigger protect_live_entry_identity before insert or update on public.workout_sets for each row execute function clubhouse_private.protect_live_entry_identity();

create function public.write_player_live_entry(actor uuid,target_membership uuid,domain text,
  target_session uuid,operation text,request_id uuid,entry_id uuid,payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships; p public.practices; s public.practice_sessions;
  w public.weight_room_workouts; station public.weight_room_workout_stations;
  member public.weight_room_workout_group_members; daily public.workout_sessions;
  receipt public.player_live_entry_receipts; old_row jsonb; patch jsonb; row_data jsonb;
  result_id uuid; table_name text; player_key text; allowed text[]; k text; prior_value numeric;
  h public.hitting_events; pitch public.pitch_events; d public.defense_events; ws public.workout_sets;
begin
  m:=clubhouse_private.require_live_player(actor,target_membership,true);
  if domain is null or domain not in ('hitting','pitching','defense','workout') or operation is null
    or operation not in ('create','update','delete') or request_id is null
    or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid live entry.'; end if;
  if operation<>'create' and entry_id is null then raise exception 'Entry required.'; end if;

  if domain='workout' then
    select * into w from public.weight_room_workouts where id=target_session
      and team_id=m.team_id and season_id=m.season_id for update;
    if not found or w.status<>'ACTIVE' or w.ended_at is not null or w.started_at is null
      or w.started_at>now() or not w.player_entry_enabled or w.created_by is null then
      raise exception 'Session ended or player entry is unavailable.' using errcode='55000'; end if;
    select * into member from public.weight_room_workout_group_members where workout_id=w.id
      and player_id=m.player_id and participant_status in ('ASSIGNED','MODIFIED') for share;
    if not found then raise exception 'Workout assignment required.' using errcode='42501'; end if;
    select st.* into station from public.weight_room_workout_stations st
      join public.weight_room_workout_groups g on g.current_station_id=st.id
      where g.id=member.group_id and g.workout_id=w.id and st.workout_id=w.id
        and st.id=(payload->>'stationId')::uuid and st.archived_at is null for share of st,g;
    if not found or station.exercise_id is null then raise exception 'Current assigned exercise required.' using errcode='42501'; end if;
    if (payload->>'setNumber')::integer is null or (payload->>'setNumber')::integer<1
      or (payload->>'setNumber')::integer>coalesce(station.target_sets,1) then raise exception 'Set is outside the prescribed workout.'; end if;
    table_name:='workout_sets'; player_key:='player_id';
    allowed:=array['stationId','setNumber','weight','reps','value','rpe','status'];
  else
    -- Parent-first locking agrees with coach Practice end before station updates.
    select pr.* into p from public.practices pr join public.practice_sessions ps on ps.practice_id=pr.id
      where ps.id=target_session and pr.team_id=m.team_id and pr.season_id=m.season_id for share of pr;
    if not found or p.status::text<>'active' or p.ended_at is not null or p.starts_at is null or p.starts_at>now() then
      raise exception 'Session ended or Practice is not running.' using errcode='55000'; end if;
    select * into s from public.practice_sessions where id=target_session and practice_id=p.id
      and player_id=m.player_id and category::text=domain for update;
    if not found then raise exception 'Assigned Practice station required.' using errcode='42501'; end if;
    if s.status<>'ACTIVE' or s.ended_at is not null or s.started_at is null or s.started_at>now() or s.created_by_profile_id is null
      or s.entry_policy not in ('COACH_AND_ASSIGNED_PLAYERS','PLAYER_SELF_ENTRY') then
      raise exception 'Session ended or station is read-only.' using errcode='55000'; end if;
    if s.session_type in ('Live','Live BP') or s.secondary_player_id is not null then
      raise exception 'Player Live BP and Game entry are unavailable.' using errcode='42501'; end if;
    perform 1 from public.practice_attendance where practice_id=p.id and player_id=m.player_id and status in ('Present','Late') for share;
    if not found then raise exception 'Practice attendance required.' using errcode='42501'; end if;
    table_name:=case domain when 'hitting' then 'hitting_events' when 'pitching' then 'pitch_events' else 'defense_events' end;
    player_key:=case domain when 'hitting' then 'hitter_id' when 'pitching' then 'pitcher_id' else 'player_id' end;
    allowed:=array[case when domain='hitting' then 'action' else 'outcome' end] ||
      array(select jsonb_array_elements_text(coalesce(s.metadata->'playerEntryFields','[]'::jsonb)));
  end if;
  foreach k in array array(select jsonb_object_keys(payload)) loop
    if not k=any(allowed) then raise exception 'Field is not enabled for this session: %',k; end if;
  end loop;
  foreach k in array array['velocity','exit_velocity_mph','weight','reps','value','rpe'] loop
    if payload ? k and ((payload->>k)::numeric::text in ('NaN','Infinity','-Infinity') or (payload->>k)::numeric<0
      or (payload->>k)::numeric>case when k in ('velocity','exit_velocity_mph') then 130 when k='weight' then 1500 when k='reps' then 1000 when k='rpe' then 10 else 100000 end) then
      raise exception 'Invalid numeric entry.' using errcode='22023'; end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into receipt from public.player_live_entry_receipts r where r.request_id=write_player_live_entry.request_id;
  if found then
    if receipt.actor<>actor or receipt.membership_id<>target_membership or receipt.domain<>domain
      or receipt.session_id<>target_session or receipt.operation<>operation or receipt.payload<>payload
      or (operation<>'create' and receipt.entry_id<>entry_id) then raise exception 'Request ID already used.' using errcode='23505'; end if;
    return receipt.entry_id;
  end if;

  result_id:=case when operation='create' then gen_random_uuid() else entry_id end;
  if operation<>'create' then
    execute format('select to_jsonb(e) from public.%I e where id=$1 for update',table_name) into old_row using entry_id;
    if old_row is null or old_row->>player_key is distinct from m.player_id::text or old_row->>'entry_source' is distinct from 'PLAYER'
      or old_row->>(case when domain='workout' then 'created_by' else 'created_by_profile_id' end) is distinct from actor::text
      or old_row->>(case when domain='workout' then 'active_workout_id' else 'session_id' end) is distinct from target_session::text
      or coalesce(old_row->>(case when domain='workout' then 'updated_by' else 'updated_by_profile_id' end),actor::text)<>actor::text then
      raise exception 'Only your uncorrected live entries may be changed.' using errcode='42501'; end if;
    if domain='workout' and (old_row->>'workout_station_id' is distinct from station.id::text or old_row->>'set_number' is distinct from payload->>'setNumber') then
      raise exception 'Set identity cannot change.' using errcode='42501'; end if;
  end if;
  if operation='delete' then
    execute format('delete from public.%I where id=$1',table_name) using entry_id;
  elsif domain='workout' then
    if payload->>'status' is null or payload->>'status' not in ('Completed','Modified','Skipped') then raise exception 'Set status required.'; end if;
    if payload->>'status'<>'Skipped' and (
      (station.measurement_type in ('WEIGHT_REPS','WEIGHT_ONLY') and payload->>'weight' is null)
      or (station.measurement_type in ('WEIGHT_REPS','BODYWEIGHT_REPS','REPS_ONLY','COUNT') and payload->>'reps' is null)
      or (station.measurement_type in ('TIME','DISTANCE','HEIGHT','CUSTOM') and payload->>'value' is null)
      or (station.measurement_type='RPE_ONLY' and payload->>'rpe' is null)) then
      raise exception 'Enter the performed values for this exercise.' using errcode='22023'; end if;
    if operation='create' then
      -- Serialize the existing player/day slot across teams without replacing a coach row.
      perform pg_advisory_xact_lock(hashtextextended(m.player_id::text||w.workout_date::text,1));
      select * into daily from public.workout_sessions where player_id=m.player_id and session_date=w.workout_date for update;
      if found and (daily.team_id is distinct from m.team_id or daily.season_id is distinct from m.season_id) then raise exception 'Existing workout belongs to another team context.' using errcode='42501'; end if;
      if not found then
        insert into public.workout_sessions(organization_id,team_id,season_id,player_id,session_date,week_of,day_name,created_by_profile_id,entry_source)
        values(w.organization_id,m.team_id,m.season_id,m.player_id,w.workout_date,date_trunc('week',w.workout_date)::date,to_char(w.workout_date,'Dy'),actor,'PLAYER_LIVE') returning * into daily;
      end if;
      if exists(select 1 from public.workout_sets where player_id=m.player_id and workout_session_id=daily.id
        and exercise_id=station.exercise_id and coalesce(set_number,1)=(payload->>'setNumber')::integer) then
        raise exception 'This set is already recorded. Refresh before correcting it.' using errcode='23505'; end if;
      select coalesce(e.weight,e.value,e.reps) into prior_value from public.workout_sets e
        join public.workout_sessions previous on previous.id=e.workout_session_id
        where e.player_id=m.player_id and e.exercise_id=station.exercise_id and previous.team_id=m.team_id and previous.season_id=m.season_id
          and previous.session_date<w.workout_date and e.unit is not distinct from station.unit and coalesce(e.status,'Completed')<>'Skipped'
        order by previous.session_date desc,e.created_at desc limit 1;
      insert into public.workout_sets(id,workout_session_id,player_id,exercise_id,set_number,sets,weight,reps,value,unit,rpe,status,
        created_by,entry_source,active_workout_id,workout_station_id,workout_group_id,idempotency_key,completed_at,updated_by,prior_value)
      values(result_id,daily.id,m.player_id,station.exercise_id,(payload->>'setNumber')::integer,1,(payload->>'weight')::numeric,
        (payload->>'reps')::integer,(payload->>'value')::numeric,station.unit,(payload->>'rpe')::numeric,payload->>'status',
        actor,'PLAYER',w.id,station.id,member.group_id,request_id::text,now(),actor,prior_value);
    else
      update public.workout_sets set weight=(payload->>'weight')::numeric,reps=(payload->>'reps')::integer,
        value=(payload->>'value')::numeric,rpe=(payload->>'rpe')::numeric,status=payload->>'status',updated_at=now(),updated_by=actor where id=entry_id;
    end if;
  else
    -- Whitelisted scalar payload only; authoritative identity always wins.
    patch:=coalesce(old_row,'{}'::jsonb) || payload || jsonb_build_object('id',result_id,'practice_id',p.id,'session_id',s.id,player_key,m.player_id,
      'created_by_profile_id',actor,'updated_by_profile_id',actor,'entry_source','PLAYER','verification_status','PLAYER_RECORDED',
      'idempotency_key',coalesce(old_row->>'idempotency_key',request_id::text),'created_at',coalesce(old_row->>'created_at',now()::text));
    if domain='hitting' then
      h:=jsonb_populate_record(null::public.hitting_events,patch);
      if h.action is null or h.action not in ('Took pitch','Swing','Miss','Foul','Ball in play') then raise exception 'Swing result required.'; end if;
      h.event_number:=coalesce((old_row->>'event_number')::integer,(select coalesce(max(event_number),0)+1 from public.hitting_events where session_id=s.id));
      h.context:='practice'; h.is_live_bp:=false;
      if operation='create' then insert into public.hitting_events(id,practice_id,session_id,hitter_id,event_number,action,contact_result,contact_quality,direction,field_location,pitch_location,pitch_type,velocity,exit_velocity_mph,created_by_profile_id,updated_by_profile_id,entry_source,verification_status,idempotency_key)
        values(h.id,h.practice_id,h.session_id,h.hitter_id,h.event_number,h.action,h.contact_result,h.contact_quality,h.direction,h.field_location,h.pitch_location,h.pitch_type,h.velocity,h.exit_velocity_mph,actor,actor,'PLAYER','PLAYER_RECORDED',request_id::text);
      else update public.hitting_events set action=h.action,contact_result=h.contact_result,contact_quality=h.contact_quality,direction=h.direction,
        field_location=h.field_location,pitch_location=h.pitch_location,pitch_type=h.pitch_type,velocity=h.velocity,exit_velocity_mph=h.exit_velocity_mph,
        updated_by_profile_id=actor where id=entry_id; end if;
    elsif domain='pitching' then
      pitch:=jsonb_populate_record(null::public.pitch_events,patch);
      if pitch.outcome is null or pitch.outcome not in ('Ball','Called Strike','Swing','Take','Foul','Whiff','Ball in play','HBP') then raise exception 'Pitch result required.'; end if;
      pitch.pitch_type:=coalesce(pitch.pitch_type,'Other');
      pitch.pitch_number:=coalesce((old_row->>'pitch_number')::integer,(select coalesce(max(pitch_number),0)+1 from public.pitch_events where session_id=s.id));
      pitch.context:='practice'; pitch.is_swing:=pitch.outcome in ('Swing','Whiff','Foul','Ball in play');
      pitch.is_strike:=pitch.outcome in ('Called Strike','Swing','Whiff','Foul','Ball in play');
      pitch.is_zone:=coalesce((pitch.location->>'x')::numeric between 0.22 and 0.78 and (pitch.location->>'y')::numeric between 0.18 and 0.82,false);
      pitch.is_chase:=case when pitch.location is not null then pitch.is_swing and not pitch.is_zone else null end;
      pitch.is_whiff:=pitch.outcome='Whiff'; pitch.is_called_strike:=pitch.outcome='Called Strike'; pitch.is_ball_in_play:=pitch.outcome='Ball in play';
      if operation='create' then insert into public.pitch_events(id,practice_id,session_id,pitcher_id,pitch_number,pitch_type,outcome,velocity,location,count_before,count_after,batted_ball,contact_quality,is_strike,is_swing,is_zone,is_chase,is_whiff,is_called_strike,is_ball_in_play,created_by_profile_id,updated_by_profile_id,entry_source,verification_status,idempotency_key)
        values(pitch.id,p.id,s.id,m.player_id,pitch.pitch_number,pitch.pitch_type,pitch.outcome,pitch.velocity,pitch.location,pitch.count_before,pitch.count_after,pitch.batted_ball,pitch.contact_quality,pitch.is_strike,pitch.is_swing,pitch.is_zone,pitch.is_chase,pitch.is_whiff,pitch.is_called_strike,pitch.is_ball_in_play,actor,actor,'PLAYER','PLAYER_RECORDED',request_id::text);
      else update public.pitch_events set pitch_type=pitch.pitch_type,outcome=pitch.outcome,velocity=pitch.velocity,location=pitch.location,
        count_before=pitch.count_before,count_after=pitch.count_after,batted_ball=pitch.batted_ball,contact_quality=pitch.contact_quality,
        is_strike=pitch.is_strike,is_swing=pitch.is_swing,is_zone=pitch.is_zone,is_chase=pitch.is_chase,is_whiff=pitch.is_whiff,
        is_called_strike=pitch.is_called_strike,is_ball_in_play=pitch.is_ball_in_play,updated_by_profile_id=actor where id=entry_id; end if;
    else
      d:=jsonb_populate_record(null::public.defense_events,patch);
      if d.outcome is null or d.outcome not in ('Clean','Error','Missed Rep','Good Play','Great Play') then raise exception 'Defense result required.'; end if;
      d.station:=s.session_type; d.result:=d.outcome;
      d.event_number:=coalesce((old_row->>'event_number')::integer,(select coalesce(max(event_number),0)+1 from public.defense_events where session_id=s.id));
      if operation='create' then insert into public.defense_events(id,practice_id,session_id,player_id,station,event_number,outcome,result,rep_type,rep_subtype,throw_result,error_type,difficulty,created_by_profile_id,updated_by_profile_id,entry_source,verification_status,idempotency_key)
        values(d.id,p.id,s.id,m.player_id,d.station,d.event_number,d.outcome,d.result,d.rep_type,d.rep_subtype,d.throw_result,d.error_type,d.difficulty,actor,actor,'PLAYER','PLAYER_RECORDED',request_id::text);
      else update public.defense_events set outcome=d.outcome,result=d.result,rep_type=d.rep_type,rep_subtype=d.rep_subtype,
        throw_result=d.throw_result,error_type=d.error_type,difficulty=d.difficulty,updated_by_profile_id=actor where id=entry_id; end if;
    end if;
  end if;
  insert into public.player_live_entry_receipts(request_id,actor,membership_id,domain,session_id,operation,payload,entry_id)
    values(request_id,actor,target_membership,domain,target_session,operation,payload,result_id);
  return result_id;
end; $$;
revoke all on function public.write_player_live_entry(uuid,uuid,text,uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.write_player_live_entry(uuid,uuid,text,uuid,text,uuid,uuid,jsonb) to service_role;

-- Coaches configure existing sessions only; this never starts a session or changes attendance.
create function public.configure_player_live_entry(actor uuid,target_team uuid,domain text,target_session uuid,enabled boolean,fields jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.practices; s public.practice_sessions; w public.weight_room_workouts; permitted text[]; k text;
begin
  perform 1 from public.teams where id=target_team and active for share;
  if not found then raise exception 'Team unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.profile_team_memberships where profile_id=actor and team_id=target_team and active
      and role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'))
    and not exists(select 1 from public.organization_memberships m join public.teams t on t.organization_id=m.organization_id
      where m.profile_id=actor and m.active and m.role='ADMIN' and t.id=target_team)
    and not exists(select 1 from public.account_entitlements e where e.profile_id=actor and e.entitlement_key='SUPER_USER'
      and e.enabled and (e.expires_at is null or e.expires_at>now())) then raise exception 'Team authority required.' using errcode='42501'; end if;
  if enabled is null or domain is null or domain not in ('hitting','pitching','defense','workout') then raise exception 'Invalid configuration.'; end if;
  if domain='workout' then
    select * into w from public.weight_room_workouts where id=target_session and team_id=target_team for update;
    if not found or w.status<>'ACTIVE' or w.ended_at is not null or w.started_at is null or w.started_at>now() or w.created_by is null then
      raise exception 'Start the workout before enabling player entry.' using errcode='55000'; end if;
    update public.weight_room_workouts set player_entry_enabled=enabled,updated_at=now() where id=w.id;
  else
    select pr.* into p from public.practices pr join public.practice_sessions ps on ps.practice_id=pr.id
      where ps.id=target_session and pr.team_id=target_team for share of pr;
    if not found or p.status::text<>'active' or p.ended_at is not null or p.starts_at is null or p.starts_at>now() then
      raise exception 'Start Practice before enabling player entry.' using errcode='55000'; end if;
    select * into s from public.practice_sessions where id=target_session and category::text=domain for update;
    if not found or s.status<>'ACTIVE' or s.ended_at is not null or s.created_by_profile_id is null or s.secondary_player_id is not null
      or s.session_type in ('Live','Live BP') then raise exception 'An active assigned station is required.' using errcode='55000'; end if;
    if not exists(select 1 from public.player_team_memberships where player_id=s.player_id and team_id=p.team_id and season_id=p.season_id and active) then
      raise exception 'Active roster assignment required.' using errcode='42501'; end if;
    permitted:=case domain
      when 'hitting' then array['pitch_type','velocity','exit_velocity_mph','pitch_location','contact_result','contact_quality','direction','field_location']
      when 'pitching' then array['pitch_type','velocity','location','count_before','batted_ball','contact_quality']
      else array['rep_type','rep_subtype','throw_result','error_type','difficulty'] end;
    if jsonb_typeof(fields) is distinct from 'array' then raise exception 'Choose tracked fields.'; end if;
    for k in select jsonb_array_elements_text(fields) loop
      if not k=any(permitted) then raise exception 'Unsupported tracking field.'; end if;
    end loop;
    update public.practice_sessions set entry_policy=case when enabled then 'COACH_AND_ASSIGNED_PLAYERS' else 'COACH_ONLY' end,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('playerEntryFields',fields,'playerEntryConfiguredBy',actor,'playerEntryConfiguredAt',now()),
      updated_at=now() where id=s.id;
  end if;
end; $$;
revoke all on function public.configure_player_live_entry(uuid,uuid,text,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.configure_player_live_entry(uuid,uuid,text,uuid,boolean,jsonb) to service_role;
commit;
