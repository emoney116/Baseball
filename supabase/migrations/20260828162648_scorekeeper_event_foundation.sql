-- Scorer-first event envelope. This migration is intentionally additive so
-- existing local game logs remain readable while new games gain durable PA,
-- ordering, runner-resolution, and correction metadata.

alter table public.games
  add column if not exists active_plate_appearance_id uuid,
  add column if not exists plate_appearance_number integer not null default 1,
  add column if not exists pitch_number_in_plate_appearance integer not null default 0;

alter table public.plate_appearances
  add column if not exists appearance_number integer,
  add column if not exists inning integer,
  add column if not exists half text,
  add column if not exists outs_start integer,
  add column if not exists runners_start jsonb,
  add column if not exists score_start jsonb;

alter table public.game_pitch_events
  add column if not exists sequence_number integer,
  add column if not exists plate_appearance_id uuid references public.plate_appearances(id) on delete set null,
  add column if not exists plate_appearance_number integer,
  add column if not exists pitch_number_in_plate_appearance integer,
  add column if not exists contact_type text,
  add column if not exists runner_movements jsonb not null default '[]'::jsonb,
  add column if not exists rbi integer,
  add column if not exists scoring_note text,
  add column if not exists supersedes_event_id uuid references public.game_pitch_events(id) on delete set null,
  add column if not exists record_status text not null default 'confirmed';

alter table public.game_pitch_events
  drop constraint if exists game_pitch_events_record_status_check;

alter table public.game_pitch_events
  add constraint game_pitch_events_record_status_check
  check (record_status in ('confirmed', 'corrected', 'voided'));

create unique index if not exists game_pitch_events_game_sequence_unique
  on public.game_pitch_events(game_id, sequence_number)
  where sequence_number is not null;

create index if not exists game_pitch_events_plate_appearance_idx
  on public.game_pitch_events(plate_appearance_id, pitch_number_in_plate_appearance);
