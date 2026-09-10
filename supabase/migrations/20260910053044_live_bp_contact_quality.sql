-- Preserve optional coach-assessed contact quality in both canonical event domains.
create or replace function public.write_live_bp(actor uuid, practice uuid, round_id uuid, operation text, expected_version integer, request_id uuid, payload jsonb)
returns public.live_bp_rounds language plpgsql security invoker set search_path='' as $$
declare p public.practices; r public.live_bp_rounds; player uuid; s jsonb; session uuid;
  h public.hitting_events; pe public.pitch_events; de public.defense_events; source text;
begin
  -- Lock order agrees with Practice end; authority is re-read on every write.
  select * into p from public.practices where id=practice for share;
  if not found then raise exception 'Practice unavailable.' using errcode='42501'; end if;
  perform 1 from public.teams t join public.seasons s on s.team_id=t.id
    where t.id=p.team_id and s.id=p.season_id and t.organization_id=p.organization_id and t.active and s.active for share of t,s;
  if not found then raise exception 'Team or season unavailable.' using errcode='42501'; end if;
  perform 1 from public.profile_team_memberships where profile_id=actor and team_id=p.team_id and active
    and role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH') for share;
  if not found then
    perform 1 from public.organization_memberships where profile_id=actor and organization_id=p.organization_id and active and role='ADMIN' for share;
    if not found then
      perform 1 from public.account_entitlements where profile_id=actor and entitlement_key='SUPER_USER' and enabled and (expires_at is null or expires_at>now()) for share;
      if not found then raise exception 'Coach authority required.' using errcode='42501'; end if;
    end if;
  end if;
  if p.status::text<>'active' or p.ended_at is not null or p.starts_at is null or p.starts_at>now() then
    raise exception 'Practice is not running.' using errcode='55000'; end if;
  if operation='start' then
    insert into public.live_bp_rounds(id,practice_id,created_by_profile_id,settings,state)
      values(round_id,practice,actor,payload->'settings',payload->'state') on conflict(id) do nothing;
  end if;
  select * into r from public.live_bp_rounds where id=round_id and practice_id=p.id for update;
  if not found then raise exception 'Round unavailable.' using errcode='42501'; end if;
  if r.ended_at is not null then raise exception 'Round ended.' using errcode='55000'; end if;
  if operation='pitch' and exists(select 1 from public.hitting_events where id=request_id and live_bp_round_id=r.id and created_by_profile_id=actor) then return r; end if;
  if operation<>'start' and r.version is distinct from expected_version then raise exception 'Round changed. Reload before saving.' using errcode='40001'; end if;
  s:=case when operation in ('start','configure') then payload->'settings' else r.settings end;
  source:=s->>'source';
  if source not in ('MACHINE','COACH','PLAYER') or s->>'hitterId' is null then raise exception 'Invalid source.'; end if;
  if source='PLAYER' and (s->>'pitcherId' is null or s->>'pitcherId'=s->>'hitterId') then raise exception 'Select distinct hitter and pitcher.'; end if;
  for player in select (s->>'hitterId')::uuid union select (s->>'pitcherId')::uuid where source='PLAYER'
    union select value::uuid from jsonb_each_text(coalesce(s->'alignment','{}'::jsonb)) where value<>'' loop
    perform 1 from public.player_team_memberships m join public.players pl on pl.id=m.player_id
      where m.player_id=player and m.team_id=p.team_id and m.season_id=p.season_id and m.active and pl.active for share of m,pl;
    if not found then raise exception 'Player is not on this roster.' using errcode='42501'; end if;
  end loop;
  if operation='start' then return r;
  elsif operation='configure' then
    update public.live_bp_rounds set settings=s,state=payload->'state',version=version+1 where id=r.id returning * into r;
  elsif operation='end' then
    update public.live_bp_rounds set ended_at=now(),version=version+1 where id=r.id returning * into r;
    update public.practice_sessions set ended_at=now(),status='COMPLETED' where metadata->>'liveBpRoundId'=r.id::text;
  elsif operation='pitch' then
    if request_id is null or payload->'context'->'before' is distinct from r.state then raise exception 'Stale pitch context.' using errcode='40001'; end if;
    session:=clubhouse_private.bp_session(r.id,p.id,actor,(s->>'hitterId')::uuid,'hitting',source);
    h:=jsonb_populate_record(null::public.hitting_events,payload->'hitting');
    insert into public.hitting_events(id,practice_id,session_id,hitter_id,pitcher_id,event_number,action,contact_result,contact_quality,field_location,pitch_location,pitch_type,velocity,exit_velocity_mph,is_live_bp,context,created_by_profile_id,idempotency_key,live_bp_round_id,live_bp_context)
      values(request_id,p.id,session,(s->>'hitterId')::uuid,case when source='PLAYER' then (s->>'pitcherId')::uuid end,r.version+1,h.action,h.contact_result,h.contact_quality,h.field_location,h.pitch_location,h.pitch_type,h.velocity,h.exit_velocity_mph,true,'live_bp',actor,request_id::text,r.id,payload->'context');
    if source='PLAYER' then
      session:=clubhouse_private.bp_session(r.id,p.id,actor,(s->>'pitcherId')::uuid,'pitching',source);
      pe:=jsonb_populate_record(null::public.pitch_events,payload->'pitching');
      insert into public.pitch_events(id,practice_id,session_id,pitcher_id,hitter_id,pitch_number,pitch_type,outcome,velocity,location,is_strike,is_swing,is_zone,is_chase,is_whiff,is_called_strike,is_ball_in_play,batted_ball,contact_quality,count_before,count_after,context,created_by_profile_id,idempotency_key,live_bp_round_id,live_bp_context)
        values(request_id,p.id,session,(s->>'pitcherId')::uuid,(s->>'hitterId')::uuid,r.version+1,pe.pitch_type,pe.outcome,pe.velocity,pe.location,pe.is_strike,pe.is_swing,pe.is_zone,pe.is_chase,pe.is_whiff,pe.is_called_strike,pe.is_ball_in_play,pe.batted_ball,pe.contact_quality,pe.count_before,pe.count_after,'live_bp',actor,request_id::text,r.id,payload->'context');
    end if;
    if payload->'defense' is not null and payload->'defense'<>'null'::jsonb then
      de:=jsonb_populate_record(null::public.defense_events,payload->'defense');
      if s->>'defense'='OFF' or h.action<>'Ball in play' or (s->'alignment'->>de.position_worked)::uuid is distinct from de.player_id
        or (s->>'defense'='SELECTED' and not s->'positions' ? de.position_worked) then raise exception 'Defense is not enabled.' using errcode='42501'; end if;
      session:=clubhouse_private.bp_session(r.id,p.id,actor,de.player_id,'defense',source);
      insert into public.defense_events(id,practice_id,session_id,player_id,station,event_number,outcome,result,position_worked,rep_type,error_type,throw_result,location,created_by_profile_id,idempotency_key,live_bp_round_id,live_bp_context)
        values(request_id,p.id,session,de.player_id,de.station,r.version+1,de.outcome,de.result,de.position_worked,de.rep_type,de.error_type,de.throw_result,de.location,actor,request_id::text,r.id,payload->'context');
    end if;
    update public.live_bp_rounds set state=payload->'context'->'after',version=version+1 where id=r.id returning * into r;
  else raise exception 'Invalid Live BP operation.'; end if;
  return r;
end; $$;
revoke all on function public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb) to service_role;
