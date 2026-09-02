create table if not exists public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entitlement_key text not null check (char_length(trim(entitlement_key)) > 0),
  enabled boolean not null default true,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, entitlement_key)
);

create index if not exists account_entitlements_profile_active_idx
  on public.account_entitlements(profile_id, entitlement_key)
  where enabled = true;

drop trigger if exists account_entitlements_set_updated_at on public.account_entitlements;
create trigger account_entitlements_set_updated_at
  before update on public.account_entitlements
  for each row execute function public.set_updated_at();

alter table public.account_entitlements enable row level security;
revoke all on public.account_entitlements from anon, authenticated;
grant all on public.account_entitlements to service_role;

-- Explicit internal beta grant. This is data seeding, not authorization logic.
insert into public.account_entitlements (profile_id, entitlement_key, enabled, metadata)
select
  p.id,
  'SUPER_USER',
  true,
  jsonb_build_object('grant_reason', 'Clubhouse founder/testing beta access')
from public.profiles as p
where lower(trim(p.email)) = 'eboston.uchs@gmail.com'
on conflict (profile_id, entitlement_key) do update
set
  enabled = true,
  expires_at = null,
  metadata = public.account_entitlements.metadata || excluded.metadata,
  updated_at = now();
