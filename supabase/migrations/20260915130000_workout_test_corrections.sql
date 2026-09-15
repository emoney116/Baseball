-- Preserve canonical attempt identity and retain every correction for audit/retry.
alter table public.workout_sets add column test_revision integer not null default 0;
alter table public.workout_sets add column test_corrections jsonb not null default '[]';
alter table public.workout_sets add column test_correction_request uuid;

create or replace function public.guard_workout_test_attempt()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.weight_room_workout_stations; w public.weight_room_workouts; c jsonb; result numeric;
begin
  if tg_op='UPDATE' and old.test_conditions is not null then
    if (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
    if new.test_revision <> old.test_revision+1 or new.test_correction_request is null then
      raise exception 'Saved test attempts cannot be overwritten. Use Edit to correct the result.' using errcode='40001';
    end if;
    select * into w from public.weight_room_workouts where id=old.active_workout_id for share;
    if auth.uid() is null or not found or not public.is_team_staff(w.team_id) then raise exception 'Workout unavailable.' using errcode='42501'; end if;
    if w.status not in ('ACTIVE','COMPLETED') then raise exception 'Resume the workout before editing.' using errcode='55000'; end if;
    if (to_jsonb(new)-array['reps','value','updated_at','updated_by','test_revision','test_corrections','test_correction_request']) is distinct from
       (to_jsonb(old)-array['reps','value','updated_at','updated_by','test_revision','test_corrections','test_correction_request']) then
      raise exception 'Only the test result can be corrected.' using errcode='22023';
    end if;
    c:=old.test_conditions;
    result:=case when c->>'mode'='MAX_DURATION' then new.value else new.reps end;
    if result is null or result<0 or result::text in ('NaN','Infinity','-Infinity') or result>(case when c->>'mode'='MAX_DURATION' then 86400 else 10000 end) then raise exception 'Enter a valid test result.' using errcode='22023'; end if;
    if c->>'mode'='MAX_DURATION' then new.reps:=null; else new.value:=null; end if;
    if exists(select 1 from jsonb_array_elements(old.test_corrections) e where e->>'request'=new.test_correction_request::text) then raise exception 'Correction request already used.' using errcode='23505'; end if;
    new.updated_by:=auth.uid(); new.updated_at:=clock_timestamp();
    new.test_corrections:=old.test_corrections || jsonb_build_array(jsonb_build_object('request',new.test_correction_request,'actor',auth.uid(),'at',new.updated_at,'before',coalesce(old.value,old.reps::numeric),'after',result,'revision',new.test_revision));
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
  if result is null or result<0 or result>(case when c->>'mode'='MAX_DURATION' then 86400 else 10000 end) or result::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a valid test result.' using errcode='22023'; end if;
  new.weight:=(c->>'loadLb')::numeric; new.test_conditions:=c;
  new.test_revision:=0; new.test_corrections:='[]'; new.test_correction_request:=null;
  return new;
end $$;

create or replace function public.correct_workout_test(target_result uuid, expected_revision integer, request_id uuid, result_value numeric, completed_edit boolean default false)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.workout_sets; w public.weight_room_workouts; previous jsonb;
begin
  select * into r from public.workout_sets where id=target_result;
  if auth.uid() is null or not found or r.test_conditions is null then raise exception 'Result unavailable.' using errcode='42501'; end if;
  -- Same lock order as recording/end: workout before result.
  select * into w from public.weight_room_workouts where id=r.active_workout_id for share;
  if not found or not public.is_team_staff(w.team_id) then raise exception 'Workout unavailable.' using errcode='42501'; end if;
  select * into r from public.workout_sets where id=target_result for update;
  select e into previous from jsonb_array_elements(r.test_corrections) e where e->>'request'=request_id::text;
  if previous is not null then
    if previous->>'actor' is distinct from auth.uid()::text or (previous->>'after')::numeric is distinct from result_value then raise exception 'Request already used for a different correction.' using errcode='23505'; end if;
    return r.id;
  end if;
  if not ((w.status='ACTIVE' and w.ended_at is null) or (w.status='COMPLETED' and completed_edit)) then raise exception 'Workout ended or paused. Reopen Edit Results before correcting.' using errcode='55000'; end if;
  if expected_revision is null or expected_revision<>r.test_revision then raise exception 'Another coach changed this result. Reload the latest result before editing.' using errcode='40001'; end if;
  if request_id is null or result_value is null or result_value::text in ('NaN','Infinity','-Infinity') or result_value<0 or result_value>(case when r.test_conditions->>'mode'='MAX_DURATION' then 86400 else 10000 end) or (r.test_conditions->>'mode'<>'MAX_DURATION' and result_value<>trunc(result_value)) then raise exception 'Enter a valid test result.' using errcode='22023'; end if;
  update public.workout_sets set reps=case when test_conditions->>'mode'<>'MAX_DURATION' then result_value::integer end,
    value=case when test_conditions->>'mode'='MAX_DURATION' then result_value end,
    test_revision=test_revision+1,test_correction_request=request_id where id=r.id;
  return r.id;
end $$;
revoke all on function public.correct_workout_test(uuid,integer,uuid,numeric,boolean) from public,anon;
grant execute on function public.correct_workout_test(uuid,integer,uuid,numeric,boolean) to authenticated;
