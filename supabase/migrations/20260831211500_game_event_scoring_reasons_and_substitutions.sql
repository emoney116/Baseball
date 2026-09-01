alter table public.game_pitch_events
  add column if not exists scoring_reason text,
  add column if not exists substitution jsonb;

comment on column public.game_pitch_events.scoring_reason is
  'Structured reason selected when a runner advances or scores.';

comment on column public.game_pitch_events.substitution is
  'Outgoing player, incoming player, defensive position, and lineup slot for an in-game personnel change.';
