alter table public.defense_events
  add column if not exists position_worked text,
  add column if not exists drill_context text,
  add column if not exists rep_type text,
  add column if not exists rep_subtype text,
  add column if not exists result text,
  add column if not exists throw_result text,
  add column if not exists difficulty text,
  add column if not exists location jsonb,
  add column if not exists timing_seconds numeric,
  add column if not exists device_source text;

alter table public.defense_events
  drop constraint if exists defense_events_result_check,
  drop constraint if exists defense_events_throw_result_check,
  drop constraint if exists defense_events_difficulty_check,
  add constraint defense_events_result_check
    check (result is null or result in ('Clean', 'Error', 'Missed Rep', 'Good Play', 'Great Play')),
  add constraint defense_events_throw_result_check
    check (throw_result is null or throw_result in ('Accurate', 'Inaccurate', 'No Throw')),
  add constraint defense_events_difficulty_check
    check (difficulty is null or difficulty in ('Routine', 'Difficult', 'Plus'));

create index if not exists defense_events_position_worked_idx
  on public.defense_events(position_worked);

create index if not exists defense_events_drill_context_idx
  on public.defense_events(drill_context);

create index if not exists defense_events_rep_type_idx
  on public.defense_events(rep_type);
