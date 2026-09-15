-- Operational metering only. Canonical baseball events remain in existing tables.
create table public.voice_usage (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  team_id uuid not null references public.teams(id),
  practice_id uuid not null references public.practices(id),
  created_at timestamptz not null default now(),
  audio_seconds numeric not null check (audio_seconds > 0 and audio_seconds <= 12),
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  latency_ms integer,
  interpretation_ms integer check (interpretation_ms between 0 and 30000),
  save_latency_ms integer check (save_latency_ms between 0 and 120000),
  confidence_band text check (confidence_band in ('low','review','high')),
  manual_correction boolean not null default false,
  auto_saved boolean not null default false,
  undo_requested boolean not null default false,
  estimated_cost_usd numeric check (estimated_cost_usd >= 0),
  failure_code text,
  provider text not null default 'openai',
  model text not null default 'whisper-1'
);
alter table public.voice_usage enable row level security;
revoke all on public.voice_usage from anon, authenticated;
grant select, insert, update on public.voice_usage to service_role;
create index voice_usage_actor_time on public.voice_usage(actor_id,created_at);

create function public.reserve_voice_usage(p_request_id uuid,p_actor_id uuid,p_team_id uuid,p_practice_id uuid,p_audio_seconds numeric)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text,71));
  if exists(select 1 from voice_usage where request_id=p_request_id) then return false; end if;
  if (select count(*) from voice_usage where actor_id=p_actor_id and created_at>now()-interval '1 minute')>=30
     or (select count(*) from voice_usage where actor_id=p_actor_id and created_at>now()-interval '24 hours')>=1000 then
    return false;
  end if;
  insert into voice_usage(request_id,actor_id,team_id,practice_id,audio_seconds)
    values(p_request_id,p_actor_id,p_team_id,p_practice_id,p_audio_seconds);
  return true;
end;
$$;
revoke all on function public.reserve_voice_usage(uuid,uuid,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.reserve_voice_usage(uuid,uuid,uuid,uuid,numeric) to service_role;

select cron.schedule('voice-usage-retention', '15 4 * * *',
  $$delete from public.voice_usage where created_at < now() - interval '30 days'$$);
