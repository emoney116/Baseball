-- Additive testing metadata; existing exercises, workouts and results are retained.
alter table public.weight_room_workout_stations add column if not exists test_conditions jsonb;
alter table public.weight_room_exercise_preset_items add column if not exists test_conditions jsonb;
alter table public.workout_sets add column if not exists test_conditions jsonb;
alter table public.workout_sets add column if not exists test_side text;
alter table public.workout_sets add column if not exists test_attempt integer;
alter table public.weight_room_workouts add column if not exists circuit_revision integer not null default 0;

create or replace function public.valid_workout_test_conditions(c jsonb)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select coalesce(jsonb_typeof(c)='object'
    and c->>'key' ~ '^[a-z0-9-]{1,80}$'
    and c->>'mode' in ('TIMED_REPS','FIXED_LOAD_TIMED_REPS','MAX_DURATION')
    and (c->>'mode'='MAX_DURATION' or (jsonb_typeof(c->'durationSeconds')='number' and (c->>'durationSeconds')::numeric between 1 and 3600 and (c->>'durationSeconds')::numeric=trunc((c->>'durationSeconds')::numeric)))
    and (not(c ? 'loadLb') or (jsonb_typeof(c->'loadLb')='number' and (c->>'loadLb')::numeric between 0 and 2000))
    and (c->>'mode'<>'FIXED_LOAD_TIMED_REPS' or c ? 'loadLb')
    and (not(c ? 'bilateral') or jsonb_typeof(c->'bilateral')='boolean')
    and (not(c ? 'configurableLoad') or jsonb_typeof(c->'configurableLoad')='boolean'),false)
$$;
alter table public.weight_room_workout_stations add constraint workout_station_test_conditions_valid check(test_conditions is null or public.valid_workout_test_conditions(test_conditions));
alter table public.weight_room_exercise_preset_items add constraint workout_preset_test_conditions_valid check(test_conditions is null or public.valid_workout_test_conditions(test_conditions));

