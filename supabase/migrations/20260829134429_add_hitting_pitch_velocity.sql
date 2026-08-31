alter table public.hitting_events
  drop constraint if exists hitting_events_exit_velocity_mph_check,
  add constraint hitting_events_exit_velocity_mph_check
    check (exit_velocity_mph is null or (exit_velocity_mph >= 1 and exit_velocity_mph <= 300));
