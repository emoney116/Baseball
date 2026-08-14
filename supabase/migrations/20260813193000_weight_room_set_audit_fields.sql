alter table public.workout_sets
  add column if not exists status text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists entry_source text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists workout_sets_created_by_idx on public.workout_sets(created_by);
create index if not exists workout_sets_entry_source_idx on public.workout_sets(entry_source);