-- All existing entry paths retain their RLS; test attempts are append-only.
create or replace function public.guard_workout_test_attempt()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.weight_room_workout_stations; w public.weight_room_workouts; c jsonb; result numeric;
begin
  if tg_op='UPDATE' and old.test_conditions is not null then
    if (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then raise exception 'Saved test attempts cannot be overwritten. Record a new attempt.' using errcode='23505'; end if;
    return new;
  end if;
  select * into s from public.weight_room_workout_stations where id=new.workout_station_id;
  if s.test_conditions is null then
    if new.test_conditions is not null then raise exception 'Test station is required.' using errcode='22023'; end if;
    return new;
  end if;
  select * into w from public.weight_room_workouts where id=s.workout_id for share;
  if not found or w.status<>'ACTIVE' or w.ended_at is not null then raise exception 'Workout is no longer active.' using errcode='55000'; end if;
  if new.active_workout_id is distinct from w.id or new.exercise_id is distinct from s.exercise_id then raise exception 'Test context does not match station.' using errcode='22023'; end if;
  c:=s.test_conditions;
  if coalesce((c->>'bilateral')::boolean,false) then
    new.test_side:=case when coalesce(new.set_number,1)%2=1 then 'Left' else 'Right' end;
    new.test_attempt:=(coalesce(new.set_number,1)+1)/2;
  else new.test_side:=null; new.test_attempt:=coalesce(new.set_number,1); end if;
  if new.test_attempt not between 1 and 100 then raise exception 'Check attempt.' using errcode='22023'; end if;
  if c->>'mode'='MAX_DURATION' then result:=new.value; new.reps:=null; new.unit:='sec';
  else result:=new.reps; new.value:=null; new.unit:='reps'; end if;
  if result is null or result<0 or result>(case when c->>'mode'='MAX_DURATION' then 86400 else 10000 end) or result::text='NaN' then raise exception 'Enter a valid test result.' using errcode='22023'; end if;
  new.weight:=(c->>'loadLb')::numeric;
  new.test_conditions:=c;
  return new;
end $$;
create trigger guard_workout_test_attempt before insert or update on public.workout_sets for each row execute function public.guard_workout_test_attempt();

create or replace function public.record_workout_test(
  target_workout uuid, target_station uuid, athlete uuid, request_id uuid,
  result_value numeric, attempt_number integer default 1, side text default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  w public.weight_room_workouts; s public.weight_room_workout_stations;
  daily public.workout_sessions; prior public.workout_sets; c jsonb;
  group_id uuid; slot integer; answer uuid;
begin
  if auth.uid() is null then raise exception 'Sign in.' using errcode='42501'; end if;
  select * into w from public.weight_room_workouts where id=target_workout for share;
  if not found or not public.is_team_staff(w.team_id) then raise exception 'Workout unavailable.' using errcode='42501'; end if;
  select * into s from public.weight_room_workout_stations where id=target_station and workout_id=w.id and archived_at is null for share;
  if not found or s.exercise_id is null then raise exception 'Station unavailable.' using errcode='22023'; end if;
  c:=s.test_conditions;
  if c is null or c->>'mode' not in ('TIMED_REPS','FIXED_LOAD_TIMED_REPS','MAX_DURATION') or c->>'key' is null then raise exception 'Test is not configured.' using errcode='22023'; end if;
  if request_id is null or result_value is null or result_value<0 or result_value>86400 or attempt_number is null or attempt_number<1 or attempt_number>100 then raise exception 'Check result and attempt.' using errcode='22023'; end if;
  if c->>'mode'<>'MAX_DURATION' and (result_value<>trunc(result_value) or result_value>10000 or coalesce((c->>'durationSeconds')::integer,0)<=0) then raise exception 'Enter whole reps for the timed test.' using errcode='22023'; end if;
  if c->>'mode'='FIXED_LOAD_TIMED_REPS' and c->>'loadLb' is null then raise exception 'Configure the fixed load.' using errcode='22023'; end if;
  if coalesce((c->>'bilateral')::boolean,false) then
    if side is null or side not in ('Left','Right') then raise exception 'Choose Left or Right.' using errcode='22023'; end if;
    slot:=attempt_number*2-case when side='Left' then 1 else 0 end;
  else
    if side is not null then raise exception 'This test has no side.' using errcode='22023'; end if;
    slot:=attempt_number;
  end if;
  if not exists(select 1 from public.player_team_memberships where player_id=athlete and team_id=w.team_id and season_id=w.season_id and active) then raise exception 'Athlete is not on the active roster.' using errcode='42501'; end if;
  -- Existing player/day identity lock is shared with Player Live Weight Room writes.
  perform pg_advisory_xact_lock(hashtextextended(athlete::text||w.workout_date::text,1));
  select * into prior from public.workout_sets where idempotency_key=request_id::text;
  if found then
    if prior.created_by is distinct from auth.uid() or prior.active_workout_id is distinct from w.id or prior.workout_station_id is distinct from s.id or prior.player_id is distinct from athlete or prior.test_side is distinct from side or prior.test_attempt is distinct from attempt_number or coalesce(prior.value,prior.reps::numeric) is distinct from result_value then raise exception 'Request already used for a different result.' using errcode='23505'; end if;
    return prior.id;
  end if;
  if w.status<>'ACTIVE' or w.ended_at is not null then raise exception 'Workout is no longer active. Your result was not saved.' using errcode='55000'; end if;
  if exists(select 1 from public.workout_sets where active_workout_id=w.id and player_id=athlete and exercise_id=s.exercise_id and coalesce(set_number,1)=slot) then raise exception 'This attempt was already saved. Refresh or choose a new attempt.' using errcode='23505'; end if;
  select * into daily from public.workout_sessions where player_id=athlete and session_date=w.workout_date for update;
  if found and (daily.team_id is distinct from w.team_id or daily.season_id is distinct from w.season_id) then raise exception 'Workout day belongs to another team context.' using errcode='42501'; end if;
  if not found then
    insert into public.workout_sessions(organization_id,team_id,season_id,player_id,session_date,week_of,day_name,created_by_profile_id,entry_source)
      values(w.organization_id,w.team_id,w.season_id,athlete,w.workout_date,date_trunc('week',w.workout_date)::date,to_char(w.workout_date,'Dy'),auth.uid(),'COACH') returning * into daily;
  end if;
  select m.group_id into group_id from public.weight_room_workout_group_members m where m.workout_id=w.id and m.player_id=athlete and m.participant_status not in ('SKIPPED','NOT_PARTICIPATING','NOT_ASSIGNED');
  insert into public.workout_sets(workout_session_id,player_id,exercise_id,set_number,sets,weight,reps,value,unit,status,created_by,entry_source,active_workout_id,workout_station_id,workout_group_id,idempotency_key,completed_at,updated_by,test_conditions,test_side,test_attempt)
    values(daily.id,athlete,s.exercise_id,slot,1,(c->>'loadLb')::numeric,
      case when c->>'mode'<>'MAX_DURATION' then result_value::integer end,
      case when c->>'mode'='MAX_DURATION' then result_value end,
      case when c->>'mode'='MAX_DURATION' then 'sec' else 'reps' end,
      'Completed',auth.uid(),'COACH',w.id,s.id,group_id,request_id::text,now(),auth.uid(),c,side,attempt_number) returning id into answer;
  return answer;
end $$;
revoke all on function public.record_workout_test(uuid,uuid,uuid,uuid,numeric,integer,text) from public,anon;
grant execute on function public.record_workout_test(uuid,uuid,uuid,uuid,numeric,integer,text) to authenticated;

create or replace function public.rotate_workout_circuit(target_workout uuid, expected_revision integer)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare w public.weight_room_workouts; station_ids uuid[];
begin
  select * into w from public.weight_room_workouts where id=target_workout for update;
  if auth.uid() is null or not found or not public.is_team_staff(w.team_id) then raise exception 'Workout unavailable.' using errcode='42501'; end if;
  if w.status<>'ACTIVE' or w.ended_at is not null then raise exception 'Workout is no longer active.' using errcode='55000'; end if;
  if expected_revision is null or w.circuit_revision<>expected_revision then raise exception 'Rotation changed. Refresh before rotating again.' using errcode='40001'; end if;
  select array_agg(id order by display_order) into station_ids from public.weight_room_workout_stations where workout_id=w.id and archived_at is null;
  if coalesce(array_length(station_ids,1),0)=0 then raise exception 'Add stations before rotating.' using errcode='22023'; end if;
  update public.weight_room_workout_groups set current_station_id=station_ids[(coalesce(array_position(station_ids,current_station_id),0)%array_length(station_ids,1))+1],updated_at=now() where workout_id=w.id;
  update public.weight_room_workouts set circuit_revision=circuit_revision+1,updated_at=now() where id=w.id returning circuit_revision into expected_revision;
  return expected_revision;
end $$;
revoke all on function public.rotate_workout_circuit(uuid,integer) from public,anon;
grant execute on function public.rotate_workout_circuit(uuid,integer) to authenticated;
