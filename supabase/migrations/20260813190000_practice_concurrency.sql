-- Multi-coach practice support: concurrent sessions, contributors, audit fields,
-- and idempotent append-only practice event writes.

alter table public.practice_sessions
  add column if not exists title text,
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists contributor_profile_ids uuid[] not null default '{}',
  add column if not exists location text,
  add column if not exists station text,
  add column if not exists entry_policy text not null default 'COACH_ONLY',
  add column if not exists updated_at timestamptz not null default now();

alter table public.practice_sessions
  drop constraint if exists practice_sessions_status_check;

alter table public.practice_sessions
  add constraint practice_sessions_status_check
  check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED'));

alter table public.practice_sessions
  drop constraint if exists practice_sessions_entry_policy_check;

alter table public.practice_sessions
  add constraint practice_sessions_entry_policy_check
  check (entry_policy in ('COACH_ONLY', 'COACH_AND_ASSIGNED_PLAYERS', 'PLAYER_SELF_ENTRY'));

create index if not exists practice_sessions_practice_status_idx
  on public.practice_sessions(practice_id, status);

create index if not exists practice_sessions_created_by_idx
  on public.practice_sessions(created_by_profile_id);

drop trigger if exists set_practice_sessions_updated_at on public.practice_sessions;
create trigger set_practice_sessions_updated_at
  before update on public.practice_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.practice_session_contributors (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'COACH',
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint practice_session_contributors_role_check
    check (role in ('COACH', 'PLAYER', 'MANAGER')),
  constraint practice_session_contributors_unique unique (session_id, profile_id)
);

create index if not exists practice_session_contributors_session_idx
  on public.practice_session_contributors(session_id);

create index if not exists practice_session_contributors_profile_idx
  on public.practice_session_contributors(profile_id);

alter table public.practice_session_contributors enable row level security;

drop policy if exists clubhouse_practice_session_contributors_select on public.practice_session_contributors;
drop policy if exists clubhouse_practice_session_contributors_write on public.practice_session_contributors;

create policy clubhouse_practice_session_contributors_select on public.practice_session_contributors
  for select
  using (public.is_session_staff(session_id));

create policy clubhouse_practice_session_contributors_write on public.practice_session_contributors
  for all
  using (public.is_session_staff(session_id))
  with check (public.is_session_staff(session_id));

alter table public.practice_attendance
  add column if not exists updated_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists practice_attendance_practice_player_key
  on public.practice_attendance(practice_id, player_id);

create index if not exists practice_attendance_practice_updated_idx
  on public.practice_attendance(practice_id, updated_at desc);

drop trigger if exists set_practice_attendance_updated_at on public.practice_attendance;
create trigger set_practice_attendance_updated_at
  before update on public.practice_attendance
  for each row execute function public.set_updated_at();

alter table public.pitch_events
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists entry_source text not null default 'COACH',
  add column if not exists verification_status text not null default 'COACH_RECORDED',
  add column if not exists idempotency_key text,
  add column if not exists session_sequence integer;

alter table public.hitting_events
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists entry_source text not null default 'COACH',
  add column if not exists verification_status text not null default 'COACH_RECORDED',
  add column if not exists idempotency_key text,
  add column if not exists session_sequence integer;

alter table public.defense_events
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists entry_source text not null default 'COACH',
  add column if not exists verification_status text not null default 'COACH_RECORDED',
  add column if not exists idempotency_key text,
  add column if not exists session_sequence integer;

alter table public.pitch_events
  drop constraint if exists pitch_events_entry_source_check,
  drop constraint if exists pitch_events_verification_status_check,
  add constraint pitch_events_entry_source_check
    check (entry_source in ('COACH', 'PLAYER', 'DEVICE', 'IMPORT')),
  add constraint pitch_events_verification_status_check
    check (verification_status in ('COACH_RECORDED', 'PLAYER_RECORDED', 'COACH_VERIFIED'));

alter table public.hitting_events
  drop constraint if exists hitting_events_entry_source_check,
  drop constraint if exists hitting_events_verification_status_check,
  add constraint hitting_events_entry_source_check
    check (entry_source in ('COACH', 'PLAYER', 'DEVICE', 'IMPORT')),
  add constraint hitting_events_verification_status_check
    check (verification_status in ('COACH_RECORDED', 'PLAYER_RECORDED', 'COACH_VERIFIED'));

