alter table public.hitting_events
  add column if not exists exit_velocity_mph numeric;

alter table public.hitting_events
  drop constraint if exists hitting_events_exit_velocity_mph_check,
  add constraint hitting_events_exit_velocity_mph_check
    check (exit_velocity_mph is null or (exit_velocity_mph >= 20 and exit_velocity_mph <= 130));

create index if not exists hitting_events_exit_velocity_mph_idx
  on public.hitting_events(practice_id, hitter_id, exit_velocity_mph)
  where exit_velocity_mph is not null;
