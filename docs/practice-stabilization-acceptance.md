# Practice Stabilization: P0 Acceptance Gate

## Preservation and scope

Validated checkpoint `01bc312` was pushed before changes to `codex/real-practice-voice-v2-postmortem`. Main was fetched and remained at `6bca395`; no Campbell/main work was integrated. No historical Practice writes, audio retention changes, production migrations, billing changes or V2 promotion.

## Runner integrity

Root cause: batting aggregation read only `HittingEvent.liveBpContext.runnerOutcomes`. Durable standalone runner receipts in `clubhouse_private.live_bp_actions` never entered AppData or the shared Analytics calculation.

The new read-only projection returns only action ID, Practice/round identity, version/time and narrow movement evidence. It excludes undone receipts, raw before-state, actor and unrelated actions. The private security-definer function checks `auth.uid()` and current team-management authority for every requested Practice. The public wrapper is security-invoker; anonymous access is revoked. Requests are bounded to 100 Practices and paginated. Missing projection/errors fail closed rather than returning a false successful zero.

**Deployment prerequisite (resolved in hosted checkpoint):** migration `20260920230057_practice_runner_analytics_projection.sql` was subsequently authorized and applied through the normal CLI migration workflow. See [hosted acceptance checkpoint](p0-hosted-acceptance.md) for migration, Preview, and remaining authenticated gates. The original local acceptance evidence below is retained as such; it is not a hosted traffic measurement. The branch intentionally does not silently fall back to incomplete runner totals when the RPC is unavailable.

Both browser repository loads and Ask's authorized server loader use this projection. Live refresh retains it. Analytics, recap and Ask use one calculation. Player identity canonicalization also remaps runner IDs in both representations.

Definitions:

- Team run: canonical safe arrival at Home, including an anonymous occupied-base runner.
- Player run: the same arrival with explicit or authoritative starting-occupancy identity. Never attribute anonymous runs.
- Runner advance: one safe forward movement by an existing runner, not number of bases and not batter placement.
- Runner out: canonical out of an existing runner, excluding the batter.
- Deduplication: receipt ID removes transport duplicates. A standalone action duplicates embedded evidence only when Practice, round, linked pitch, runner identity (or anonymous starting base) and destination agree. Distinct actors on the same play are preserved.
- RBI remains separate. Standalone scoring does not automatically credit the batter. Existing supported pitch-linked RBI rules remain authoritative.
- Errors, throws, steals, tag-ups and other supported reasons remain provenance, not automatic RBI. Pinch-runner substitutions are not advances.
- No synthetic PA, hit, contact, EV or spray row is created. Runner evidence does not increase hitting-opportunity counts.
- Situational jobs remain explicit canonical evidence. There were no assigned-job primitives in this Practice, so no success percentage is inferred. General job inference was not added during the P0 fix.

Local read-only export reconciliation:

| Metric | Raw evidence | Shared Analytics / recap |
| --- | --- | --- |
| Runs | 2 embedded + 3 standalone scores | 5 |
| Standalone actions | 7 non-undone receipts | 7 projected |
| Runner advances | Deduplicated forward outcomes | 16 |
| Runner outs | Deduplicated non-batter outs | 2 |
| Hitting events | 86 rows | 86 |
| BIP | 46 | 46 |
| EV samples | 20 | 20 |
| Spray samples | 24 | 24 |
| Player pitching | No canonical player pitch rows | Not tracked |
| Defense | Tracking Off, no canonical reps | Not tracked |

Ask's existing tool plan for "How many runs scored in Practice?" receives 5 from the same Analytics totals, without independent math. The private reconciliation script asserts these values. The actual recap component was rendered from that result and displays 5; this is not hosted acceptance or a full Recap V2 redesign.

## Egress evidence and fixes

Known warning: organization egress, approximately 5.5 GB threshold, grace period through October 19. Exact usage/service breakdown and billing boundaries still require owner Dashboard evidence. No attribution of the bill to Voice alone.

Concrete waste: full workspace refresh after each save (fixed at the previous checkpoint), and another full workspace read every 10 seconds on the active Practice page (fixed here to Practice scope). Live BP's five-second poll could overlap on slow responses/focus triggers; it now permits one in-flight read and aborts/cleans up on unmount.

