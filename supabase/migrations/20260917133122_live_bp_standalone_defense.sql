-- Reuse the authorized, locked Live BP action stream for fielding-only reps.
alter table clubhouse_private.live_bp_actions drop constraint live_bp_actions_kind_check;
alter table clubhouse_private.live_bp_actions add constraint live_bp_actions_kind_check
  check(kind in ('pitch','runner','undo','defense','amend'));

do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb)'::regprocedure);
  if position('operation in (''undo'',''runner'',''pitch'')' in definition)=0
    or position('if operation=''start'' then return r;' in definition)=0 then
    raise exception 'Expected Live BP action guards missing';
  end if;
  definition:=replace(definition,'operation in (''undo'',''runner'',''pitch'')','operation in (''undo'',''runner'',''pitch'',''defense'',''amend'')');
  definition:=replace(definition,'if operation=''runner'' then', $runner$
  if operation='runner' and payload->'movement'->>'reason'='On last play' then
    select * into h from public.hitting_events where live_bp_round_id=r.id order by event_number desc limit 1;
    if not found or h.created_at<now()-interval '90 seconds' then
      raise exception 'No recent play to correct. Use the manual runner controls.' using errcode='PT409'; end if;
    payload:=jsonb_set(payload,'{movement,pitchId}',to_jsonb(h.id));
  end if;
  if operation='runner' then$runner$);
  definition:=replace(definition,'if operation=''start'' then return r;', $defense$
  if operation='amend' then
    select * into h from public.hitting_events where live_bp_round_id=r.id order by event_number desc limit 1 for update;
    if not found or h.action<>'Ball in play' or h.created_at<now()-interval '90 seconds' then
      raise exception 'No recent compatible BIP to amend.' using errcode='PT409'; end if;
    if request_id is null or payload->>'ev' is null or (payload->>'ev')::numeric not between 20 and 130 then
      raise exception 'Valid exit velocity and request required.'; end if;
    insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state,detail)
      values(request_id,r.id,'amend',r.version+1,actor,r.state,jsonb_build_object('pitchId',h.id,'beforeEv',h.exit_velocity_mph,'afterEv',payload->'ev'));
    update public.hitting_events set exit_velocity_mph=(payload->>'ev')::numeric where id=h.id;
    update public.live_bp_rounds set version=version+1 where id=r.id returning * into r;
    return r;
  end if;
  if operation='defense' then
    if request_id is null or payload->'stateBefore' is distinct from r.state then
      raise exception 'Stale defense context.' using errcode='40001'; end if;
    de:=jsonb_populate_record(null::public.defense_events,payload->'defense');
    if de.player_id is null or (s->'alignment'->>de.position_worked)::uuid is distinct from de.player_id
      or de.result is null or de.result not in ('Clean','Error','Missed Rep','Great Play') then
      raise exception 'Assigned fielder and result required.' using errcode='42501'; end if;
    session:=clubhouse_private.bp_session(r.id,p.id,actor,de.player_id,'defense',source);
    if payload->>'lastPlay'='true' then
      select * into h from public.hitting_events where live_bp_round_id=r.id order by event_number desc limit 1 for update;
      if not found or h.action<>'Ball in play' or h.created_at<now()-interval '90 seconds' or h.event_number<>r.version then
        raise exception 'Last-play fielding context changed. Review manually.' using errcode='PT409'; end if;
      if exists(select 1 from public.defense_events d where d.id=h.id and (d.player_id<>de.player_id or d.position_worked<>de.position_worked)) then
        raise exception 'Last play already has a different graded fielder. Review manually.' using errcode='PT409'; end if;
      insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state,detail)
        values(request_id,r.id,'defense',r.version+1,actor,r.state,jsonb_build_object('pitchId',h.id,'beforeDefense',(select to_jsonb(d) from public.defense_events d where d.id=h.id),'afterDefense',payload->'defense'));
      insert into public.defense_events(id,practice_id,session_id,player_id,station,event_number,outcome,result,position_worked,rep_type,error_type,created_by_profile_id,idempotency_key,live_bp_round_id,live_bp_context)
        values(h.id,p.id,session,de.player_id,de.station,h.event_number,de.result,de.result,de.position_worked,null,de.error_type,actor,h.id::text,r.id,h.live_bp_context)
        on conflict(id) do update set result=excluded.result,outcome=excluded.outcome,error_type=excluded.error_type;
      update public.live_bp_rounds set version=version+1 where id=r.id returning * into r;
      return r;
    end if;
    insert into public.defense_events(id,practice_id,session_id,player_id,station,event_number,outcome,result,position_worked,rep_type,error_type,throw_result,location,created_by_profile_id,idempotency_key,live_bp_round_id,live_bp_context)
      values(request_id,p.id,session,de.player_id,de.station,r.version+1,de.result,de.result,de.position_worked,de.rep_type,de.error_type,de.throw_result,de.location,actor,request_id::text,r.id,
        jsonb_build_object('standaloneDefense',true,'before',r.state,'after',r.state,'source',source));
    insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state,detail)
      values(request_id,r.id,'defense',r.version+1,actor,r.state,payload->'defense');
    update public.live_bp_rounds set version=version+1 where id=r.id returning * into r;
    return r;
  end if;
  if operation='start' then return r;$defense$);
  execute definition;
  definition:=pg_get_functiondef('clubhouse_private.undo_bp_pitch(public.live_bp_rounds,uuid,uuid)'::regprocedure);
  if position('kind=''pitch'' and not undone' in definition)=0 then raise exception 'Expected Undo selection missing'; end if;
  definition:=replace(definition,'kind=''pitch'' and not undone','kind in (''pitch'',''defense'') and not (kind=''defense'' and detail ? ''pitchId'') and not undone');
  definition:=replace(definition,'kind in (''pitch'',''runner'')','kind in (''pitch'',''runner'',''defense'',''amend'')');
  execute definition;
end;
$migration$;
