alter table public.game_pitch_events
  add column if not exists event_kind text not null default 'pitch',
  add column if not exists pitch_number integer,
  add column if not exists runner_action text,
  add column if not exists runner_id uuid references public.players(id) on delete set null,
  add column if not exists runner_base text,
  add column if not exists count_before jsonb,
  add column if not exists count_after jsonb,
  add column if not exists runners_before jsonb,
  add column if not exists runners_after jsonb,
  add column if not exists state_before jsonb,
  add column if not exists state_after jsonb,
  add column if not exists field_location jsonb;

create index if not exists game_pitch_events_game_created_idx
  on public.game_pitch_events(game_id, created_at desc);
