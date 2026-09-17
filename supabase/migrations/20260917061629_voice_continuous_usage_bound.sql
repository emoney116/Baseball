-- Bounded coach capture: 30 pitches/minute plus context, review and retries.
-- Authorization, actor serialization, idempotency and RLS remain unchanged.
create or replace function public.reserve_voice_usage(p_request_id uuid,p_actor_id uuid,p_team_id uuid,p_practice_id uuid,p_audio_seconds numeric)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text,71));
  if exists(select 1 from voice_usage where request_id=p_request_id) then return false; end if;
  if (select count(*) from voice_usage where actor_id=p_actor_id and created_at>now()-interval '1 minute')>=90
     or (select count(*) from voice_usage where actor_id=p_actor_id and created_at>now()-interval '24 hours')>=3000 then
    return false;
  end if;
  insert into voice_usage(request_id,actor_id,team_id,practice_id,audio_seconds)
    values(p_request_id,p_actor_id,p_team_id,p_practice_id,p_audio_seconds);
  return true;
end;
$$;
revoke all on function public.reserve_voice_usage(uuid,uuid,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.reserve_voice_usage(uuid,uuid,uuid,uuid,numeric) to service_role;
