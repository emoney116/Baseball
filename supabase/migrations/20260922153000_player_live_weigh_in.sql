-- Body weight uses the same player/day record as coach weigh-ins and workout sets.
create or replace function public.write_player_live_weigh_in(actor uuid,target_membership uuid,target_workout uuid,pounds numeric)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m public.player_team_memberships; w public.weight_room_workouts; d public.workout_sessions;
begin
  m:=clubhouse_private.require_live_player(actor,target_membership,true);
  select * into w from public.weight_room_workouts where id=target_workout and team_id=m.team_id and season_id=m.season_id for update;
  if not found or w.status<>'ACTIVE' or w.ended_at is not null or w.started_at is null or w.started_at>now() or w.created_by is null then
    raise exception 'Workout ended.' using errcode='55000'; end if;
  if pounds is null or pounds::text in ('NaN','Infinity','-Infinity') or pounds<30 or pounds>700 then
    raise exception 'Body weight must be 30-700 lb.' using errcode='22023'; end if;
  if exists(select 1 from public.weight_room_workout_group_members where workout_id=w.id and player_id=m.player_id and participant_status in ('NOT_PARTICIPATING','SKIPPED')) then
    raise exception 'Participation excluded.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(m.player_id::text||w.workout_date::text,1));
  select * into d from public.workout_sessions where player_id=m.player_id and session_date=w.workout_date for update;
  if found then
    if d.team_id is distinct from m.team_id or d.season_id is distinct from m.season_id then raise exception 'Different team context.' using errcode='42501'; end if;
    update public.workout_sessions set body_weight=pounds,updated_at=now() where id=d.id;
  else
    insert into public.workout_sessions(organization_id,team_id,season_id,player_id,session_date,week_of,day_name,body_weight,created_by_profile_id,entry_source)
    values(w.organization_id,m.team_id,m.season_id,m.player_id,w.workout_date,date_trunc('week',w.workout_date)::date,to_char(w.workout_date,'Dy'),pounds,actor,'PLAYER_LIVE') returning * into d;
  end if;
  return d.id;
end $$;
revoke all on function public.write_player_live_weigh_in(uuid,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.write_player_live_weigh_in(uuid,uuid,uuid,numeric) to service_role;
