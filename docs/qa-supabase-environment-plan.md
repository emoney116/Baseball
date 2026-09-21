# Preview / QA Supabase Plan

Status: proposal only, September 21, 2026. No infrastructure, billing, secrets,
production migrations or retention changes were made.

## Decision

Use one persistent synthetic QA project first. Keep production credentials out of
Vercel Preview and local hosted-acceptance jobs. Add per-PR databases later only
if concurrent schema testing justifies them.

**Data isolation is not quota isolation.** Supabase aggregates quotas across an
organization. A second project in Baseball still consumes Baseball's egress.
Branches also contribute to their subscription quota. To meet the stricter goal
of independent production quota accounting, the owner should approve a separate
QA organization and its plan. This is not a way to evade service limits.
Sources: [organization billing](https://supabase.com/docs/guides/platform/billing-on-supabase),
[branch usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching).

## Options And Budget

| Option | Benefit | Tradeoff / indicative cost |
| --- | --- | --- |
| Persistent QA project, separate organization | Stable acceptance URL/accounts; independent quota accounting | Own migration/configuration pipeline. Free is $0 if eligible within the account's two active Free-project limit, but pauses after inactivity; paid QA starts at $25/month with first Micro project included. |
| Second project in existing organization | Stable isolated data with simpler administration | Does NOT isolate pooled egress; additional paid projects start around $10/month compute, plus usage. |
| Persistent or ephemeral branch | Separate service credentials; convenient schema testing and PR lifecycle | Shared subscription quota; default Micro starts $0.01344/hour, approximately $9.68 for 720 hours, plus usage. Not covered by Spend Cap. |

These are current list-price estimates, not a quote or authorized purchase.
Sources: [pricing](https://supabase.com/pricing),
[branch billing](https://supabase.com/docs/guides/platform/manage-your-usage/branching).
Branches start without application data by default; do not enable Include data.
[Branching architecture](https://supabase.com/docs/guides/deployment/branching).

## Environment Wiring

Vercel Production retains its existing values. Preview receives only QA values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only; legacy `SUPABASE_SERVICE_ROLE_KEY` only if required)
- QA-only Auth redirect/site URLs and non-production provider credentials.

Build-time public variables require a redeployment after changing Preview values.
Do not copy a production `.env.local` into QA. Keep OpenAI credentials server-side,
with a separate QA budget if approved. No player emails in fixtures/logs.
Add a preflight that rejects the production project ref for destructive QA and
asserts browser, server and admin clients all point to the same allowlisted QA ref.
Fail closed if Preview lacks QA variables; never fall back to production.

For branches, Supabase's Vercel integration can synchronize Preview credentials
on PR creation and redeploy to address the initial environment race. Verify the
resolved ref before every hosted test; do not assume the first deployment is safe.
[Integration behavior](https://supabase.com/docs/guides/deployment/branching/integrations).

## Schema And Seed Workflow

1. Inventory the existing migration history and configuration without copying data.
2. Audit data-bearing migrations before bootstrap. This repo has public/demo and
   team foundation seeds mixed into `supabase/migrations`; a schema-only reviewed
   baseline must avoid importing real identities. Do not blindly replay seed DML
   or edit already-applied production migrations.
3. Prove a clean local rebuild, functions, grants, RLS and schema parity; document
   any baseline/history reconciliation. Owner approval is required before remote use.
4. Apply the same subsequent versioned schema migrations to QA first, then production
   only through its existing protected process. No automatic QA-to-production merge.
5. Seed deterministic fictional teams, seasons, players and practices. Include
   anonymous/named runners, ROE, sacrifices, multiple runners, partial EV/spray,
   Defense Off, explicit defensive evidence, coach/machine/player pitching.
6. Seed coach, assistant, player and unauthorized-account roles using controlled
   QA identities. Provision Auth identities separately from application fixtures;
   secrets stay in CI/Vercel, not Git. Test cross-team RLS denial.

Current `.github/workflows/supabase-migrations.yml` is production-targeted and has
a specific authorized-migration allowlist. Do not repurpose or loosen it for QA.
Create a separately protected QA job/environment after authorization, pin CLI
version, dry-run first, and serialize migrations/reset operations. Existing remote
verification includes a write/read smoke test; it must use QA credentials when
run as hosted acceptance. [Environment workflow](https://supabase.com/docs/guides/deployment/managing-environments).

## Reset And CI

Reset requires an explicit QA-only target, allowlisted ref, run identifier and
exclusive reset lock. Disable outbound email/webhooks, reset only synthetic data,
reseed, then run schema/RLS/smoke checks. Preserve failing QA artifacts privately
before resetting. Never provide production secrets to reset jobs.

Default unit/component tests remain network-blocked and fixture-based. Hosted
tests are opt-in, concurrency-limited, record request/byte budgets, reuse fixtures
across viewports, and stop on unexpected production refs or traffic amplification.
Prefer local responsive QA; hosted acceptance verifies integration, not thousands
of repeated layouts. Real Sept. 17 evidence remains private and read-only, not a
general QA seed. Recreate its statistical shape with fictional data for shared QA.

## Rollout Acceptance

- Owner chooses organization/plan and authorizes provisioning separately.
- Production project cannot be reached by Preview browser/server/admin credentials.
- Same schema and RLS behavior; seeded coach/player isolation passes.
- Destructive reset cannot run against production, including a negative test.
- Auth, uploads, Ask and Voice point to QA services; no production emails/webhooks.
- Page-load, idle and one-event traffic budgets recorded before larger acceptance.
- Production deployment variables and existing historical rows remain unchanged.

## Daily Monitoring Through October 19

Owner/on-call records one daily snapshot at a consistent timezone, not a live
polling loop. This is an operational runbook, **not an installed scheduled monitor**.
Use the Usage Dashboard's daily/project/service filters; keep billing-cycle totals
separate from daily deltas. Suggested private ledger columns:

`date, timezone, organization, project, environment, cycle_start, cycle_end,
egress_bytes, postgrest_bytes, storage_egress_bytes, realtime_egress_bytes,
db_size_bytes, storage_size_bytes, realtime_messages, peak_connections,
deploy_sha, qa_runs, source_timestamp, notes`

Record unavailable meters as unknown, not zero. Export/screenshots are authoritative
for billing; browser JSON bytes are diagnostic estimates and exclude server-side
traffic/compression differences. Record QA run IDs and Preview deployments alongside
daily usage. Compare changes against the prior day and a rolling 7-day baseline.

Proposed operational alerts (not provider limits): daily egress >2x recent baseline
with >100 MB absolute increase, >80% cycle allowance, unexpected idle requests,
or any production-ref access from QA. Investigate endpoints first; pause the
offending QA loop, not normal product functionality. No automatic billing changes.
Recheck on October 8/9 and October 18 before the reported October 19 grace deadline.

If later automating logs, do not use `analytics/endpoints/logs.all`: its removal is
September 23, 2026. Use the current ClickHouse-backed `logs` endpoint and bounded
date/source filters. Dashboard Logs Explorer is unaffected. No new log integration
was installed here. [Migration notice](https://supabase.com/changelog/48235-migration-of-supabase-management-api-logs-all-analytics-endpoint-to-logs-endpoint).
