create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  title text,
  scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_profile_updated_idx
  on public.ai_conversations(profile_id, updated_at desc);

create index if not exists ai_conversations_team_updated_idx
  on public.ai_conversations(team_id, updated_at desc)
  where team_id is not null;

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);

create index if not exists ai_messages_profile_created_idx
  on public.ai_messages(profile_id, created_at desc);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  message_id uuid references public.ai_messages(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  request_hash text,
  model text,
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'rate_limited', 'duplicate', 'unavailable', 'refused')),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  tool_call_count integer not null default 0,
  web_search_count integer not null default 0,
  latency_ms integer,
  error_code text,
  safe_tool_names jsonb not null default '[]'::jsonb,
  safe_tool_params jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_usage_events_profile_created_idx
  on public.ai_usage_events(profile_id, created_at desc);

create index if not exists ai_usage_events_team_created_idx
  on public.ai_usage_events(team_id, created_at desc)
  where team_id is not null;

create index if not exists ai_usage_events_request_hash_idx
  on public.ai_usage_events(profile_id, request_hash, created_at desc)
  where request_hash is not null;

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_events enable row level security;

drop policy if exists "Profiles can read own AI conversations" on public.ai_conversations;
create policy "Profiles can read own AI conversations"
  on public.ai_conversations
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Profiles can create own AI conversations" on public.ai_conversations;
create policy "Profiles can create own AI conversations"
  on public.ai_conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Profiles can update own AI conversations" on public.ai_conversations;
create policy "Profiles can update own AI conversations"
  on public.ai_conversations
  for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Profiles can read own AI messages" on public.ai_messages;
create policy "Profiles can read own AI messages"
  on public.ai_messages
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Profiles can create own AI messages" on public.ai_messages;
create policy "Profiles can create own AI messages"
  on public.ai_messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.profile_id = (select auth.uid())
    )
  );

drop policy if exists "Profiles can read own AI usage" on public.ai_usage_events;
create policy "Profiles can read own AI usage"
  on public.ai_usage_events
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Team members can read team AI usage" on public.ai_usage_events;
create policy "Team members can read team AI usage"
  on public.ai_usage_events
  for select
  to authenticated
  using (
    team_id is not null
    and exists (
      select 1
      from public.profile_team_memberships m
      where m.profile_id = (select auth.uid())
        and m.team_id = ai_usage_events.team_id
        and m.active = true
    )
  );

drop policy if exists "Profiles can create own AI usage" on public.ai_usage_events;
create policy "Profiles can create own AI usage"
  on public.ai_usage_events
  for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Profiles can update own AI usage" on public.ai_usage_events;
create policy "Profiles can update own AI usage"
  on public.ai_usage_events
  for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

grant select, insert, update on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert, update on public.ai_usage_events to authenticated;
