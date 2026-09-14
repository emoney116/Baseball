# Voice Hosted Acceptance Environment

Audited September 14, 2026. Candidate: `0a961fe6496c5d80f3550afbb4f6c765dce8d1de`. Main remains `8754d8b822098531f5eaa85b303fb25ec9238044`; candidate is two commits ahead, zero behind. No implementation changes in this pass.

## Environment Contract

Presence below is configuration metadata, not proof of credential validity. No secret values were displayed or exported.

| Name | Purpose | Server-only | Development | Preview | Production |
| --- | --- | --- | --- | --- | --- |
| OPENAI_API_KEY | OpenAI audio transcription authorization | Yes | Vercel present; local present | Sensitive, present | Sensitive, present |
| SUPABASE_SECRET_KEY | Private usage reservation and existing admin commands | Yes | Absent locally and in Vercel Development | Sensitive, present | Sensitive, present |
| SUPABASE_SERVICE_ROLE_KEY | Legacy alternative to SUPABASE_SECRET_KEY | Yes | Absent | Not listed | Not listed |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project endpoint | No | Present | Present | Present |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public client and cookie authentication | No | Present | Present | Present |
| VOICE_COST_USD_PER_MINUTE | Verified model/account price for estimates | Yes | Absent | Absent | Absent |

Absent cost configuration produces null estimates, not zero cost. OPENAI_AI_MODEL is an existing Ask configuration and does not select the Voice model. Voice currently fixes OpenAI, whisper-1, English and verbose_json at https://api.openai.com/v1/audio/transcriptions, using Authorization: Bearer OPENAI_API_KEY. No public-prefixed transcription credential is configured locally.

## Credentials / Probe

Local key is present, contains no whitespace, and matches the original workspace key. Previous controlled probe returned 401 missing_scope. This supports an authorization/scope problem; it does not establish expiry, wrong project, or validity of the separately protected Preview/Production values. The QA export contains no usable OpenAI key. No repeated failing probe was sent in this pass. The requested phrase probe remains pending an authorized working credential/environment.

## Preview

The Vercel connector still returns 403 for emoney116s-projects. The existing authorized CLI login works, resolving deployment inspection without bypassing protection or copying verification values.

Verified Ready deployment: https://baseball-hx9424a7p-emoney116s-projects.vercel.app

Deployment metadata matches candidate 0a961fe and feature/clu9-71-voice-stat-entry. Preview secret presence is confirmed through names/types/targets only. Runtime validity remains untested.

## Migration

20260913140000_voice_usage.sql adds private operational metering, atomic per-actor quotas, and a 30-day retention cron. No canonical baseball tables change. RLS is enabled; anon/authenticated table access is revoked, service_role receives select/insert/update. The reservation function is security invoker and service_role-only. Retention deletes only expired operational rows.

Read-only live migration history for lvlibxghdyvtxjnddfwf ends at 20260910180448_staff_without_email; Voice is not recorded. No SQL or migration was applied or replayed. Separate Preview database history has not been established. Confirm the Preview target before applying via the normal migration workflow; any change to the live project requires explicit authorization.

## Acceptance Status

Real iPhone/iPad hardware is unavailable to this agent. Real microphone permission/recovery, noise corpus, latency median/p95, hosted Live BP/Practice writes, Fast/Undo, ambiguity, manual parity and Analytics/Ask readback remain pending. No synthetic evidence is relabeled as real acceptance.

Prior unchanged-candidate validation remains 1,079 tests, build/TypeScript/diff passing, lint zero errors and 26 warnings. No application fix was made in this environment audit, so the full regression suite was not rerun. Privacy, failure recovery and abuse checks retain prior repository evidence only, not new hosted acceptance.

FIELD PILOT READY: NO. Blockers: authorized migration target/deployment and working transcription authorization. External acceptance: real iPhone/iPad and real audio/noise plus hosted canonical readback. No newly established repository bug. Minor: pricing configuration. No production promotion or main merge.
