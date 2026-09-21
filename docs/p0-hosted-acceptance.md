# P0 hosted acceptance checkpoint

## Candidate and Preview

- Candidate: `43851cc6832952fa0cbafd6b705c075c38b311a0`.
- Branch: `codex/real-practice-voice-v2-postmortem`.
- Origin main after fetch: `6bca395`; candidate is ahead 2, behind 0.
- Clean candidate worktree before acceptance; no force operations or merges.
- Existing Git-triggered Preview: https://baseball-axcsrn8pb-emoney116s-projects.vercel.app
- Vercel deployment `dpl_7ZpjorMgE8i2sJgH9SK2pr4J9ybq`: READY, exact candidate Git SHA, Preview, HTTP 200.
- Authorized Vercel CLI works with the existing Baseball project. The earlier connector 403 is connector-specific, not missing project permission. No new project or production promotion.

## Authorized migration

Applied only `20260920230057_practice_runner_analytics_projection.sql` using linked Supabase CLI `db push` after `db push --dry-run` listed only that migration.

- File SHA256: `BA116B46952497A1B8E79BB469E9D2878DC8EE60EA48F0E977D101B33802E342`.
- History: exactly one entry, six statements; recorded SQL matches local content after whitespace/statement-separator normalization.
- Subsequent dry run: remote database up to date.
- Public wrapper: stable, security invoker, empty search path.
- Private reader: stable, security definer, empty search path, existing authenticated/team-management checks.
- Anonymous execution denied for both functions; authenticated execution granted.
- No tables, policies, historical rows, billing, retention, or V1/V2 behavior changed.
- Security advisor still reports warnings on pre-existing objects/settings (53 total); no findings name either new runner function. This is not a claim that all existing database security findings are resolved.

## Historical integrity

Private hosted readback compared recursively with the forensic export: Practice record, round, all 86 hitting records, and all 99 action records are unchanged. Private evidence remains outside Git.

This comparison is an administrator read-only integrity check, **not** authenticated hosted Analytics/recap/Ask acceptance. Previous local expected totals remain 5 runs, 16 runner advances, 2 runner outs, 46 BIP, 20 EV samples, and 24 spray samples.

## Environment and traffic

Vercel has one shared `NEXT_PUBLIC_SUPABASE_URL` variable targeting Development, Preview, and Production, with no branch override. Hosted Preview acceptance therefore uses the shared Supabase project and contributes to its usage. No topology changes made.

The authorized Usage Dashboard is now accessible. Private evidence records current-period egress and daily service breakdown. PostgREST dominates the large observed spikes; the dashboard does not attribute those requests to QA versus production. Do not infer exact feature or customer percentages.

Default tests passed with the external-fetch guard enabled. Intentional hosted browser acceptance, provider probes, and remote database queries remain external traffic. The guard is not an operating-system network sandbox.

## Validation

- Production build: PASS (also run by npm test).
- `npm test -- --runInBand`: 1,930 passed, 0 failed.
- `npm run lint`: 0 errors, 23 existing warnings.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Gate: not complete

Preview loads the Clubhouse sign-in screen. Coach sign-in was requested in the visible browser panel. Do not fabricate a coach session or treat privileged database access as authenticated UI acceptance.

Pending authenticated acceptance:

1. Historical Analytics, recap and Ask all show 5 runs; verify other sample totals and untracked Defense.
2. Exact team/season/Practice/source Analytics deep link.
3. Isolated generated QA Practice: complete save lifecycle at 1, 10 and, if safe, 50 events; include response bytes and observable server calls.
4. Full navigation trace, active timers/listeners/subscriptions returning to baseline.

No hosted events were generated in this checkpoint. Prior isolated transport measurements must not be relabeled as hosted save measurements. P1/P2 remain gated. Main remains unchanged.