alter table public.defense_events
  drop constraint if exists defense_events_entry_source_check,
  drop constraint if exists defense_events_verification_status_check,
  add constraint defense_events_entry_source_check
    check (entry_source in ('COACH', 'PLAYER', 'DEVICE', 'IMPORT')),
  add constraint defense_events_verification_status_check
    check (verification_status in ('COACH_RECORDED', 'PLAYER_RECORDED', 'COACH_VERIFIED'));

create or replace function public.assign_practice_event_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
begin
  if new.session_id is not null then
    perform 1
    from public.practice_sessions
    where id = new.session_id
    for update;

    execute format(
      'select coalesce(max(session_sequence), 0) + 1 from public.%I where session_id = $1',
      tg_table_name
    )
    into next_sequence
    using new.session_id;

    new.session_sequence := next_sequence;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_pitch_events_sequence on public.pitch_events;
create trigger assign_pitch_events_sequence
  before insert on public.pitch_events
  for each row execute function public.assign_practice_event_sequence();

drop trigger if exists assign_hitting_events_sequence on public.hitting_events;
create trigger assign_hitting_events_sequence
  before insert on public.hitting_events
  for each row execute function public.assign_practice_event_sequence();

drop trigger if exists assign_defense_events_sequence on public.defense_events;
create trigger assign_defense_events_sequence
  before insert on public.defense_events
  for each row execute function public.assign_practice_event_sequence();

create index if not exists pitch_events_practice_created_idx
  on public.pitch_events(practice_id, created_at);
create index if not exists pitch_events_session_id_idx
  on public.pitch_events(session_id);
create index if not exists pitch_events_session_sequence_idx
  on public.pitch_events(session_id, session_sequence)
  where session_sequence is not null;
create unique index if not exists pitch_events_idempotency_key_idx
  on public.pitch_events(idempotency_key)
  where idempotency_key is not null;
create unique index if not exists pitch_events_session_sequence_unique_idx
  on public.pitch_events(session_id, session_sequence)
  where session_sequence is not null;

create index if not exists hitting_events_practice_created_idx
  on public.hitting_events(practice_id, created_at);
create index if not exists hitting_events_session_id_idx
  on public.hitting_events(session_id);
create index if not exists hitting_events_session_sequence_idx
  on public.hitting_events(session_id, session_sequence)
  where session_sequence is not null;
create unique index if not exists hitting_events_idempotency_key_idx
  on public.hitting_events(idempotency_key)
  where idempotency_key is not null;
create unique index if not exists hitting_events_session_sequence_unique_idx
  on public.hitting_events(session_id, session_sequence)
  where session_sequence is not null;

create index if not exists defense_events_practice_created_idx
  on public.defense_events(practice_id, created_at);
create index if not exists defense_events_session_id_idx
  on public.defense_events(session_id);
create index if not exists defense_events_session_sequence_idx
  on public.defense_events(session_id, session_sequence)
  where session_sequence is not null;
create unique index if not exists defense_events_idempotency_key_idx
  on public.defense_events(idempotency_key)
  where idempotency_key is not null;
create unique index if not exists defense_events_session_sequence_unique_idx
  on public.defense_events(session_id, session_sequence)
  where session_sequence is not null;

drop policy if exists metrolina_practice_sessions_staff on public.practice_sessions;
create policy metrolina_practice_sessions_staff on public.practice_sessions
  for all
  using (public.is_practice_staff(practice_id))
  with check (public.is_practice_staff(practice_id));

drop policy if exists metrolina_pitch_events_staff on public.pitch_events;
create policy metrolina_pitch_events_staff on public.pitch_events
  for all
  using (public.is_practice_staff(practice_id) or public.is_session_staff(session_id))
  with check (public.is_practice_staff(practice_id) or public.is_session_staff(session_id));

drop policy if exists metrolina_hitting_events_staff on public.hitting_events;
create policy metrolina_hitting_events_staff on public.hitting_events
  for all
  using (public.is_practice_staff(practice_id) or public.is_session_staff(session_id))
  with check (public.is_practice_staff(practice_id) or public.is_session_staff(session_id));

drop policy if exists metrolina_defense_events_staff on public.defense_events;
create policy metrolina_defense_events_staff on public.defense_events
  for all
  using (public.is_practice_staff(practice_id) or public.is_session_staff(session_id))
  with check (public.is_practice_staff(practice_id) or public.is_session_staff(session_id));
