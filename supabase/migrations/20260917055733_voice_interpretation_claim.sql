-- Separate the one-use fallback claim from client-reported parse timing.
alter table public.voice_usage add column if not exists interpretation_requested_at timestamptz;
