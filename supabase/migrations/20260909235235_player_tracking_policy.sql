begin;

alter table public.teams add column player_tracking_policy text not null default 'LIVE_ONLY'
  check (player_tracking_policy in ('LIVE_ONLY','PERSONAL_AND_LIVE'));
create table public.player_tracking_policy_audit (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  changed_by uuid not null references public.profiles(id),
  previous_policy text not null, new_policy text not null,
  created_at timestamptz not null default now()
);
alter table public.player_tracking_policy_audit enable row level security;
revoke all on public.player_tracking_policy_audit from public,anon,authenticated;
grant all on public.player_tracking_policy_audit to service_role;

create function public.set_player_tracking_policy(actor uuid,target_team uuid,new_policy text)
returns void language plpgsql security invoker set search_path='' as $$
declare prior text;
begin
  select player_tracking_policy into prior from public.teams where id=target_team and active for update;
  if not found then raise exception 'Team unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.profile_team_memberships where profile_id=actor and team_id=target_team and active
    and role in ('OWNER','ADMIN','HEAD_COACH','ASSISTANT_COACH','STAFF','COACH'))
    and not exists(select 1 from public.organization_memberships m join public.teams t on t.organization_id=m.organization_id
      where m.profile_id=actor and m.active and m.role='ADMIN' and t.id=target_team)
    and not exists(select 1 from public.account_entitlements where profile_id=actor and entitlement_key='SUPER_USER'
      and enabled and (expires_at is null or expires_at>now())) then raise exception 'Team authority required.' using errcode='42501'; end if;
  if new_policy is null or new_policy not in ('LIVE_ONLY','PERSONAL_AND_LIVE') then raise exception 'Invalid policy.'; end if;
  update public.teams set player_tracking_policy=new_policy where id=target_team;
  insert into public.player_tracking_policy_audit(team_id,changed_by,previous_policy,new_policy) values(target_team,actor,prior,new_policy);
