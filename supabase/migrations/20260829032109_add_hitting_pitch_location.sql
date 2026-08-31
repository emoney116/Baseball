alter table public.hitting_events
  add column if not exists pitch_location jsonb;

create index if not exists hitting_events_pitch_location_idx
  on public.hitting_events using gin (pitch_location)
  where pitch_location is not null;
