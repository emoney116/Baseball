-- Preserve one rich narration as one request; existing authorization and rate limits remain.
alter table public.voice_usage drop constraint voice_usage_audio_seconds_check;
alter table public.voice_usage add constraint voice_usage_audio_seconds_check
  check (audio_seconds > 0 and audio_seconds <= 30);