end; $$;
revoke all on function public.set_player_tracking_policy(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_player_tracking_policy(uuid,uuid,text) to service_role;

-- Personal sessions are not Practices. Canonical rep tables retain a separate parent.
create table public.player_personal_sessions (
  id uuid primary key,
  membership_id uuid not null references public.player_team_memberships(id),
  player_id uuid not null references public.players(id),
  team_id uuid not null references public.teams(id),
  season_id uuid not null references public.seasons(id),
  created_by_profile_id uuid not null references public.profiles(id),
  domain text not null check(domain in ('hitting','pitching','defense')),
  source text not null default 'PERSONAL' check(source='PERSONAL'),
  started_at timestamptz not null default now(), ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index player_personal_sessions_context on public.player_personal_sessions(team_id,season_id,player_id,started_at desc);
alter table public.player_personal_sessions enable row level security;
revoke all on public.player_personal_sessions from public,anon,authenticated;
grant all on public.player_personal_sessions to service_role;

create function clubhouse_private.require_personal_player(actor uuid,target_membership uuid)
returns public.player_team_memberships language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships;
begin
  m:=clubhouse_private.require_live_player(actor,target_membership,true);
  if not exists(select 1 from public.teams where id=m.team_id and player_tracking_policy='PERSONAL_AND_LIVE') then
    raise exception 'Personal sessions are not permitted.' using errcode='42501'; end if;
  return m;
end; $$;
revoke all on function clubhouse_private.require_personal_player(uuid,uuid) from public,anon,authenticated;
grant execute on function clubhouse_private.require_personal_player(uuid,uuid) to service_role;

-- Preserve the existing isolated body-weight/goal writer; guard training metadata separately.
alter function public.write_player_self_entry(uuid,uuid,text,text,uuid,date,numeric,text,boolean) rename to write_player_self_entry_owned;
revoke all on function public.write_player_self_entry_owned(uuid,uuid,text,text,uuid,date,numeric,text,boolean) from public,anon,authenticated;
create function public.write_player_self_entry(actor uuid,target_membership uuid,entry_kind text,operation text,
  entry_id uuid,entry_date date,body_weight_value numeric,goal_title text,goal_completed boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if entry_kind='body_weight' then perform clubhouse_private.require_personal_player(actor,target_membership); end if;
  return public.write_player_self_entry_owned(actor,target_membership,entry_kind,operation,entry_id,entry_date,body_weight_value,goal_title,goal_completed);
end; $$;
revoke all on function public.write_player_self_entry(uuid,uuid,text,text,uuid,date,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.write_player_self_entry(uuid,uuid,text,text,uuid,date,numeric,text,boolean) to service_role;

create function public.manage_player_personal_session(actor uuid,target_membership uuid,target_session uuid,domain text,operation text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships; s public.player_personal_sessions;
begin
  m:=clubhouse_private.require_personal_player(actor,target_membership);
  if target_session is null or domain is null or domain not in ('hitting','pitching','defense') or operation is null or operation not in ('start','end') then
    raise exception 'Invalid personal session.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_session::text,3));
  select * into s from public.player_personal_sessions where id=target_session for update;
  if found then
    if s.membership_id<>target_membership or s.created_by_profile_id<>actor or s.domain<>domain then
      raise exception 'Session ownership required.' using errcode='42501'; end if;
    if operation='end' then update public.player_personal_sessions set ended_at=coalesce(ended_at,now()) where id=s.id; end if;
    return s.id;
  end if;
  if operation<>'start' then raise exception 'Session unavailable.' using errcode='42501'; end if;
  insert into public.player_personal_sessions(id,membership_id,player_id,team_id,season_id,created_by_profile_id,domain)
    values(target_session,m.id,m.player_id,m.team_id,m.season_id,actor,domain);
  return target_session;
end; $$;
revoke all on function public.manage_player_personal_session(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.manage_player_personal_session(uuid,uuid,uuid,text,text) to service_role;

do $$ declare t text; begin
  foreach t in array array['hitting_events','pitch_events','defense_events'] loop
    execute format('alter table public.%I add column personal_session_id uuid references public.player_personal_sessions(id)',t);
    execute format('alter table public.%I add constraint %I check(personal_session_id is null or (practice_id is null and session_id is null and entry_source=''PLAYER'' and created_by_profile_id is not null))',t,t||'_personal_parent');
    execute format('create index %I on public.%I(personal_session_id) where personal_session_id is not null',t||'_personal_session',t);
    -- Personal reads/writes use approved-context server projections, never broad staff RLS.
    execute format('create policy personal_server_only on public.%I as restrictive for all to anon,authenticated using(personal_session_id is null) with check(personal_session_id is null)',t);
  end loop;
end $$;

create function clubhouse_private.protect_personal_parent() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.personal_session_id is distinct from old.personal_session_id then
    raise exception 'Personal provenance is immutable.' using errcode='42501'; end if;
  return new;
end; $$;
create trigger protect_personal_parent before update on public.hitting_events for each row execute function clubhouse_private.protect_personal_parent();
create trigger protect_personal_parent before update on public.pitch_events for each row execute function clubhouse_private.protect_personal_parent();
create trigger protect_personal_parent before update on public.defense_events for each row execute function clubhouse_private.protect_personal_parent();

create function public.write_player_personal_entry(actor uuid,target_membership uuid,domain text,target_session uuid,
  operation text,request_id uuid,entry_id uuid,payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships; s public.player_personal_sessions; receipt public.player_live_entry_receipts;
  tab text; owner_key text; allowed text[]; k text; old_row jsonb; patch jsonb; result_id uuid; seq integer;
  h public.hitting_events; p public.pitch_events; d public.defense_events;
begin
  m:=clubhouse_private.require_personal_player(actor,target_membership);
  select * into s from public.player_personal_sessions where id=target_session and membership_id=m.id
    and player_id=m.player_id and created_by_profile_id=actor and player_personal_sessions.domain=write_player_personal_entry.domain for update;
  if not found then raise exception 'Own personal session required.' using errcode='42501'; end if;
  if s.ended_at is not null then raise exception 'Personal session ended.' using errcode='55000'; end if;
  if operation is null or operation not in ('create','update','delete') or request_id is null
    or jsonb_typeof(payload) is distinct from 'object' or (operation<>'create' and entry_id is null) then
    raise exception 'Invalid personal entry.' using errcode='22023'; end if;
  tab:=case domain when 'hitting' then 'hitting_events' when 'pitching' then 'pitch_events' else 'defense_events' end;
  owner_key:=case domain when 'hitting' then 'hitter_id' when 'pitching' then 'pitcher_id' else 'player_id' end;
  allowed:=case domain when 'hitting' then array['action','pitch_type','velocity','exit_velocity_mph','pitch_location','contact_result','contact_quality','direction','field_location']
    when 'pitching' then array['outcome','pitch_type','velocity','location','count_before','batted_ball','contact_quality']
    else array['outcome','rep_type','rep_subtype','throw_result','error_type','difficulty'] end;
  foreach k in array array(select jsonb_object_keys(payload)) loop
    if not k=any(allowed) then raise exception 'Unsupported personal field.' using errcode='22023'; end if;
  end loop;
  foreach k in array array['velocity','exit_velocity_mph'] loop
    if payload ? k and ((payload->>k)::numeric::text in ('NaN','Infinity','-Infinity') or (payload->>k)::numeric<1 or (payload->>k)::numeric>130) then
      raise exception 'Invalid velocity.' using errcode='22023'; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into receipt from public.player_live_entry_receipts r where r.request_id=write_player_personal_entry.request_id;
  if found then
    if receipt.actor<>actor or receipt.membership_id<>m.id or receipt.domain<>domain or receipt.session_id<>s.id
      or receipt.operation<>operation or receipt.payload<>payload or (operation<>'create' and receipt.entry_id<>entry_id) then
      raise exception 'Request ID already used.' using errcode='23505'; end if;
    return receipt.entry_id;
  end if;
  result_id:=case when operation='create' then gen_random_uuid() else entry_id end;
  if operation<>'create' then
    execute format('select to_jsonb(e) from public.%I e where id=$1 for update',tab) into old_row using entry_id;
    if old_row is null or old_row->>'personal_session_id' is distinct from s.id::text
      or old_row->>owner_key is distinct from m.player_id::text or old_row->>'created_by_profile_id' is distinct from actor::text
      or old_row->>'entry_source' is distinct from 'PLAYER' or old_row->>'updated_by_profile_id' is distinct from actor::text then
      raise exception 'Only your personal entries can be changed.' using errcode='42501'; end if;
  end if;
  if operation='delete' then
    execute format('delete from public.%I where id=$1',tab) using entry_id;
  else
    execute format('select count(*)+1 from public.%I where personal_session_id=$1',tab) into seq using s.id;
    patch:=coalesce(old_row,'{}'::jsonb)||payload;
    if domain='hitting' then
      h:=jsonb_populate_record(null::public.hitting_events,patch);
      if h.action is null or h.action not in ('Took pitch','Swing','Miss','Foul','Ball in play') then raise exception 'Swing result required.'; end if;
      if operation='create' then
        insert into public.hitting_events(id,personal_session_id,hitter_id,event_number,action,contact_result,contact_quality,direction,field_location,pitch_location,pitch_type,velocity,exit_velocity_mph,context,created_by_profile_id,updated_by_profile_id,entry_source,verification_status,idempotency_key)
        values(result_id,s.id,m.player_id,seq,h.action,h.contact_result,h.contact_quality,h.direction,h.field_location,h.pitch_location,h.pitch_type,h.velocity,h.exit_velocity_mph,'personal',actor,actor,'PLAYER','PLAYER_RECORDED',request_id::text);
      else update public.hitting_events set action=h.action,contact_result=h.contact_result,contact_quality=h.contact_quality,direction=h.direction,field_location=h.field_location,pitch_location=h.pitch_location,pitch_type=h.pitch_type,velocity=h.velocity,exit_velocity_mph=h.exit_velocity_mph where id=entry_id; end if;
    elsif domain='pitching' then
      p:=jsonb_populate_record(null::public.pitch_events,patch);
      if p.outcome is null or p.outcome not in ('Ball','Called Strike','Swing','Take','Foul','Whiff','Ball in play','HBP') then raise exception 'Pitch result required.'; end if;
      p.is_swing:=p.outcome in ('Swing','Whiff','Foul','Ball in play');
      p.is_strike:=p.outcome in ('Called Strike','Swing','Whiff','Foul','Ball in play');
      p.is_zone:=coalesce((p.location->>'x')::numeric between 0.22 and 0.78 and (p.location->>'y')::numeric between 0.18 and 0.82,false);
      if operation='create' then
        insert into public.pitch_events(id,personal_session_id,pitcher_id,pitch_number,pitch_type,outcome,velocity,location,count_before,batted_ball,contact_quality,is_strike,is_swing,is_zone,is_chase,is_whiff,is_called_strike,is_ball_in_play,context,created_by_profile_id,updated_by_profile_id,entry_source,verification_status,idempotency_key)
        values(result_id,s.id,m.player_id,seq,coalesce(p.pitch_type,'Other'),p.outcome,p.velocity,p.location,p.count_before,p.batted_ball,p.contact_quality,p.is_strike,p.is_swing,p.is_zone,case when p.location is not null then p.is_swing and not p.is_zone end,p.outcome='Whiff',p.outcome='Called Strike',p.outcome='Ball in play','personal',actor,actor,'PLAYER','PLAYER_RECORDED',request_id::text);
      else update public.pitch_events set pitch_type=coalesce(p.pitch_type,'Other'),outcome=p.outcome,velocity=p.velocity,location=p.location,count_before=p.count_before,batted_ball=p.batted_ball,contact_quality=p.contact_quality,is_strike=p.is_strike,is_swing=p.is_swing,is_zone=p.is_zone,is_chase=case when p.location is not null then p.is_swing and not p.is_zone end,is_whiff=p.outcome='Whiff',is_called_strike=p.outcome='Called Strike',is_ball_in_play=p.outcome='Ball in play' where id=entry_id; end if;
    else
      d:=jsonb_populate_record(null::public.defense_events,patch);
      if d.outcome is null or d.outcome not in ('Clean','Error','Missed Rep','Good Play','Great Play') then raise exception 'Defense result required.'; end if;
      if operation='create' then
        insert into public.defense_events(id,personal_session_id,player_id,station,event_number,outcome,result,rep_type,rep_subtype,throw_result,error_type,difficulty,created_by_profile_id,updated_by_profile_id,entry_source,verification_status,idempotency_key)
        values(result_id,s.id,m.player_id,'Other',seq,d.outcome,d.outcome,d.rep_type,d.rep_subtype,d.throw_result,d.error_type,d.difficulty,actor,actor,'PLAYER','PLAYER_RECORDED',request_id::text);
      else update public.defense_events set outcome=d.outcome,result=d.outcome,rep_type=d.rep_type,rep_subtype=d.rep_subtype,throw_result=d.throw_result,error_type=d.error_type,difficulty=d.difficulty where id=entry_id; end if;
    end if;
  end if;
  insert into public.player_live_entry_receipts(request_id,actor,membership_id,domain,session_id,operation,payload,entry_id)
    values(request_id,actor,m.id,domain,s.id,operation,payload,result_id);
  return result_id;
end; $$;
revoke all on function public.write_player_personal_entry(uuid,uuid,text,uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.write_player_personal_entry(uuid,uuid,text,uuid,text,uuid,uuid,jsonb) to service_role;
commit;
