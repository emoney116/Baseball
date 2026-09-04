-- Internal QA data is kept separate from customer-entered records.  The
-- application only ever targets the run IDs recorded here when it cleans up.
create table if not exists public.demo_seed_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  requested_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  seed_version text not null,
  action text not null check (action in ('seed', 'delete')),
  dataset text not null,
  volume text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  created_counts jsonb not null default '{}'::jsonb,
  deleted_counts jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

create index if not exists demo_seed_runs_target_created_idx
  on public.demo_seed_runs(team_id, season_id, started_at desc);

alter table public.demo_seed_runs enable row level security;
revoke all on public.demo_seed_runs from anon, authenticated;
grant all on public.demo_seed_runs to service_role;

-- Direct markers make every generated record auditable.  These are additive
-- and never infer demo status from a name, date, or player identity.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'practices', 'practice_sessions', 'pitch_events', 'hitting_events', 'defense_events',
    'workouts', 'workout_sessions', 'workout_sets', 'player_measurements',
    'games', 'game_lineups', 'plate_appearances', 'game_pitch_events', 'exercises'
  ] loop
    execute format(
      'alter table public.%I add column if not exists demo_seed_run_id uuid references public.demo_seed_runs(id) on delete restrict',
      target_table
    );
    execute format(
      'alter table public.%I add column if not exists demo_metadata jsonb not null default ''{}''::jsonb',
      target_table
    );
    execute format(
      'create index if not exists %I on public.%I(demo_seed_run_id) where demo_seed_run_id is not null',
      target_table || '_demo_seed_run_idx', target_table
    );
  end loop;
end $$;