`practice-egress-probe.mjs` executes the real repository methods and Supabase JS query construction with an isolated fixture transport populated from private exported rows. These are measured read-plan requests and JSON body bytes, **not production wire/billing measurements**. No live writes or credentials are involved.

| Events / refreshes | Workspace requests | Scoped requests | Workspace JSON bytes | Scoped JSON bytes |
| --- | --- | --- | --- | --- |
| 1 | 28 | 9 | 40,260 | 21,343 |
| 10 | 280 | 90 | 456,722 | 267,552 |
| 50 | 1,400 | 450 | 3,537,314 | 2,591,464 |
| 100 (simulation) | 2,800 | 900 | 10,362,892 | 8,471,192 |

The 9 scoped requests include pagination termination reads, so the previous source-only estimate of 6 queries was not a measurement. The current shape accesses 7 resources with 9 requests in this fixture. Requests decrease 67.9%; bytes decrease 26.7% at 50 events and 18.3% at 100 in this single-Practice fixture. Unrelated Games, Weight Room, roster and profile reads are absent from scoped refreshes. Real multi-Practice history could make the previous workspace load larger.

The retained full current-Practice event snapshot means cumulative body bytes grow faster than linearly as a Practice grows. One hundred events is about 8.47 MB of measured simulated refresh bodies, not total Practice egress. An incremental sync design needs deletion/Undo and concurrency handling; this pass does not claim that problem solved with a fragile append-only cache.

At the same simulated activity, 10 Practices/week is approximately 84.7 MB per team, 4.24 GB for 50 teams and 8.47 GB for 100 teams, **refresh bodies only**. Excludes polling, authentication, save RPC/POST, schema/RLS internal queries, headers, compression and other product use. Legitimate usage is separate from avoidable waste. Do not extrapolate this as an actual Supabase bill.

Unmeasured hosted requirements: actual save request/response bytes, SQL-internal reads/writes, Realtime replication messages, total requests per pitch including auth, and repeated full application route navigation. A simulated read request is not an internal SQL query count.

Subscriptions: coach Live BP/Practice use polling, not Supabase channels. The sole application Realtime channel is PlayerShell's access channel, with removal and auth unsubscribe. The actual extracted Live BP polling lifecycle passes 50 mount/unmount cycles with timer/focus counts returning to zero and a slow-read coalescing test. This is not a hosted navigation trace or proof about provider reconnect behavior.

Voice audio goes to the transcription provider through the application route, not Supabase Storage. No audio Storage writes were found in that route. Full-recording QA used local files and the provider, not Supabase audio storage.

Default automated database tests use PGlite. Anonymous route tests target loopback and explicitly configure a loopback Supabase URL. The default test runner now rejects external `fetch` calls; hosted acceptance remains separate and explicit. This is a fetch safeguard, not an OS-level network sandbox. The complete suite passes with it enabled.

Authorized real-data exports/hosted QA can contribute shared-project traffic. Preview project isolation is **not verified**: Vercel returned 403 for the configured team scope. Do not route around that denial. Re-authentication to the proper scope is needed. No exact development/QA/production percentages are claimed. Ask loads the authorized team/season evidence before its bounded response; it can be substantial, but was not separately optimized without measured traffic. Recap reuses in-memory Analytics and does not independently fetch.

## Gate and remaining priorities

P0-A passes local projection/security/regression/export tests, not hosted deployment acceptance. P0-B has concrete fixes, repeatable read-plan measurements and lifecycle tests, but not full hosted save/network acceptance. These limitations remain explicit blockers to declaring this iteration accepted.

Per priority order, no Recap V2 feature expansion, typed V2 implementation or P2 polish was started while this gate remains unresolved. V1 parser/Fast Voice/manual/Undo semantics remain unchanged. Existing V2 failed holdout is preserved; no new V1-vs-V2 result is claimed.

Next action: **D - finish P0 acceptance**, first authorize/deploy the read-only projection to an appropriate QA database and restore the Vercel team scope; then run authenticated 1/10/50 saves, navigation telemetry, exact Analytics deep links and current Practice reads. Only afterward proceed to recap and typed V2 work. No main merge or production migration is implied by this document.
