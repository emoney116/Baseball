-- One canonical plan for manual editing and imports; no retained source attachment.
alter table public.practices
  add column if not exists team_plan jsonb not null default '[]'::jsonb,
  add column if not exists team_plan_revision integer not null default 0,
  add column if not exists team_plan_published_by uuid references public.profiles(id),
  add column if not exists team_plan_published_at timestamptz;

alter table public.practices add constraint practices_team_plan_shape
  check (jsonb_typeof(team_plan) = 'array' and jsonb_array_length(team_plan) <= 30);
-- Existing practices RLS remains authoritative. No new player write policy.
