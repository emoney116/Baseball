-- Keep durable receipts after deletion so retries cannot resurrect an undone pitch.
create table clubhouse_private.live_bp_actions (
  id uuid primary key,
  round_id uuid not null references public.live_bp_rounds(id),
  kind text not null check (kind in ('pitch','runner','undo')),
  version integer not null,
  actor uuid not null references public.profiles(id),
  before_state jsonb not null,
  detail jsonb not null default '{}',
  undone boolean not null default false,
  created_at timestamptz not null default now()
);
create index live_bp_actions_round on clubhouse_private.live_bp_actions(round_id,version);
alter table clubhouse_private.live_bp_actions enable row level security;
revoke all on clubhouse_private.live_bp_actions from public,anon,authenticated;
grant all on clubhouse_private.live_bp_actions to service_role;

-- Older count-off events intentionally omit counts; their internal count is zero.
insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state)
select id,live_bp_round_id,'pitch',event_number,created_by_profile_id,
  jsonb_build_object('balls',0,'strikes',0) || (live_bp_context->'before')
from public.hitting_events where live_bp_round_id is not null;

create function clubhouse_private.undo_bp_pitch(r public.live_bp_rounds, actor uuid, request_id uuid)
returns public.live_bp_rounds language plpgsql security invoker set search_path='' as $$
declare a clubhouse_private.live_bp_actions; result public.live_bp_rounds;
begin
  if request_id is null then raise exception 'Undo request required.'; end if;
  select * into a from clubhouse_private.live_bp_actions
    where round_id=r.id and kind='pitch' and not undone order by version desc limit 1;
  if not found then raise exception 'No pitch to undo.' using errcode='P0002'; end if;
  -- All deletes and state restoration occur under the caller's round lock.
  delete from public.defense_events where id=a.id and live_bp_round_id=r.id;
  delete from public.pitch_events where id=a.id and live_bp_round_id=r.id;
  delete from public.hitting_events where id=a.id and live_bp_round_id=r.id;
  update clubhouse_private.live_bp_actions set undone=true
    where round_id=r.id and version>=a.version and kind in ('pitch','runner');
  insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state,detail)
    values(request_id,r.id,'undo',r.version+1,actor,r.state,jsonb_build_object('pitchId',a.id));
  update public.live_bp_rounds set state=a.before_state,version=version+1 where id=r.id returning * into result;
  return result;
end; $$;
revoke all on function clubhouse_private.undo_bp_pitch(public.live_bp_rounds,uuid,uuid) from public,anon,authenticated;
grant execute on function clubhouse_private.undo_bp_pitch(public.live_bp_rounds,uuid,uuid) to service_role;

do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb)'::regprocedure);
  if position('if operation=''pitch'' and exists' in definition)=0
    or position('elsif operation=''pitch'' then' in definition)=0 then
    raise exception 'Expected Live BP write guards were not found';
  end if;
  definition := replace(definition, 'if operation=''pitch'' and exists', $guard$
  if operation in ('undo','runner','pitch') and exists (
    select 1 from clubhouse_private.live_bp_actions a where a.id=request_id and a.round_id=r.id
      and a.kind=operation and a.actor=$1
  ) then return r; end if;
  if operation='pitch' and exists$guard$);
  definition := replace(definition, 's:=case when operation', $undo$
  if operation='undo' then return clubhouse_private.undo_bp_pitch(r,actor,request_id); end if;
  s:=case when operation$undo$);
  definition := replace(definition, 'if operation=''start'' then return r;', $runner$
  for player in select value::uuid from jsonb_each_text(coalesce(
    case when operation in ('start','configure') then payload->'state'->'runnerIds' else r.state->'runnerIds' end,'{}'::jsonb)) loop
    perform 1 from public.player_team_memberships m join public.players pl on pl.id=m.player_id
      where m.player_id=player and m.team_id=p.team_id and m.season_id=p.season_id and m.active and pl.active for share of m,pl;
    if not found then raise exception 'Runner is not on this roster.' using errcode='42501'; end if;
  end loop;
  if operation='runner' then
    if request_id is null or payload->'stateBefore' is distinct from r.state then raise exception 'Stale runner context.' using errcode='40001'; end if;
    insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state,detail)
      values(request_id,r.id,'runner',r.version+1,actor,r.state,payload->'movement');
    update public.live_bp_rounds set state=payload->'stateAfter',version=version+1 where id=r.id returning * into r;
    return r;
  end if;
  if operation='start' then return r;$runner$);
  definition := replace(definition, 'elsif operation=''pitch'' then', $pitch$
  elsif operation='pitch' then
    insert into clubhouse_private.live_bp_actions(id,round_id,kind,version,actor,before_state)
      values(request_id,r.id,'pitch',r.version+1,actor,r.state);$pitch$);
  execute definition;
end;
$migration$;
